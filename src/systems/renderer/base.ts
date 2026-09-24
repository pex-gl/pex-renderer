import { isGpuBuffer, isGpuTexture } from "pex-gpu";
import { mat2x3, mat3, mat4 } from "pex-math";

import {
  textureMatrixName,
  samplerName,
  uniformName,
} from "../../shaders/wgsl.js";
import type { ModelStructOptions } from "../../shaders/wgsl.js";
import { definesKey } from "../../utils.js";

import type {
  GpuBuffer,
  Uniforms,
  UniformValue,
  VertexAttribute,
} from "pex-gpu";
import type { Mat2x3, Mat3, Mat4 } from "pex-math";
import type {
  BlendMode,
  MaterialComponentOptions,
  MaterialTexture,
  Entity,
  RendererPassOptions,
  RendererSystem,
  RenderView,
  SkinComponentOptions,
  TextureTransform,
} from "../../types.js";

/** One packed uniform block; pex-gpu does not export `PackableValue` itself. */
type UniformBlock = Extract<UniformValue, Record<string, unknown>>;

const IDENTITY_MAT3 = mat3.create();
const IDENTITY_MAT4 = mat4.create();
// Matches wgsl.ts modelStruct's default maxJoints (uJointMatrices is a
// fixed-size WGSL binding, unlike the light arrays which size to the real count
// via defines).
const MAX_JOINTS = 256;
// Shared so the common case allocates nothing: only a camera with temporal
// antialiasing carries a jitter, and a shadow pass's light camera never does.
export const NO_JITTER = [0, 0];
const TEMP_MAT2X3 = mat2x3.create();
const TEMP_MAT3_SET = new Map<string, number[]>();

function getTextureMatrix(
  out: Mat2x3,
  texture: Partial<TextureTransform>,
): number[] {
  if (!texture.offset && !texture.rotation && !texture.scale) {
    return IDENTITY_MAT3;
  }
  mat2x3.identity(TEMP_MAT2X3);
  if (texture.offset) mat2x3.translate(TEMP_MAT2X3, texture.offset);
  if (texture.rotation) mat2x3.rotate(TEMP_MAT2X3, texture.rotation);
  if (texture.scale) mat2x3.scale(TEMP_MAT2X3, texture.scale);
  return mat3.fromMat2x3(out, TEMP_MAT2X3);
}

/**
 * Declarative rule mapping a material field to a WGSL define plus a
 * uMaterial/texture uniform. Renderer-agnostic — each renderer builds its own
 * table (e.g. `shaders/standard.ts`'s `STANDARD_MATERIAL_*_FIELDS`) and walks
 * it with `getFeatureFlags`. Table order is dependency order: `requires`/
 * `excludes` only see defines added earlier in the same pass.
 */
export interface FeatureField {
  /** Property name on the material; also the uMaterial/texture uniform name. */
  key: string;
  /**
   * Define added when this field has a value. Sharing one `define` across
   * siblings OR-activates them. Omit on passenger fields gated by `requires`.
   */
  define?: string;
  /** Only processed if this define is already active. */
  requires?: string;
  /** Skipped if this define is already active. */
  excludes?: string;
  /**
   * Treat falsy as unset — needed wherever the field's "off" value is `0`/
   * `false` and something always writes the key: the material factory (line
   * `perspectiveScaling`) or the glTF loader materializing an extension's spec
   * defaults (`clearcoatFactor: 0`, `thicknessFactor: 0`, …). Not for fields
   * where 0 differs from unset — KHR_materials_specular's `specular: 0` means
   * no specular, its absence means 1. Default: only nullish is unset.
   */
  truthy?: boolean;
  /**
   * Texture field: adds "u"+Key, "u"+Key+"Sampler" uniforms and a
   * `${key}Matrix` mat3x3f struct field (KHR_texture_transform).
   */
  texture?: boolean;
  /** Scalar uMaterial struct field type. Presence marks a real struct field. */
  wgslType?: "f32" | "vec3f" | "vec4f";
  /** Uniform default when the material's value is nullish. */
  default?: number | number[];
  /**
   * Always declare the struct field (with `default` when unset) and gate the
   * shader body on a same-named `override` constant instead of string presence,
   * so materials differing only by this feature share one compiled module (the
   * override constant-folds away at pipeline creation). `defines` still tracks
   * real per-material activation, returned as `constants`. Non-texture only.
   */
  runtime?: boolean;
}

