import { mat2x3, mat3, mat4 } from "pex-math";

import {
  textureMatrixName,
  samplerName,
  uniformName,
} from "../../shaders/wgsl.js";

import { type Mat2x3 } from "pex-math";
import type {
  Entity,
  MaterialTexture,
  RendererSystem,
  RenderView,
} from "../../types.js";

const IDENTITY_MAT3 = mat3.create();
const IDENTITY_MAT4 = mat4.create();
const TEMP_MAT2X3 = mat2x3.create();
const TEMP_MAT3_SET = new Map<string, number[]>();

function getTextureMatrix(out: Mat2x3, texture: MaterialTexture): number[] {
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
  /** Treat `0` as unset (e.g. transmission). Default: only nullish is unset. */
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
  if (!field.runtime) return defines.has(field.define ?? field.requires ?? "");

  return true;
}

/**
 * Walks `fields` against `source` (material, geometry attributes, any flat bag)
 * in two passes: first collect active defines, then write uMaterial/texture
 * uniforms. Two passes because WGSL struct packing throws on an unknown member,
 * so a field can only write once its define set is final (e.g. `specularColor`
 * waits on sibling `specular`). Define-only tables leave `uniforms` empty.
 */
export function getFeatureFlags(
  source: any,
  fields: readonly FeatureField[],
  defines: Set<string>,
  sampler?: GPUSampler,
): {
  defines: Set<string>;
  uniforms: Record<string, any>;
  constants: Record<string, boolean>;
} {
  for (const field of fields) {
    if (field.requires && !defines.has(field.requires)) continue;
    if (field.excludes && defines.has(field.excludes)) continue;

    const value = source[field.key];
    if (field.texture) {
      if (value && field.define) defines.add(field.define);
      continue;
    }
    const hasValue = field.truthy
      ? !!value
      : value !== undefined && value !== null;
    if (field.define && hasValue) defines.add(field.define);
  }

  const uMaterial: Record<string, any> = {};
  const uniforms: Record<string, any> = { uMaterial };
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
    const value = source[field.key];

    if (field.texture) {
      if (!value) continue;
      const name = uniformName(field.key);
      uniforms[name] = value;
      uniforms[samplerName(name)] = sampler;
      let scratch = TEMP_MAT3_SET.get(field.key);
      if (!scratch) {
        TEMP_MAT3_SET.set(field.key, (scratch = mat3.create()));
      }
      uMaterial[textureMatrixName(field.key)] = getTextureMatrix(
        scratch,
        value,
      );
      continue;
    }

    if (field.wgslType) uMaterial[field.key] = value ?? field.default;
  }

  return { defines, uniforms, constants };
}

// Premultiplied "over" blend (One / OneMinusSrcAlpha), shared by every
// renderer that draws blended geometry.
export const ALPHA_BLEND = {
  color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
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
  getShaderOptions() {
    return {};
  },
  getDefines() {
    return new Set();
  },
  getVariantKey(entity: Entity, defines: Set<string>) {
    return [...defines].sort().join("|");
  },
  getPipelineOptions() {
    return {};
  },
  getFrameUniforms(renderView: RenderView) {
    const { camera, cameraEntity, viewport } = renderView;
    return {
      projectionMatrix: camera.projectionMatrix!,
      viewMatrix: camera.viewMatrix!,
      inverseViewMatrix: camera.inverseViewMatrix || IDENTITY_MAT4,
      cameraPosition: cameraEntity?._transform?.worldPosition ?? [0, 0, 0],
      viewportSize: [viewport[2]!, viewport[3]!],
    };
  },
  getPipeline(entity: Entity, options: any = {}, precomputed?: unknown) {
    const defines = this.getDefines(entity, options, precomputed);
    const key = this.getVariantKey(entity, defines, options);

    let pipeline = this.pipelineCache.get(key);
    if (!pipeline) {
      const source = this.getShader(
        defines,
        this.getShaderOptions(entity, options),
      );
      pipeline = { vertex: source, fragment: source };
      this.pipelineCache.set(key, pipeline);
    }

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
