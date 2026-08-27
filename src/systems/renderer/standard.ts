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

import createBaseSystem, { BLEND_MODES, outputsKey } from "./base.js";
import { samplerName, uniformName } from "../../shaders/wgsl.js";
import { NAMESPACE, TEMP_MAT4, definesKey } from "../../utils.js";

import type {
  BlendMode,
  Entity,
  RendererSystem,
  RenderView,
  SystemOptions,
} from "../../types.js";

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
  material: any,
  keys: readonly string[],
): Record<string, number> {
  const texCoords: Record<string, number> = {};
  for (const key of keys) {
    const texCoord = material[key]?.texCoord;
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
const IDENTITY_MAT4 = mat4.create();

// Matches wgsl.ts modelStruct's default maxJoints (the uJointMatrices array
// is a fixed-size WGSL binding, unlike the light arrays which size to the
// real count via defines).
const MAX_JOINTS = 256;

// [r, g, b] stays as authored sRGB; the shader decodes it. The 4th component
// carries intensity (light.color.w), matching the WGSL light chunks.
const lightColor = (light: any) => [
  light.color[0],
  light.color[1],
  light.color[2],
  light.intensity,
];

// uJointMatrices is a fixed-length array<mat4x4f, MAX_JOINTS> binding, so the
// uniform value must always be exactly that length — pad with identity past
// the skin's own joint count. Cached on the skin component: `jointMatrices`'
// entries are mutated in place by systems/skin.ts each frame, so the padded
// wrapper (built from the same references) stays valid without rebuilding.
function getJointMatricesUniform(skin: any): any[] {
  if (!skin._paddedJointMatrices) {
    const padded = new Array(MAX_JOINTS);
    for (let i = 0; i < MAX_JOINTS; i++) {
      padded[i] = skin.jointMatrices[i] ?? IDENTITY_MAT4;
    }
    skin._paddedJointMatrices = padded;
  }
  return skin._paddedJointMatrices;
}

// mat3(transpose(inverse(view * model))). Shared by the main pass and the
// pre-pass so both encode the normal target identically — a reader must not be
// able to tell which one produced it.
function getViewNormalMatrix(viewMatrix: any, modelMatrix: any) {
  mat4.set(TEMP_MAT4, viewMatrix);
  mat4.mult(TEMP_MAT4, modelMatrix);
  mat4.invert(TEMP_MAT4);
  mat4.transpose(TEMP_MAT4);
  return mat3.fromMat4(NORMAL_MATRIX, TEMP_MAT4);
}

// The @group(3) bindings, identical in every pass that draws geometry.
const modelUniforms = (entity: any, normalMatrix: any) => ({
  uModel: { modelMatrix: entity._transform.modelMatrix, normalMatrix },
  ...(entity.skin && {
    uJointMatrices: getJointMatricesUniform(entity.skin),
  }),
});

// A mesh this renderer owns: `material.type` names another renderer (basic,
// line), and the underscore-prefixed caches only exist once their systems have
// run.
const isStandardMesh = (entity: any) =>
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
  depthPipelineCache: new Map(),
  // Pre-pass variants, cached apart from the shadow ones: the pre-pass never
  // sets depth bias, so a shared entry would keep whatever a shadow draw left.
  prePassPipelineCache: new Map(),

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

  getShader: (defines: Set<string>, options: any) =>
    standardShader(defines, options),
  getShaderOptions(entity: any) {
    const { _lights, _outputs } = this;
    return {
      lights: _lights.counts,
      outputs: _outputs,
      texCoords: getTexCoords(entity.material, TEXTURE_KEYS),
    };
  },
  getMaterialDefines(entity: any) {
    const { material } = entity;
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
    entity: any,
    _options?: any,
    materialFeatures?: { defines: Set<string> },
  ) {
    const { defines } = materialFeatures ?? this.getMaterialDefines(entity);

    this.getFeatureFlags(
      entity._geometry.attributes,
      STANDARD_VERTEX_FIELDS,
      defines,
    );

    if (this._reflectionProbe && !this.isUnlit(entity)) {
      defines.add("USE_REFLECTION_PROBES");
    }

    return defines;
  },
  getVariantKey(entity: any, defines: Set<string>) {
    const { material } = entity;
    const { counts } = this._lights;
    // texCoord assignments are baked into the WGSL (see getShaderOptions), so
    // two materials with the same defines but different UV channels per slot
    // need distinct pipeline variants.
    const texCoords = TEXTURE_KEYS.map(
      (key) => material[key]?.texCoord ?? 0,
    ).join("");
    return [
      definesKey(defines.difference(RUNTIME_DEFINES)),
      // Presence, not count: light arrays are runtime-sized storage buffers, so
      // adding a light writes a buffer instead of compiling a shader. Shadow
      // buckets stay counted — they are texture bindings, which cannot be an
      // array of bindings.
      counts.ambient ? 1 : 0,
      counts.directional ? 1 : 0,
      counts.point ? 1 : 0,
      counts.spot ? 1 : 0,
      counts.area ? 1 : 0,
      counts.shadow2DBuckets,
      counts.shadowCubeBuckets,
      this._reflectionProbe ? 1 : 0,
      outputsKey(this._outputs),
      texCoords,
    ].join("_");
  },
  isUnlit(entity: any) {
    return entity.material.unlit || !entity._geometry.attributes.normal;
  },
  getPipelineOptions(
    entity: any,
    options: any = {},
    precomputed?: { constants?: Record<string, boolean> },
  ) {
    const { material } = entity;
    // A cutout resolved as coverage instead of discarded. Only when the
    // attachment is multisampled — with one sample there is no mask to write,
    // and blended materials derive their alpha from opacity already.
    const alphaToCoverage =
      !!this._multisampled &&
      material.alphaTest !== undefined &&
      !material.blend;

    return {
      // Always assigned, never spread away when false: getPipeline() refreshes
      // the cached pipeline object with Object.assign, so an omitted key leaves
      // the previous draw's value in place — turning MSAA off would keep
      // coverage enabled on a single-sample pass.
      alphaToCoverage,
      depthWriteEnabled: material.depthWrite !== false && !material.blend,
      depthCompare: material.depthTest === false ? "always" : "less-equal",
      cullMode:
        options.cullFaceMode ?? ((material.cullFace ?? true) ? "back" : "none"),
      topology: entity._geometry!.primitive ?? "triangle-list",
      // A negative-determinant node transform (e.g. a negative scale) mirrors
      // space and reverses triangle winding — per spec, front-facing flips
      // from CCW to CW along with it.
      frontFace:
        mat4.determinant(entity._transform!.modelMatrix) < 0 ? "cw" : "ccw",
      ...(material.blend
        ? { blend: BLEND_MODES[(material.blendMode ?? "normal") as BlendMode] }
        : {}),
      constants: {
        USE_MSAA: !!this._msaa,
        USE_ALPHA_TO_COVERAGE: alphaToCoverage,
        USE_BLEND: !!material.blend,
        USE_SSAO_TEXTURE: !!this._textures?.["ssao.main"],
        USE_BENT_NORMALS: !!this._textures?.["ssao.bentNormal"],
        PREMULTIPLY_ALPHA:
          !!material.blend && material.blendMode === "premultiplied",
        // Per-material activation for `runtime` fields (see FeatureField.runtime).
        ...precomputed?.constants,
        // SHADOW_QUALITY/ROUGHNESS_LEVELS only exist in the lit (non-unlit) shader.
        ...(this.isUnlit(entity)
          ? {}
          : {
              SHADOW_QUALITY: material.receiveShadows ? this.shadowQuality : 0,
              // A pre-baked probe (EXT_lights_image_based) reports its own
              // native mip count instead of the baked default (see
              // shaders/reflection-probe.ts ROUGHNESS_LEVELS).
              ...(this._reflectionProbe && {
                ROUGHNESS_LEVELS: this._reflectionProbe.roughnessLevels,
              }),
            }),
      },
    };
  },

  // Builds the @group(1) values: one runtime-sized struct array per light type,
  // plus one texture binding per shadow bucket.
  gatherLights(entities: Entity[]) {
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

    const uniforms: any = {};

    if (ambient.length) {
      uniforms.uAmbientLights = ambient.map((e) => ({
        color: lightColor(e.ambientLight),
      }));
    }

    // Shadow maps are array layers in size-bucketed textures, so a light
    // contributes its bucket and layer rather than a binding of its own. The
    // bucket textures are collected here in index order, which is the order the
    // shader's dispatcher expects.
    const shadowBuckets: { textures2D: any[]; texturesCube: any[] } = {
      textures2D: [],
      texturesCube: [],
    };
    // Struct fields every light type carries, whatever the map's
    // dimensionality. Registering the texture is a side effect of asking for
    // them, so a bucket only exists once some light points at it.
    const shadowSlot = (light: any, map: any, cube: boolean) => {
      if (map) {
        (cube ? shadowBuckets.texturesCube : shadowBuckets.textures2D)[
          light._shadowBucket
        ] = map;
      }
      return {
        castShadows: map ? 1 : 0,
        shadowBucket: map ? light._shadowBucket : 0,
        shadowLayer: map ? light._shadowLayer : 0,
        shadowMapSize: map ? [map.width, map.height] : [0, 0],
      };
    };

    // The 2D projection fields on top, shared by directional/spot/area.
    const shadow2D = (light: any) => ({
      ...shadowSlot(light, light.castShadows ? light._shadowMap : null, false),
      near: light._near ?? 0,
      far: light._far ?? 0,
      radiusUV: light._radiusUV ?? [0, 0],
    });

    if (directional.length) {
      uniforms.uDirectionalLights = directional.map((e) => {
        const light = e.directionalLight!;
        return {
          direction: light._direction,
          color: lightColor(light),
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          ...shadow2D(light),
        };
      });
    }

    if (point.length) {
      uniforms.uPointLights = point.map((e) => {
        const light = e.pointLight!;
        return {
          position: e._transform!.worldPosition,
          color: lightColor(light),
          range: light.range,
          bias: light.bias ?? 0,
          radius: light.bulbRadius ?? 0,
          // Normalizes the stored/compared radial distance (shadow-mapping.ts
          // writes length(view)/far into the cube).
          far: light._far ?? 0,
          ...shadowSlot(
            light,
            light.castShadows ? light._shadowCubemap : null,
            true,
          ),
        };
      });
    }

    if (spot.length) {
      uniforms.uSpotLights = spot.map((e) => {
        const light = e.spotLight!;
        return {
          position: e._transform!.worldPosition,
          direction: light._direction,
          color: lightColor(light),
          innerAngle: light.innerAngle,
          angle: light.angle,
          range: light.range,
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          ...shadow2D(light),
        };
      });
    }

    if (areaActive.length) {
      uniforms.uLtc1 = this.ltcTextures.ltc_1;
      uniforms[samplerName("uLtc1")] = this.ltcSampler;
      uniforms.uLtc2 = this.ltcTextures.ltc_2;
      uniforms[samplerName("uLtc2")] = this.ltcSampler;
      uniforms.uAreaLights = areaActive.map((e) => {
        const light = e.areaLight!;
        return {
          position: e.transform!.position,
          color: lightColor(light),
          rotation: e.transform!.rotation,
          size: [e.transform!.scale![0]! / 2, e.transform!.scale![1]! / 2],
          disk: light.disk ? 1 : 0,
          doubleSided: light.doubleSided ? 1 : 0,
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          ...shadow2D(light),
        };
      });
    }

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
      counts: {
        ambient: ambient.length,
        directional: directional.length,
        point: point.length,
        spot: spot.length,
        area: areaActive.length,
        shadow2DBuckets: shadowBuckets.textures2D.length,
        shadowCubeBuckets: shadowBuckets.texturesCube.length,
      },
    };
  },

  inputs({ transparent, transmitted }: any = {}) {
    if (transmitted) return ["transmission.grab"];
    // "ssao.bentNormal" is the same texture under a second name, published only
    // when its remaining channels carry one — which is the only thing that tells
    // a reader whether they can be decoded.
    return transparent ? [] : ["ssao.main", "ssao.bentNormal"];
  },

  render(renderView: RenderView, entities: Entity[], options: any) {
    const {
      outputs = {},
      msaa,
      multisampled,
      transparent,
      transmitted,
      cullFaceMode,
      textures = {},
    } = options;

    this._msaa = msaa;
    this._multisampled = multisampled;
    this._outputs = outputs;
    this._textures = textures;

    const lights = this.gatherLights(entities);
    this._lights = lights;

    // Scene-global IBL: the reflection probe system bakes SH + a prefiltered
    // cubemap onto the probe entity. Presence drives USE_REFLECTION_PROBES
    // (see getDefines/getVariantKey); the bindings below feed EvaluateLightProbe.
    const probeEntity = entities.find((e) => e._reflectionProbe);
    this._reflectionProbe = probeEntity?._reflectionProbe;
    const reflectionUniforms = this._reflectionProbe
      ? {
          uReflectionProbe: {
            rotation: this._reflectionProbe.rotation ?? IDENTITY_MAT3,
            intensity: this._reflectionProbe.intensity ?? 1,
          },
          uSpecularEnvMap: this._reflectionProbe.specularTexture,
          uSpecularEnvMapSampler: this._reflectionProbe.sampler,
          uIrradianceCoefficients: this._reflectionProbe.irradianceCoefficients,
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
          ? cullFaceMode === "front"
            ? !e.material!.cullFace && e.material!.transmission
            : e.material!.transmission
          : !e.material!.transmission) &&
        (transparent ? e.material!.blend : !e.material!.blend),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i]!;
      // Computed once for this entity/draw and threaded through getPipeline
      // (defines) below, instead of recomputing the material feature walk.
      const materialFeatures = this.getMaterialDefines(entity);
      const pipeline = this.getPipeline(entity, options, materialFeatures);

      const materialUniforms = materialFeatures.uniforms;
      materialUniforms.uMaterial.baseColor = entity.material!.baseColor!;

      submit(ctx, {
        label: transparent
          ? "drawTransparentGeometryCmd"
          : "drawOpaqueGeometryCmd",
        pipeline,
        attributes: entity._geometry!.attributes,
        indices: entity._geometry!.indices,
        count: entity._geometry!.count,
        instanceCount: entity._geometry!.instances,
        uniforms: {
          uFrame,
          ...modelUniforms(
            entity,
            getViewNormalMatrix(
              uFrame.viewMatrix,
              entity._transform!.modelMatrix,
            ),
          ),
          ...materialUniforms,
          ...lights.uniforms,
          ...reflectionUniforms,
          ...captureUniforms,
        },
      });
    }
  },
  renderOpaque(renderView: RenderView, entities: Entity[], options: any) {
    this.render(renderView, entities, { ...options, transparent: false });
  },
  renderTransparent(renderView: RenderView, entities: Entity[], options: any) {
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
  getDepthPassMaterial(entity: any) {
    const { attributes } = entity._geometry;
    const defines = new Set<string>();
    this.getFeatureFlags(attributes, DEPTH_PASS_VERTEX_FIELDS, defines);

    if (entity.material.alphaTest === undefined) return { defines };

    this.getFeatureFlags(attributes, DEPTH_PASS_ALPHA_VERTEX_FIELDS, defines);
    const { uniforms } = this.getFeatureFlags(
      entity.material,
      DEPTH_PASS_MATERIAL_FIELDS,
      defines,
      this.materialSampler,
    );
    return {
      defines,
      uniforms,
      texCoords: getTexCoords(entity.material, DEPTH_PASS_TEXTURE_KEYS),
    };
  },

  // Shared by shadow maps and the pre-pass, which differ only in the defines
  // they add before this and the depth bias they set after it.
  getDepthPassPipeline(entity: any, cache: Map<string, any>, material: any) {
    const { defines, texCoords } = material;
    // texCoords picks which UV set the alpha test samples, so it varies the
    // source the same way a define does.
    const key = `${definesKey(defines)}_${JSON.stringify(texCoords ?? {})}`;
    const pipeline = cache.getOrInsertComputed(key, () => {
      const shader = depthPassShader(defines, { texCoords });
      // Depth comes out of the rasterizer, so a fragment stage exists only when
      // one of the variants needs it: to reject, to write radial distance, or
      // to fill the normal target.
      return ["USE_ALPHA_TEST", "USE_LINEAR_DEPTH", "USE_NORMAL_OUTPUT"].some(
        (define) => defines.has(define),
      )
        ? { vertex: shader, fragment: shader }
        : { vertex: shader };
    });
    pipeline.depthWriteEnabled = true;
    pipeline.cullMode = (entity.material.cullFace ?? true) ? "back" : "none";
    pipeline.topology = entity._geometry.primitive ?? "triangle-list";
    pipeline.frontFace =
      mat4.determinant(entity._transform.modelMatrix) < 0 ? "cw" : "ccw";
    return pipeline;
  },

  // `linear` selects the omni (point) variant: a fragment stage stores
  // normalized radial distance instead of clip depth. Rasterizer depth bias is
  // skipped there (frag_depth bypasses it; the point shader biases its compare).
  getDepthPipeline(entity: any, linear: boolean, light: any, material: any) {
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
      pipeline.depthBias = light?.depthBias ?? 1;
      pipeline.depthBiasSlopeScale = light?.depthBiasSlopeScale ?? 2;
      pipeline.depthBiasClamp = light?.depthBiasClamp ?? 0;
    }
    return pipeline;
  },

  getPrePassPipeline(entity: any, normalOutput: boolean, material: any) {
    if (entity._geometry.attributes.normal) material.defines.add("USE_NORMALS");
    if (normalOutput) material.defines.add("USE_NORMAL_OUTPUT");

    // Same cutout treatment as the opaque pass, for the same reason: discarding
    // into a multisampled attachment is what this avoids, and the two passes
    // have to keep the same samples either way.
    const alphaToCoverage =
      !!this._multisampled &&
      normalOutput &&
      material.defines.has("USE_ALPHA_TEST");
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
  renderPrePass(renderView: RenderView, entities: Entity[], options: any = {}) {
    const normalOutput = !!options.normalOutput;
    const uFrame = this.getFrameUniforms(renderView);

    // A depth-only multisampled pre-pass has no way to express a cutout:
    // coverage needs a colour target to take alpha from, and discarding into a
    // multisampled attachment is what this change exists to avoid. Sitting the
    // pass out costs those materials their early-Z — the opaque pass still
    // writes their depth — which is the cheap half of the trade.
    const skipAlphaTested = !!this._multisampled && !normalOutput;

    const drawable = entities.filter(
      (e) =>
        isStandardMesh(e) &&
        !e.material!.transmission &&
        !e.material!.blend &&
        e.material!.depthWrite !== false &&
        !(skipAlphaTested && e.material!.alphaTest !== undefined),
    );

    for (let i = 0; i < drawable.length; i++) {
      const entity = drawable[i]!;
      const material = this.getDepthPassMaterial(entity);
      submit(ctx, {
        label: "drawPrePassGeometryCmd",
        pipeline: this.getPrePassPipeline(entity, normalOutput, material),
        attributes: entity._geometry!.attributes,
        indices: entity._geometry!.indices,
        count: entity._geometry!.count,
        instanceCount: entity._geometry!.instances,
        uniforms: {
          uFrame,
          ...modelUniforms(
            entity,
            getViewNormalMatrix(
              uFrame.viewMatrix,
              entity._transform!.modelMatrix,
            ),
          ),
          ...material.uniforms,
        },
      });
    }
  },

  // Depth-only pass into a light's shadow map. renderView.camera carries the
  // light's projection/view matrices; point lights (cubemap) store normalized
  // radial distance and need the light's far plane in uFrame.
  renderShadow(renderView: RenderView, entities: Entity[], options: any = {}) {
    const light = options.shadowMappingLight;
    const linear = !!light?._shadowCubemap;

    const uFrame = {
      ...this.getFrameUniforms(renderView),
      // The view origin is the light, not a camera entity.
      cameraPosition: [0, 0, 0],
      ...(linear && { far: light._far }),
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
        instanceCount: entity._geometry!.instances,
        uniforms: {
          uFrame,
          // World-space: nothing in this pass reads the normal, but the binding
          // is part of the shared Model struct.
          ...modelUniforms(
            entity,
            mat3.fromMat4(NORMAL_MATRIX, entity._transform!.modelMatrix),
          ),
          ...material.uniforms,
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
