import { mat3, mat4 } from "pex-math";
import { submit, createTexture, createSampler } from "pex-gpu";
import {
  standardShader,
  STANDARD_MATERIAL_COMMON_FIELDS,
  STANDARD_MATERIAL_FIELDS,
  STANDARD_VERTEX_FIELDS,
  STANDARD_WORKFLOW,
} from "../../shaders/standard.js";
import {
  depthPassShader,
  DEPTH_PASS_ALPHA_VERTEX_FIELDS,
  DEPTH_PASS_MATERIAL_FIELDS,
  DEPTH_PASS_VERTEX_FIELDS,
} from "../../shaders/depth-pass.js";

import createBaseSystem, { outputsKey } from "./base.js";
import { samplerName, uniformName } from "../../shaders/wgsl.js";
import { LIGHT_TYPES } from "../../shaders/light.js";
import { NAMESPACE, TEMP_MAT4, definesKey, hooksKey } from "../../utils.js";

import type { GpuTexture, RenderPipeline, Uniforms } from "pex-gpu";
import type { LightType } from "../../shaders/light.js";
import type { Mat4 } from "pex-math";
import type {
  PipelineShaderOptions,
  Entity,
  LightComponentOptions,
  MaterialComponentOptions,
  MaterialHooks,
  MaterialTexture,
  RendererPassOptions,
  RendererSystem,
  RenderView,
  Shadow2DLightComponentOptions,
  ShadowCastingLightComponentOptions,
  LightShadow,
  SystemOptions,
  TextureTransform,
} from "../../types.js";

/**
 * A light the frame declared no shadow for. The struct members still have to
 * pack, and `castShadows: 0` is what makes the shader skip them.
 */
const NO_SHADOW: LightShadow = {
  cubemap: false,
  bucket: 0,
  layer: 0,
  near: 0,
  far: 0,
  radiusUV: [0, 0],
  projectionMatrix: mat4.create(),
  texture: undefined,
};

/** Where each type's lights sit in the shared buffer. */
type LightRanges = Record<LightType, { offset: number; count: number }>;

/**
 * `@group(1)` values. The lights are an array of structs and the ranges a
 * struct of structs — shapes pex-gpu's packer takes but its `PackableValue`
 * does not spell.
 */
type LightUniforms = Record<
  string,
  Uniforms[string] | Uniforms[] | LightRanges
>;

/** A depth-only draw's shader variant, plus what an alpha-testing one binds. */
interface DepthPassMaterial {
  defines: Set<string>;
  hooks?: MaterialHooks | undefined;
  uniforms?: Uniforms;
  texCoords?: Record<string, number>;
}

/** `@group(1)` bindings for the pass's lights, plus what the shader keys on. */
interface StandardLights {
  uniforms: LightUniforms;
  /** Distinct shadow map sizes, each one texture binding — so a variant each. */
  shadow2DBuckets: number;
  shadowCubeBuckets: number;
  /** Whether the pass has any area light, which gates the LTC evaluation. */
  area: boolean;
}

/**
 * The pipeline's pass options plus what this renderer works out once per pass.
 * Handed to every pipeline hook so none of them reads renderer state left over
 * from the pass before.
 */
interface StandardPassOptions extends RendererPassOptions {
  lights: StandardLights;
}

// Texture-typed material slots, precomputed once (not per draw) for the
// texCoord bookkeeping in getShaderOptions()/getVariantKey().
const TEXTURE_KEYS = STANDARD_MATERIAL_FIELDS.filter(
  (field) => field.texture,
).map((field) => field.key);

// Material texture slots the depth pass samples — only what feeds the alpha
// test, since nothing else about a surface reaches a depth-only draw.
const DEPTH_PASS_TEXTURE_KEYS = ["baseColorTexture", "alphaTexture"];

// Which UV set each texture slot samples, keyed the way the shader generators
// ask for it: slot name minus the "Texture" suffix (see getTexCoordGetter).
// Absent means set 0, so only non-zero assignments are carried.
function getTexCoords(
  material: MaterialComponentOptions,
  keys: readonly string[],
): Record<string, number> {
  const textures = material as Record<string, MaterialTexture | undefined>;
  const texCoords: Record<string, number> = {};
  for (const key of keys) {
    const texCoord = (textures[key] as TextureTransform | undefined)?.texCoord;
    if (texCoord) texCoords[key.replace(/Texture$/, "")] = texCoord;
  }
  return texCoords;
}

// `runtime` defines don't change the WGSL source (see FeatureField.runtime),
// so they're excluded from the variant key to share one pipelineCache entry.
const RUNTIME_DEFINES = new Set(
  STANDARD_MATERIAL_FIELDS.filter((field) => field.runtime && field.define).map(
    (field) => field.define,
  ),
);