/**
 * Defines owned by a field's own `runtime` activation. A `requires` pointing at
 * one of these is an internal link within the always-declared group (bypassed
 * like the field's own gate); a `requires` pointing elsewhere stays enforced.
 * Exported so external "is this field declared" checks (e.g.
 * shaders/standard.ts) share the exact rule.
 */
export function getRuntimeDefines(
  fields: readonly FeatureField[],
): Set<string> {
  return new Set(
    fields.filter((f) => f.runtime && f.define).map((f) => f.define!),
  );
}

/**
 * Whether `field`'s struct field/uniform should be written for `defines` — the
 * single rule shared by getFeatureFlags and external struct-field listings.
 * `runtimeDefines` comes from getRuntimeDefines(fields).
 */
export function isFieldActive(
  field: FeatureField,
  runtimeDefines: Set<string>,
  defines: Set<string>,
): boolean {
  if (
    field.runtime &&
    field.requires &&
    !runtimeDefines.has(field.requires) &&
    !defines.has(field.requires)
  ) {
    return false;
  }
  return field.runtime
    ? true
    : defines.has(field.define ?? field.requires ?? "");
}

/**
 * Walks `fields` against `source` (material, geometry attributes, any flat bag)
 * in two passes: first collect active defines, then write uMaterial/texture
 * uniforms. Two passes because WGSL struct packing throws on an unknown member,
 * so a field can only write once its define set is final (e.g. `specularColor`
 * waits on sibling `specular`). Define-only tables leave `uniforms` empty.
 */
function getFeatureFlags(
  // A material component or an attributes map, read by field name.
  source: object,
  fields: readonly FeatureField[],
  defines: Set<string>,
  sampler?: GPUSampler,
): {
  defines: Set<string>;
  uniforms: Uniforms;
  constants: Record<string, boolean>;
} {
  const values = source as Record<string, unknown>;

  for (const field of fields) {
    if (field.requires && !defines.has(field.requires)) continue;
    if (field.excludes && defines.has(field.excludes)) continue;

    const value = values[field.key];
    if (field.texture) {
      if (value && field.define) defines.add(field.define);
      continue;
    }
    const hasValue = field.truthy
      ? !!value
      : value !== undefined && value !== null;
    if (field.define && hasValue) defines.add(field.define);
  }

  const uMaterial: UniformBlock = {};
  const uniforms: Uniforms = { uMaterial };
  // Real per-material activation for `runtime` fields' own defines — the
  // caller passes this into the pipeline's `constants` (see getPipeline).
  // Real per-material activation for `runtime` fields, passed to the pipeline's
  // `constants` (see getPipeline).
  const constants: Record<string, boolean> = {};
  const runtimeDefines = getRuntimeDefines(fields);

  for (const field of fields) {
    if (field.runtime && field.define) {
      constants[field.define] = defines.has(field.define);
    }
    if (!isFieldActive(field, runtimeDefines, defines)) continue;
    const value = values[field.key];

    if (field.texture) {
      if (!value) continue;
      const texture = value as MaterialTexture;
      const name = uniformName(field.key);
      uniforms[name] = isGpuTexture(texture) ? texture : texture.texture;
      // A texture's own sampler (e.g. from a glTF sampler's wrap/filter
      // settings) overrides the renderer's shared default.
      uniforms[samplerName(name)] = isGpuTexture(texture)
        ? sampler!
        : (texture.sampler ?? sampler!);
      let scratch = TEMP_MAT3_SET.get(field.key);
      if (!scratch) {
        TEMP_MAT3_SET.set(field.key, (scratch = mat3.create()));
      }
      uMaterial[textureMatrixName(field.key)] = getTextureMatrix(
        scratch,
        isGpuTexture(texture) ? {} : texture,
      );
      continue;
    }

    if (field.wgslType) {
      uMaterial[field.key] = (value ?? field.default) as UniformBlock[string];
    }
  }

  return { defines, uniforms, constants };
}

// uJointMatrices is a fixed-length array<mat4x4f, maxJoints> binding, so the
// value must always be exactly that length — pad with identity past the skin's
// own joint count. Cached on the skin component: `jointMatrices`' entries are
// mutated in place by systems/skin.ts each frame, so the padded wrapper (built
// from the same references) stays valid without rebuilding.
function getJointMatricesUniform(
  skin: SkinComponentOptions,
  maxJoints: number,
  previous = false,
): Mat4[] {
  const key = previous
    ? "_paddedPreviousJointMatrices"
    : "_paddedJointMatrices";
  if (skin[key]?.length !== maxJoints) {
    const source =
      (previous ? skin._previousJointMatrices : skin.jointMatrices) ?? [];
    skin[key] = Array.from(
      { length: maxJoints },
      (_, i) => source[i] ?? IDENTITY_MAT4,
    );
  }
  return skin[key];
}