// Reused per draw; uniforms pack synchronously at submit().
const NORMAL_MATRIX = mat3.create();
const IDENTITY_MAT3 = mat3.create();

// [r, g, b] stays as authored sRGB; the shader decodes it. The 4th component
// carries the photometric intensity the shader integrates (light.color.w) —
// systems/light.ts converted it from the authored unit.
const lightColor = (light: LightComponentOptions) => [
  light.color![0]!,
  light.color![1]!,
  light.color![2]!,
  light._intensity!,
];

// mat3(transpose(inverse(view * model))). Shared by the main pass and the
// pre-pass so both encode the normal target identically — a reader must not be
// able to tell which one produced it.
function getViewNormalMatrix(viewMatrix: Mat4, modelMatrix: Mat4) {
  mat4.set(TEMP_MAT4, viewMatrix);
  mat4.mult(TEMP_MAT4, modelMatrix);
  mat4.invert(TEMP_MAT4);
  mat4.transpose(TEMP_MAT4);
  return mat3.fromMat4(NORMAL_MATRIX, TEMP_MAT4);
}

// A mesh this renderer owns: `material.type` names another renderer (basic,
// line), and the underscore-prefixed caches only exist once their systems have
// run.
const isStandardMesh = (entity: Entity) =>
  entity.geometry &&
  entity.material &&
  entity.material.type === undefined &&
  entity._geometry &&
  entity._transform;

/**
 * Standard renderer
 *
 * PBR draw path built on pex-shaders' `standard` WGSL generator. Bind group
 * convention: group(0) Frame, group(1) Lights, group(2) Material, group(3)
 * Model.
 */