const NO_HOOK_UNIFORMS = {};

/**
 * Output names no fragment output corresponds to: `color` is unconditional in
 * `fragmentOutputStruct`, and `depth` is an attachment, not a colour target.
 */
const IMPLICIT_OUTPUTS = new Set(["color", "depth"]);

/**
 * A pass's extra fragment outputs, in the order the shader numbers their
 * `@location`s.
 *
 * Part of every renderer's variant key: `outputs` decides the shape of
 * `FragmentOutput`, so two passes asking for different ones need different
 * pipelines. A name list rather than a flag per known output, so an output
 * added from outside the engine keys itself.
 */
export const outputsKey = (outputs: Record<string, unknown> = {}): string =>
  Object.keys(outputs)
    .filter((name) => !IMPLICIT_OUTPUTS.has(name))
    .join(",");

/** The buffer behind a cached attribute, which may be the bare buffer. */
export const attributeBuffer = (attribute: GpuBuffer | VertexAttribute) =>
  isGpuBuffer(attribute) ? attribute : attribute.buffer;

// Named blend equations, shared by every renderer that draws blended geometry.
// "normal" is the glTF BLEND spec's straight (non-premultiplied) "over"
// equation — the fragment shader writes straight alpha by default (color
// unscaled by opacity, opacity written to .w separately), so its color channel
// needs src-alpha, not the premultiplied "one". "premultiplied" instead relies
// on the shader actually premultiplying (PREMULTIPLY_ALPHA override, see
// shaders/standard.ts) before this state's "one" src factor is applied.
export const BLEND_MODES: Record<BlendMode, GPUBlendState> = {
  normal: {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "one" },
  },
  premultiplied: {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  },
  additive: {
    color: { srcFactor: "src-alpha", dstFactor: "one" },
    alpha: { srcFactor: "one", dstFactor: "one" },
  },
  multiply: {
    color: { srcFactor: "dst", dstFactor: "zero" },
    alpha: { srcFactor: "dst-alpha", dstFactor: "zero" },
  },
  screen: {
    color: { srcFactor: "one", dstFactor: "one-minus-src" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src" },
  },
};

/**
 * Base renderer
 *
 * All renderers are composed with it. Pipelines are cached per shader variant:
 * pex-gpu treats a RenderPipeline's WGSL source as immutable per object
 * identity, so a new object is only needed when the generated source changes
 * (its `defines`). Mutable state (blend, cull, depth) is re-applied per draw on
 * the cached object.
 */
export default (): RendererSystem => ({
  type: "base-renderer",
  pipelineCache: new Map(),
  debug: false,
  getFeatureFlags,
  getShader() {
    return "";
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getShaderOptions(_entity: Entity, _options: RendererPassOptions) {
    return {};
  },
  getDefines(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _entity: Entity,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: RendererPassOptions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _precomputed?: unknown,
  ) {
    return new Set<string>();
  },
  getVariantKey(
    entity: Entity,
    defines: Set<string>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: RendererPassOptions,
  ) {
    return definesKey(defines);
  },
  getPipelineOptions(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _entity: Entity,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: RendererPassOptions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _precomputed?: unknown,
  ) {
    return {};
  },
  /**
   * A material's blend, as a pipeline takes it. Anything falsy — the empty
   * string included — is opaque, so one truthiness check covers "no blending"
   * and the named equations alike.
   */
  getPipelineBlend(
    blend: MaterialComponentOptions["blend"],
  ): GPUBlendState | undefined {
    if (!blend) return undefined;
    return typeof blend === "string" ? BLEND_MODES[blend] : blend;
  },
  /**
   * The `@group(3)` bindings, identical in every pass that draws geometry.
   *
   * Takes the options the pass generated its shader's `modelStruct` with, so
   * the block and the struct cannot disagree — a binding supplied where the
   * shader declared none is rejected at submit, and one declared but not
   * supplied fails validation.
   */
  getModelUniforms(
    entity: Entity,
    normalMatrix: Mat3,
    {
      previousModelMatrix = false,
      skin = false,
      previousSkin = false,
      maxJoints = MAX_JOINTS,
    }: ModelStructOptions = {},
  ) {
    return {
      uModel: {
        modelMatrix: entity._transform!.modelMatrix,
        normalMatrix,
        ...(previousModelMatrix && {
          previousModelMatrix: entity._transform!.previousModelMatrix,
        }),
      },
      ...(skin && {
        uJointMatrices: getJointMatricesUniform(entity.skin!, maxJoints),
        ...(previousSkin && {
          uPreviousJointMatrices: getJointMatricesUniform(
            entity.skin!,
            maxJoints,
            true,
          ),
        }),
      }),
    };
  },
  /**
   * Uniform values for a material's hook bindings, mapped onto the names the
   * generator declared: a texture entry becomes `u<Name>`/`u<Name>Sampler`
   * (`sampler` when the hook supplies none of its own), everything else a field
   * of the `uHooks` block.
   *
   * Computed once per entity per frame, keyed by `frameIndex`, rather than once
   * per draw: the shadow, pre- and main passes run the same vertex hook, and a
   * value read from a clock would displace a vertex differently in each — a
   * shadow that does not match its caster, and a pre-pass depth the opaque pass
   * can no longer test `less-equal` against. Without a frame index (NaN)
   * nothing is reused.
   */
  getHookUniforms(
    entity: Entity,
    frameIndex: number,
    sampler?: GPUSampler,
  ): Uniforms {
    const hooks = entity.material?.hooks;
    if (!hooks?.uniforms) return NO_HOOK_UNIFORMS;

    const cache = (entity._hookUniforms ??= {});
    if (cache.hooks === hooks && cache.frameIndex === frameIndex) {
      return cache.uniforms!;
    }

    const bindings = hooks.bindings ?? {};
    const values = hooks.uniforms(entity);
    const uHooks: UniformBlock = {};
    const uniforms: Uniforms = {};

    for (const [key, value] of Object.entries(values)) {
      // Supplied alongside its texture below, and not a field of the block.
      if (
        key.endsWith("Sampler") &&
        bindings[key.slice(0, -"Sampler".length)]
      ) {
        continue;
      }
      if (bindings[key]?.startsWith("texture_")) {
        const name = uniformName(key);
        uniforms[name] = value;
        uniforms[samplerName(name)] = values[`${key}Sampler`] ?? sampler!;
      } else {
        uHooks[key] = value as UniformBlock[string];
      }
    }
    if (Object.keys(uHooks).length) uniforms.uHooks = uHooks;

    cache.hooks = hooks;
    cache.frameIndex = frameIndex;
    cache.uniforms = uniforms;
    return uniforms;
  },
  getFrameUniforms(renderView: RenderView) {
    const { camera, cameraEntity, viewport } = renderView;
    return {
      projectionMatrix: camera.projectionMatrix!,
      viewMatrix: camera.viewMatrix!,
      inverseViewMatrix: camera.inverseViewMatrix || IDENTITY_MAT4,
      cameraPosition: cameraEntity?._transform?.worldPosition ?? [0, 0, 0],
      viewportSize: [viewport[2]!, viewport[3]!],
      exposure: camera._exposure ?? 1,
      jitter: camera._jitter ?? NO_JITTER,
      previousViewProjectionMatrix:
        camera._previousViewProjectionMatrix ?? IDENTITY_MAT4,
    };
  },
  getPipeline(
    entity: Entity,
    options: RendererPassOptions = {},
    precomputed?: unknown,
  ) {
    const defines = this.getDefines(entity, options, precomputed);
    const key = this.getVariantKey(entity, defines, options);

    const pipeline = this.pipelineCache.getOrInsertComputed(key, () => {
      const source = this.getShader(
        defines,
        this.getShaderOptions(entity, options),
      );
      return { vertex: source, fragment: source };
    });

    // Blend/cull/depth may change between draws without a new pipeline object.
    Object.assign(
      pipeline,
      this.getPipelineOptions(entity, options, precomputed),
    );

    if (entity.material) entity.material.needsPipelineUpdate = false;
    return pipeline;
  },
  // render(renderView, entities, options) {},
  // renderBackground(renderView, entities, options) {},
  // renderShadow(renderView, entities, options) {},
  // renderOpaque(renderView, entities, options) {},
  // renderTransparent(renderView, entities, options) {},
  // renderPost(renderView, entities, options) {},
  update() {},
  dispose() {
    this.pipelineCache.clear();
  },
});