export default ({
  ctx,
  shadowQuality = 4,
}: SystemOptions & { shadowQuality?: number }): RendererSystem => ({
  ...createBaseSystem(),
  type: "standard-renderer",
  debug: false,
  shadowQuality,
  debugRender: "",

  // Depth-format dummies keeping a shadow bucket binding valid when nothing
  // filled it. Array-dimensioned to match the bindings, which are always arrays.
  dummyTexture2D: createTexture(ctx, {
    label: "dummyShadowMap2D",
    width: 4,
    height: 4,
    depth: 1,
    viewDimension: "2d-array",
    format: "depth32float",
  }),
  dummyTextureCube: createTexture(ctx, {
    label: "dummyShadowMapCube",
    width: 4,
    height: 4,
    depth: 6,
    viewDimension: "cube-array",
    format: "depth32float",
  }),
  // Sampled-float dummy for the reflection probe's uCaptureTexture slot when a
  // material isn't transmissive (a depth dummy can't bind to texture_2d<f32>).
  dummyCaptureTexture: createTexture(ctx, {
    label: "dummyCaptureTexture",
    width: 4,
    height: 4,
    format: "rgba8unorm",
  }),
  // Stands in for the ambient occlusion buffer when nothing produced one. White
  // rather than black: it multiplies the indirect term.
  dummyWhiteTexture: createTexture(ctx, {
    label: "dummyWhiteTexture",
    width: 1,
    height: 1,
    format: "rgba8unorm",
    data: new Uint8Array([255, 255, 255, 255]),
  }),
  // Cube maps use a plain sampler (manual compare); 2D maps use a comparison
  // sampler for hardware PCF.
  shadowSampler: createSampler(ctx, { filter: "nearest" }),
  shadowCompareSampler: createSampler(ctx, {
    filter: "linear",
    compare: "less-equal",
  }),
  // LTC lookup tables need bilinear filtering; addressing defaults to clamp.
  ltcSampler: createSampler(ctx, { filter: "linear" }),
  // Shared by every material texture slot: color space (sRGB vs. linear) is
  // a texture-format decision made at texture creation, not a sampler one.
  materialSampler: createSampler(ctx, {
    filter: "linear",
    addressMode: "repeat",
  }),
  // uCaptureTexture (grabbed opaque color) is trilinear so refraction can sample
  // the roughness-based mip; clamp-to-edge to avoid wrapping at screen borders.
  captureSampler: createSampler(ctx, {
    filter: "linear",
    addressMode: "clamp-to-edge",
  }),
  ltcTextures: { ltc_1: null, ltc_2: null },
  isLoadingAreaLightData: null,

  // Shadow-map variants of the depth pass.
  depthPipelineCache: new Map<string, RenderPipeline>(),
  // Pre-pass variants, cached apart from the shadow ones: the pre-pass never
  // sets depth bias, so a shared entry would keep whatever a shadow draw left.
  prePassPipelineCache: new Map<string, RenderPipeline>(),

  async loadAreaLightData() {
    try {
      const { g_ltc_1, g_ltc_2 } = await import("./area-light-data.js");
      const options = { width: 64, height: 64, format: "rgba16float" as const };
      this.ltcTextures.ltc_1 = createTexture(ctx, {
        label: "areaLightMatTexture",
        data: g_ltc_1,
        ...options,
      });
      this.ltcTextures.ltc_2 = createTexture(ctx, {
        label: "areaLightMagTexture",
        data: g_ltc_2,
        ...options,
      });
    } catch (error) {
      console.error(NAMESPACE, error);
    }
  },

  getShader: (defines: Set<string>, options: PipelineShaderOptions) =>
    standardShader(defines, options),
  getShaderOptions(entity: Entity, options: StandardPassOptions) {
    return {
      shadow2DBuckets: options.lights.shadow2DBuckets,
      shadowCubeBuckets: options.lights.shadowCubeBuckets,
      outputs: options.outputs,
      texCoords: getTexCoords(entity.material!, TEXTURE_KEYS),
      hooks: entity.material!.hooks,
      debugRender: this.debugRender,
    };
  },
  getMaterialDefines(entity: Entity) {
    const material = entity.material!;
    const unlit = this.isUnlit(entity);
    const defines = new Set<string>();

    if (unlit) {
      defines.add(STANDARD_WORKFLOW.unlit);
    } else {
      const useSpecularGlossiness = !!(
        material.sgDiffuse ||
        material.sgSpecular ||
        material.sgGlossiness
      );
      defines.add(
        useSpecularGlossiness
          ? STANDARD_WORKFLOW.specularGlossiness
          : STANDARD_WORKFLOW.metallicRoughness,
      );
      defines.add("USE_NORMALS");
    }

    return this.getFeatureFlags(
      material,
      unlit ? STANDARD_MATERIAL_COMMON_FIELDS : STANDARD_MATERIAL_FIELDS,
      defines,
      this.materialSampler,
    );
  },
  getDefines(
    entity: Entity,
    options: StandardPassOptions,
    materialFeatures?: { defines: Set<string> },
  ) {
    const { defines } = materialFeatures ?? this.getMaterialDefines(entity);

    this.getFeatureFlags(
      entity._geometry!.attributes,
      STANDARD_VERTEX_FIELDS,
      defines,
    );

    if (options.reflectionProbe && !this.isUnlit(entity)) {
      defines.add("USE_REFLECTION_PROBES");
    }

    return defines;
  },
  getVariantKey(
    entity: Entity,
    defines: Set<string>,
    options: StandardPassOptions,
  ) {
    const material = entity.material!;
    const textures = material as Record<string, MaterialTexture | undefined>;
    // texCoord assignments are baked into the WGSL (see getShaderOptions), so
    // two materials with the same defines but different UV channels per slot
    // need distinct pipeline variants.
    const texCoords = TEXTURE_KEYS.map(
      (key) => (textures[key] as TextureTransform | undefined)?.texCoord ?? 0,
    ).join("");
    return [
      definesKey(defines.difference(RUNTIME_DEFINES)),
      // The scene's lights are absent from the key: they live in one buffer
      // whose per-type ranges are uniform data. Shadow buckets are not — they
      // are texture bindings, which cannot be an array of bindings.
      options.lights.shadow2DBuckets,
      options.lights.shadowCubeBuckets,
      options.reflectionProbe ? 1 : 0,
      outputsKey(options.outputs),
      texCoords,
      // Both change the generated WGSL: the hooks by their own source (hashed,
      // so materials sharing hook text share a pipeline), debugRender by the
      // expression it writes over the result.
      hooksKey(material.hooks),
      this.debugRender,
    ].join("_");
  },
  isUnlit(entity: Entity) {
    return entity.material!.unlit || !entity._geometry!.attributes.normal;
  },
  getPipelineOptions(
    entity: Entity,
    options: StandardPassOptions,
    precomputed?: { constants?: Record<string, boolean> },
  ) {
    const material = entity.material!;
    const blend = this.getPipelineBlend(material.blend);
    // A cutout resolved as coverage instead of discarded. Only when the
    // attachment is multisampled — with one sample there is no mask to write,
    // and blended materials derive their alpha from opacity already.
    const alphaToCoverage =
      !!options.multisampled && material.alphaCutoff !== undefined && !blend;

    return {
      // Always assigned, never spread away when false: getPipeline() refreshes
      // the cached pipeline object with Object.assign, so an omitted key leaves
      // the previous draw's value in place — turning MSAA off would keep
      // coverage enabled on a single-sample pass, and an opaque material sharing
      // a variant with a blended one would inherit its blend state.
      alphaToCoverage,
      blend,
      depthWriteEnabled: material.depthWriteEnabled ?? !blend,
      depthCompare: material.depthCompare ?? "less-equal",
      cullMode: options.cullMode ?? material.cullMode ?? "back",
      topology: entity._geometry!.topology ?? "triangle-list",
      // A negative-determinant node transform (e.g. a negative scale) mirrors
      // space and reverses triangle winding — per spec, front-facing flips
      // from CCW to CW along with it.
      frontFace:
        mat4.determinant(entity._transform!.modelMatrix) < 0 ? "cw" : "ccw",
      constants: {
        USE_MSAA: !!options.msaa,
        USE_ALPHA_TO_COVERAGE: alphaToCoverage,
        USE_BLEND: !!blend,
        USE_SSAO_TEXTURE: !!options.textures?.["ssao.main"],
        USE_BENT_NORMALS: !!options.textures?.["ssao.bentNormal"],
        // Matched on the equation rather than on a preset name, so a
        // hand-written GPUBlendState expecting premultiplied color gets it too.
        PREMULTIPLY_ALPHA:
          blend?.color?.srcFactor === "one" &&
          blend?.color?.dstFactor === "one-minus-src-alpha",
        // Per-material activation for `runtime` fields (see FeatureField.runtime).
        ...precomputed?.constants,
        // SHADOW_QUALITY/ROUGHNESS_LEVELS only exist in the lit (non-unlit) shader.
        ...(this.isUnlit(entity)
          ? {}
          : {
              SHADOW_QUALITY: material.receiveShadows ? this.shadowQuality : 0,
              // Not a variant: the LTC evaluation is large enough to be worth
              // compiling out, but its bindings are declared either way.
              USE_AREA_LIGHTS: options.lights.area,
              // A pre-baked probe (EXT_lights_image_based) reports its own
              // native mip count instead of the baked default (see
              // shaders/reflection-probe.ts ROUGHNESS_LEVELS).
              ...(options.reflectionProbe && {
                ROUGHNESS_LEVELS: options.reflectionProbe.roughnessLevels,
              }),
            }),
      },
    };
  },

  // Builds the @group(1) values: every light of every type in one buffer, the
  // per-type ranges into it, and one texture binding per shadow bucket.
  gatherLights(entities: Entity[], scope: string): StandardLights {
    const ambient = entities.filter((e) => e.ambientLight);
    const directional = entities.filter((e) => e.directionalLight);
    const point = entities.filter((e) => e.pointLight);
    const spot = entities.filter((e) => e.spotLight);
    const area = entities.filter((e) => e.areaLight);

    if (area.length && !this.isLoadingAreaLightData) {
      this.isLoadingAreaLightData = true;
      this.loadAreaLightData();
    }
    const ltcReady = this.ltcTextures.ltc_1 && this.ltcTextures.ltc_2;
    const areaActive = ltcReady ? area : [];

    const uniforms: LightUniforms = {};

    // Shadow maps are array layers in size-bucketed textures, so a light
    // contributes its bucket and layer rather than a binding of its own. The
    // bucket textures are collected here in index order, which is the order the
    // shader's dispatcher expects.
    const shadowBuckets: {
      textures2D: (GpuTexture | undefined)[];
      texturesCube: (GpuTexture | undefined)[];
    } = {
      textures2D: [],
      texturesCube: [],
    };
    // A light's map is fitted to the casters of one camera layer, so the shadow
    // is looked up by the scope the pipeline is drawing — not flat on the
    // component, which a light seen by several layers would overwrite.
    const shadowOf = (light: ShadowCastingLightComponentOptions): LightShadow =>
      light._shadows?.get(scope) ?? NO_SHADOW;

    // Struct fields every light type carries, whatever the map's
    // dimensionality. Registering the texture is a side effect of asking for
    // them, so a bucket only exists once some light points at it.
    const shadowSlot = (
      light: ShadowCastingLightComponentOptions,
      shadow: LightShadow,
      cube: boolean,
    ) => {
      const map = light.castShadows ? shadow.texture : undefined;
      if (map) {
        (cube ? shadowBuckets.texturesCube : shadowBuckets.textures2D)[
          shadow.bucket
        ] = map;
      }
      return {
        castShadows: map ? 1 : 0,
        shadowBucket: map ? shadow.bucket : 0,
        shadowLayer: map ? shadow.layer : 0,
        shadowMapSize: map ? [map.width, map.height] : [0, 0],
      };
    };

    // The 2D projection fields on top, shared by directional/spot/area. The
    // projection comes from the shadow too: it is the one the map was rendered
    // with, and sampling with any other misaligns the comparison.
    const shadow2D = (light: ShadowCastingLightComponentOptions) => {
      const shadow = shadowOf(light);
      return {
        ...shadowSlot(light, shadow, false),
        projectionMatrix: shadow.projectionMatrix,
        near: shadow.near,
        far: shadow.far,
        radiusUV: shadow.radiusUV,
      };
    };

    // One entry per light, in LIGHT_TYPES order, each filling only the members
    // of the union its own type reads — the allocator zeroes the rest.
    const byType: Record<LightType, Uniforms[]> = {
      ambient: ambient.map((e) => ({ color: lightColor(e.ambientLight!) })),

      directional: directional.map((e) => {
        const light = e.directionalLight!;
        return {
          direction: light._direction!,
          color: lightColor(light),
          viewMatrix: light._viewMatrix!,
          ...shadow2D(light),
        };
      }),

      point: point.map((e) => {
        const light = e.pointLight!;
        const shadow = shadowOf(light);
        return {
          position: e._transform!.worldPosition,
          color: lightColor(light),
          invSqrFalloff: light._invSqrFalloff!,
          depthBiasNormalized: light.depthBiasNormalized ?? 0,
          radius: light.bulbRadius ?? 0,
          // Normalizes the stored/compared radial distance (shadow-mapping.ts
          // writes length(view)/far into the cube).
          far: shadow.far,
          ...shadowSlot(light, shadow, true),
        };
      }),

      spot: spot.map((e) => {
        const light = e.spotLight!;
        return {
          position: e._transform!.worldPosition,
          direction: light._direction!,
          color: lightColor(light),
          innerConeAngle: light.innerConeAngle!,
          outerConeAngle: light.outerConeAngle!,
          invSqrFalloff: light._invSqrFalloff!,
          viewMatrix: light._viewMatrix!,
          ...shadow2D(light),
        };
      }),

      area: areaActive.map((e) => {
        const light = e.areaLight!;
        return {
          position: e.transform!.position!,
          color: lightColor(light),
          rotation: e.transform!.rotation!,
          size: [e.transform!.scale![0]! / 2, e.transform!.scale![1]! / 2],
          disk: light.disk ? 1 : 0,
          doubleSided: light.doubleSided ? 1 : 0,
          viewMatrix: light._viewMatrix!,
          ...shadow2D(light),
        };
      }),
    };

    const lights: Uniforms[] = [];
    const ranges = {} as LightRanges;
    for (const type of LIGHT_TYPES) {
      ranges[type] = { offset: lights.length, count: byType[type].length };
      lights.push(...byType[type]);
    }
    uniforms.uLights = lights;
    uniforms.uLightRanges = ranges;

    // Declared by every lit material whether or not the scene has an area
    // light, so a dummy stands in until the tables finish loading.
    // USE_AREA_LIGHTS is false until then, so nothing samples it.
    uniforms.uLtc1 = this.ltcTextures.ltc_1 ?? this.dummyWhiteTexture;
    uniforms[samplerName("uLtc1")] = this.ltcSampler;
    uniforms.uLtc2 = this.ltcTextures.ltc_2 ?? this.dummyWhiteTexture;
    uniforms[samplerName("uLtc2")] = this.ltcSampler;

    // A bucket with no caster in it cannot happen — indices are handed out as
    // casters are found — but a light that stopped casting mid-frame leaves a
    // hole, so the dummy keeps the binding valid rather than the draw failing.
    for (let i = 0; i < shadowBuckets.textures2D.length; i++) {
      const name = uniformName(`shadowMaps2D${i}`);
      uniforms[name] = shadowBuckets.textures2D[i] ?? this.dummyTexture2D;
      uniforms[samplerName(name)] = this.shadowCompareSampler;
    }
    for (let i = 0; i < shadowBuckets.texturesCube.length; i++) {
      const name = uniformName(`shadowMapsCube${i}`);
      uniforms[name] = shadowBuckets.texturesCube[i] ?? this.dummyTextureCube;
      uniforms[samplerName(name)] = this.shadowSampler;
    }

    return {
      uniforms,
      shadow2DBuckets: shadowBuckets.textures2D.length,
      shadowCubeBuckets: shadowBuckets.texturesCube.length,
      area: areaActive.length > 0,
    };
  },

  inputs({ transparent, transmitted }: RendererPassOptions = {}) {
    if (transmitted) return ["transmission.grab"];
    // "ssao.bentNormal" is the same texture under a second name, published only
    // when its remaining channels carry one — which is the only thing that tells
    // a reader whether they can be decoded.
    return transparent ? [] : ["ssao.main", "ssao.bentNormal"];
  },

  render(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions,
  ) {
    const {
      transparent,
      transmitted,
      cullMode,
      textures = {},
      frameIndex = NaN,
      reflectionProbe,
    } = options;

    // Gathered once for the pass and carried alongside the pipeline's own
    // options, so the hooks below read one object rather than fields left on
    // the renderer by whichever pass ran last.
    const passOptions: StandardPassOptions = {
      ...options,
      lights: this.gatherLights(entities, options.shadowScope ?? ""),
    };

    // Scene-global IBL: the reflection probe system bakes SH + a prefiltered
    // cubemap onto the probe entity; the pipeline picks the one this view
    // sees. Presence drives USE_REFLECTION_PROBES
    // (see getDefines/getVariantKey); the bindings below feed EvaluateLightProbe.
    const velocity = !!options.outputs?.velocity;

    const reflectionUniforms = reflectionProbe
      ? {
          uReflectionProbe: {
            rotation: reflectionProbe.rotation ?? IDENTITY_MAT3,
            intensity: reflectionProbe.intensity ?? 1,
          },
          uSpecularEnvMap: reflectionProbe.specularTexture,
          uSpecularEnvMapSampler: reflectionProbe.sampler,
          uIrradianceCoefficients: reflectionProbe.irradianceCoefficients,
        }
      : undefined;

    const captureUniforms = {
      uCaptureTexture:
        textures["transmission.grab"] || this.dummyCaptureTexture,
      uCaptureTextureSampler: this.captureSampler,
      uAOTexture: textures["ssao.main"] || this.dummyWhiteTexture,
      uAOTextureSampler: this.captureSampler,
    };

    const uFrame = this.getFrameUniforms(renderView);

    const renderableEntities = entities.filter(
      (e) =>
        isStandardMesh(e) &&
        (transmitted
          ? cullMode === "front"
            ? e.material!.cullMode === "none" && e.material!.transmission
            : e.material!.transmission
          : !e.material!.transmission) &&
        (transparent ? e.material!.blend : !e.material!.blend),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i]!;
      // Computed once for this entity/draw and threaded through getPipeline
      // (defines) below, instead of recomputing the material feature walk.
      const materialFeatures = this.getMaterialDefines(entity);
      const pipeline = this.getPipeline(entity, passOptions, materialFeatures);

      const materialUniforms = materialFeatures.uniforms;
      materialUniforms.uMaterial.baseColor = entity.material!.baseColor!;

      // The same options shaders/standard.ts generated modelStruct with, so the
      // block matches the struct. getDefines has folded the vertex-attribute
      // defines into materialFeatures by now, which is where USE_SKIN comes
      // from on both sides.
      const modelStructOptions = {
        previousModelMatrix: velocity,
        skin: materialFeatures.defines.has("USE_SKIN"),
        previousSkin: velocity,
      };

      submit(ctx, {
        label: transparent
          ? "drawTransparentGeometryCmd"
          : "drawOpaqueGeometryCmd",
        pipeline,
        attributes: entity._geometry!.attributes,
        indices: entity._geometry!.indices,
        count: entity._geometry!.count,
        instanceCount: entity._geometry!.instanceCount,
        uniforms: {
          uFrame,
          ...this.getModelUniforms(
            entity,
            getViewNormalMatrix(
              uFrame.viewMatrix,
              entity._transform!.modelMatrix,
            ),
            modelStructOptions,
          ),
          ...materialUniforms,
          ...(passOptions.lights.uniforms as Uniforms),
          ...reflectionUniforms,
          ...captureUniforms,
          ...this.getHookUniforms(entity, frameIndex, this.materialSampler),
        },
      });
    }
  },
  renderOpaque(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions,
  ) {
    this.render(renderView, entities, { ...options, transparent: false });
  },
  renderTransparent(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions,
  ) {
    this.render(renderView, entities, { ...options, transparent: true });
  },
  /**
   * Defines and material uniforms for one depth-pass draw.
   *
   * Position-affecting features always; everything else only when the material
   * alpha tests, which is the one thing that makes a depth-only draw care what
   * a surface looks like. `texCoords` mirrors what the main pass resolved so
   * both sample the same UV set.
   */
  getDepthPassMaterial(entity: Entity): DepthPassMaterial {
    const { attributes } = entity._geometry!;
    const defines = new Set<string>();
    this.getFeatureFlags(attributes, DEPTH_PASS_VERTEX_FIELDS, defines);

    // Vertex hooks run here too: a hook that displaces a vertex has to displace
    // it identically in every pass, or the surface casts a shadow it does not
    // occupy and the pre-pass lays down depth the opaque pass cannot match.
    // Displacing along the normal is the common case, and this pass otherwise
    // only fetches one when it writes one, so a vertex hook asks for it.
    const { hooks } = entity.material!;
    if (
      (hooks?.vertBeforeTransform ||
        hooks?.vertDeclarationsEnd ||
        hooks?.vertEnd) &&
      attributes.normal
    ) {
      defines.add("USE_NORMALS");
    }

    if (entity.material!.alphaCutoff === undefined) return { defines, hooks };

    this.getFeatureFlags(attributes, DEPTH_PASS_ALPHA_VERTEX_FIELDS, defines);
    const { uniforms } = this.getFeatureFlags(
      entity.material!,
      DEPTH_PASS_MATERIAL_FIELDS,
      defines,
      this.materialSampler,
    );
    return {
      defines,
      hooks,
      uniforms,
      texCoords: getTexCoords(entity.material!, DEPTH_PASS_TEXTURE_KEYS),
    };
  },

  // Shared by shadow maps and the pre-pass, which differ only in the defines
  // they add before this and the depth bias they set after it.
  getDepthPassPipeline(
    entity: Entity,
    cache: Map<string, RenderPipeline>,
    material: DepthPassMaterial,
  ) {
    const { defines, texCoords, hooks } = material;
    // texCoords picks which UV set the alpha test samples, so it varies the
    // source the same way a define does.
    const key = [
      definesKey(defines),
      JSON.stringify(texCoords ?? {}),
      hooksKey(hooks),
    ].join("_");
    const pipeline = cache.getOrInsertComputed(key, () => {
      const shader = depthPassShader(defines, {
        ...(texCoords && { texCoords }),
        ...(hooks && { hooks }),
      });
      // Depth comes out of the rasterizer, so a fragment stage exists only when
      // one of the variants needs it: to reject, to write radial distance, or
      // to fill the normal target.
      return ["USE_ALPHA_CUTOFF", "USE_LINEAR_DEPTH", "USE_NORMAL_OUTPUT"].some(
        (define) => defines.has(define),
      )
        ? { vertex: shader, fragment: shader }
        : { vertex: shader };
    });
    pipeline.depthWriteEnabled = true;
    pipeline.cullMode = entity.material!.cullMode ?? "back";
    pipeline.topology = entity._geometry!.topology ?? "triangle-list";
    pipeline.frontFace =
      mat4.determinant(entity._transform!.modelMatrix) < 0 ? "cw" : "ccw";
    return pipeline;
  },

  // `linear` selects the omni (point) variant: a fragment stage stores
  // normalized radial distance instead of clip depth. Rasterizer depth bias is
  // skipped there (frag_depth bypasses it; the point shader biases its compare).
  getDepthPipeline(
    entity: Entity,
    linear: boolean,
    light: ShadowCastingLightComponentOptions | undefined,
    material: DepthPassMaterial,
  ) {
    if (linear) material.defines.add("USE_LINEAR_DEPTH");

    const pipeline = this.getDepthPassPipeline(
      entity,
      this.depthPipelineCache,
      material,
    );
    if (linear) {
      // The cube-face projection is Y-flipped to match the depth-cube sampler
      // (see shadow-mapping.ts), which reverses winding; skip culling so the flip
      // can't drop caster faces.
      pipeline.cullMode = "none";
      pipeline.depthBias = 0;
      pipeline.depthBiasSlopeScale = 0;
      pipeline.depthBiasClamp = 0;
    } else {
      // Rasterizer depth bias replaces shader-side shadow bias: a constant term
      // plus the slope-scaled term (handles grazing angles), optionally clamped.
      // Point lights take the branch above, carrying `depthBiasNormalized`.
      const bias = light as Shadow2DLightComponentOptions | undefined;
      pipeline.depthBias = bias?.depthBias ?? 1;
      pipeline.depthBiasSlopeScale = bias?.depthBiasSlopeScale ?? 2;
      pipeline.depthBiasClamp = bias?.depthBiasClamp ?? 0;
    }
    return pipeline;
  },

  getPrePassPipeline(
    entity: Entity,
    normalOutput: boolean,
    multisampled: boolean,
    material: DepthPassMaterial,
  ) {
    if (entity._geometry!.attributes.normal)
      material.defines.add("USE_NORMALS");
    if (normalOutput) material.defines.add("USE_NORMAL_OUTPUT");
    // Drops the shadow map's displacement stretch: this pass has to land on the
    // same depth the opaque pass computes, not a biased one.
    material.defines.add("USE_DEPTH_PRE_PASS");

    // Same cutout treatment as the opaque pass, for the same reason: discarding
    // into a multisampled attachment is what this avoids, and the two passes
    // have to keep the same samples either way.
    const alphaToCoverage =
      multisampled && normalOutput && material.defines.has("USE_ALPHA_CUTOFF");
    if (alphaToCoverage) material.defines.add("USE_ALPHA_TO_COVERAGE");

    const pipeline = this.getDepthPassPipeline(
      entity,
      this.prePassPipelineCache,
      material,
    );
    pipeline.alphaToCoverage = alphaToCoverage;
    // Loads the depth the pass itself is laying down, one draw after another.
    pipeline.depthCompare = "less-equal";
    return pipeline;
  },

  /**
   * Depth (and optionally view-space normal) ahead of shading.
   *
   * Draws exactly what the opaque pass will, so the depth it leaves behind is
   * what that pass tests against — anything drawn here and not there would
   * occlude geometry that should be visible. Alpha-tested materials included:
   * the shader recomputes the same opacity and discards on the same threshold.
   */
  renderPrePass(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions = {},
  ) {
    const normalOutput = !!options.outputs?.normal;
    const multisampled = !!options.multisampled;
    const frameIndex = options.frameIndex ?? NaN;
    const uFrame = this.getFrameUniforms(renderView);

    // A depth-only multisampled pre-pass has no way to express a cutout:
    // coverage needs a colour target to take alpha from, and discarding into a
    // multisampled attachment is what this change exists to avoid. Sitting the
    // pass out costs those materials their early-Z — the opaque pass still
    // writes their depth — which is the cheap half of the trade.
    const skipAlphaTested = multisampled && !normalOutput;

    const drawable = entities.filter(
      (e) =>
        isStandardMesh(e) &&
        !e.material!.transmission &&
        !e.material!.blend &&
        e.material!.depthWriteEnabled !== false &&
        (!skipAlphaTested || e.material!.alphaCutoff === undefined),
    );

    for (let i = 0; i < drawable.length; i++) {
      const entity = drawable[i]!;
      const material = this.getDepthPassMaterial(entity);
      submit(ctx, {
        label: "drawPrePassGeometryCmd",
        pipeline: this.getPrePassPipeline(
          entity,
          normalOutput,
          multisampled,
          material,
        ),
        attributes: entity._geometry!.attributes,
        indices: entity._geometry!.indices,
        count: entity._geometry!.count,
        instanceCount: entity._geometry!.instanceCount,
        uniforms: {
          uFrame,
          ...this.getModelUniforms(
            entity,
            getViewNormalMatrix(
              uFrame.viewMatrix,
              entity._transform!.modelMatrix,
            ),
            { skin: material.defines.has("USE_SKIN") },
          ),
          ...material.uniforms,
          ...this.getHookUniforms(entity, frameIndex, this.materialSampler),
        },
      });
    }
  },

  // Depth-only pass into a light's shadow map. renderView.camera carries the
  // light's projection/view matrices; point lights (cubemap) store normalized
  // radial distance and need the light's far plane in uFrame.
  renderShadow(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions = {},
  ) {
    const light = options.shadowMappingLight;
    const shadow = options.lightShadow;
    const linear = !!shadow?.cubemap;
    const frameIndex = options.frameIndex ?? NaN;

    const uFrame = {
      ...this.getFrameUniforms(renderView),
      // The view origin is the light, not a camera entity.
      cameraPosition: [0, 0, 0],
      ...(linear && { far: shadow!.far }),
    };

    const casters = entities.filter(
      (e) => isStandardMesh(e) && e.material!.castShadows,
    );

    for (let i = 0; i < casters.length; i++) {
      const entity = casters[i]!;
      const material = this.getDepthPassMaterial(entity);
      submit(ctx, {
        label: "drawShadowGeometryCmd",
        pipeline: this.getDepthPipeline(entity, linear, light, material),
        attributes: entity._geometry!.attributes,
        indices: entity._geometry!.indices,
        count: entity._geometry!.count,
        instanceCount: entity._geometry!.instanceCount,
        uniforms: {
          uFrame,
          // World-space: nothing in this pass reads the normal, but the binding
          // is part of the shared Model struct.
          ...this.getModelUniforms(
            entity,
            mat3.fromMat4(NORMAL_MATRIX, entity._transform!.modelMatrix),
            { skin: material.defines.has("USE_SKIN") },
          ),
          ...material.uniforms,
          ...this.getHookUniforms(entity, frameIndex, this.materialSampler),
        },
      });
    }
  },
  dispose() {
    this.dummyWhiteTexture.dispose();
    this.dummyTexture2D.dispose();
    this.dummyTextureCube.dispose();
    this.dummyCaptureTexture.dispose();
    this.ltcTextures.ltc_1?.dispose();
    this.ltcTextures.ltc_2?.dispose();
    this.ltcTextures.ltc_1 = null;
    this.ltcTextures.ltc_2 = null;
    this.isLoadingAreaLightData = null;
    this.pipelineCache.clear();
    this.depthPipelineCache.clear();
    this.prePassPipelineCache.clear();
  },
});
