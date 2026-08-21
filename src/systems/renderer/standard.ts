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
  DEPTH_PASS_VERTEX_FIELDS,
} from "../../shaders/depth-pass.js";

import createBaseSystem, { BLEND_MODES } from "./base.js";
import { samplerName, uniformName } from "../../shaders/wgsl.js";
import { NAMESPACE, TEMP_MAT4, definesKey } from "../../utils.js";

import type {
  BlendMode,
  Entity,
  RendererSystem,
  RenderView,
  SystemOptions,
} from "../../types.js";

// Texture-typed material fields, precomputed once (not per draw) for the
// texCoord bookkeeping in getShaderOptions()/getVariantKey().
const TEXTURE_FIELDS = STANDARD_MATERIAL_FIELDS.filter(
  (field) => field.texture,
);

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

  // Depth-format dummies to satisfy texture_depth_2d/cube bindings when a light
  // casts no shadow.
  dummyTexture2D: createTexture(ctx, {
    label: "dummyShadowMap2D",
    width: 4,
    height: 4,
    format: "depth32float",
  }),
  dummyTextureCube: createTexture(ctx, {
    label: "dummyShadowMapCube",
    width: 4,
    height: 4,
    depth: 6,
    viewDimension: "cube",
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

  // Depth-pass pipeline variants (shadow maps) keyed by their defines signature.
  depthPipelineCache: new Map(),

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
    const { material } = entity;

    const texCoords: Record<string, number> = {};
    for (const { key } of TEXTURE_FIELDS) {
      const texCoord = material[key]?.texCoord;
      if (texCoord) texCoords[key.replace(/Texture$/, "")] = texCoord;
    }

    return {
      lights: _lights.counts,
      outputs: _outputs,
      texCoords,
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
    const texCoords = TEXTURE_FIELDS.map(
      ({ key }) => material[key]?.texCoord ?? 0,
    ).join("");
    return [
      definesKey(defines.difference(RUNTIME_DEFINES)),
      counts.ambient,
      counts.directional,
      counts.point,
      counts.spot,
      counts.area,
      this._reflectionProbe ? 1 : 0,
      this._outputs.normal ? 1 : 0,
      this._outputs.emissive ? 1 : 0,
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
    return {
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
        USE_BLEND: !!material.blend,
        PREMULTIPLY_ALPHA: !!material.blend && material.blendMode === "premultiplied",
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

  // Builds the @group(1) uniform values: fixed-size struct arrays per light
  // type plus the individually-bound shadow maps (dummies for now).
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

    // 2D shadow fields shared by directional/spot/area, plus the bound map.
    const shadow2D = (light: any) => {
      const map = light.castShadows ? light._shadowMap : null;
      return {
        map: map || this.dummyTexture2D,
        castShadows: map ? 1 : 0,
        near: light._near ?? 0,
        far: light._far ?? 0,
        radiusUV: light._radiusUV ?? [0, 0],
        shadowMapSize: map ? [map.width, map.height] : [0, 0],
      };
    };

    if (directional.length) {
      uniforms.uDirectionalLights = directional.map((e) => {
        const light = e.directionalLight!;
        const s = shadow2D(light);
        return {
          direction: light._direction,
          color: lightColor(light),
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          castShadows: s.castShadows,
          near: s.near,
          far: s.far,
          radiusUV: s.radiusUV,
          shadowMapSize: s.shadowMapSize,
        };
      });
      directional.forEach((e, i) => {
        const name = uniformName(`directionalShadowMap${i}`);
        uniforms[name] = shadow2D(e.directionalLight).map;
        uniforms[samplerName(name)] = this.shadowCompareSampler;
      });
    }

    if (point.length) {
      uniforms.uPointLights = point.map((e) => {
        const light = e.pointLight!;
        const map = light.castShadows ? light._shadowCubemap : null;
        return {
          position: e._transform!.worldPosition,
          color: lightColor(light),
          range: light.range,
          castShadows: map ? 1 : 0,
          bias: light.bias ?? 0,
          radius: light.bulbRadius ?? 0,
          shadowMapSize: map ? [map.width, map.height] : [0, 0],
          // Normalizes the stored/compared radial distance (shadow-mapping.ts
          // writes length(view)/far into the cube).
          far: light._far ?? 0,
        };
      });
      point.forEach((e, i) => {
        const light = e.pointLight!;
        const name = uniformName(`pointShadowMap${i}`);
        uniforms[name] =
          (light.castShadows && light._shadowCubemap) || this.dummyTextureCube;
        uniforms[samplerName(name)] = this.shadowSampler;
      });
    }

    if (spot.length) {
      uniforms.uSpotLights = spot.map((e) => {
        const light = e.spotLight!;
        const s = shadow2D(light);
        return {
          position: e._transform!.worldPosition,
          direction: light._direction,
          color: lightColor(light),
          innerAngle: light.innerAngle,
          angle: light.angle,
          range: light.range,
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          castShadows: s.castShadows,
          near: s.near,
          far: s.far,
          radiusUV: s.radiusUV,
          shadowMapSize: s.shadowMapSize,
        };
      });
      spot.forEach((e, i) => {
        const name = uniformName(`spotShadowMap${i}`);
        uniforms[name] = shadow2D(e.spotLight).map;
        uniforms[samplerName(name)] = this.shadowCompareSampler;
      });
    }

    if (areaActive.length) {
      uniforms.uLtc1 = this.ltcTextures.ltc_1;
      uniforms[samplerName("uLtc1")] = this.ltcSampler;
      uniforms.uLtc2 = this.ltcTextures.ltc_2;
      uniforms[samplerName("uLtc2")] = this.ltcSampler;
      uniforms.uAreaLights = areaActive.map((e) => {
        const light = e.areaLight!;
        const s = shadow2D(light);
        return {
          position: e.transform!.position,
          color: lightColor(light),
          rotation: e.transform!.rotation,
          size: [e.transform!.scale![0]! / 2, e.transform!.scale![1]! / 2],
          disk: light.disk ? 1 : 0,
          doubleSided: light.doubleSided ? 1 : 0,
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          castShadows: s.castShadows,
          near: s.near,
          far: s.far,
          radiusUV: s.radiusUV,
          shadowMapSize: s.shadowMapSize,
        };
      });
      areaActive.forEach((e, i) => {
        const name = uniformName(`areaShadowMap${i}`);
        uniforms[name] = shadow2D(e.areaLight).map;
        uniforms[samplerName(name)] = this.shadowCompareSampler;
      });
    }

    return {
      uniforms,
      counts: {
        ambient: ambient.length,
        directional: directional.length,
        point: point.length,
        spot: spot.length,
        area: areaActive.length,
      },
    };
  },

  render(renderView: RenderView, entities: Entity[], options: any) {
    const {
      outputs = {},
      msaa,
      transparent,
      transmitted,
      cullFaceMode,
      backgroundColorTexture,
    } = options;

    this._msaa = msaa;
    this._outputs = outputs;

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

    // uCaptureTexture is bound for every lit material (transmission is decoupled
    // from the probe). On the transmission pass the pipeline supplies the grabbed
    // opaque color (mip-chained for roughness-based refraction blur); other passes
    // bind a dummy so the always-declared binding stays valid.
    const captureUniforms = {
      uCaptureTexture:
        (transmitted && backgroundColorTexture) || this.dummyCaptureTexture,
      uCaptureTextureSampler: this.captureSampler,
    };

    const uFrame = this.getFrameUniforms(renderView);

    const renderableEntities = entities.filter(
      (e) =>
        e.geometry &&
        e.material &&
        e.material.type === undefined &&
        (transmitted
          ? cullFaceMode === "front"
            ? !e.material.cullFace && e.material.transmission
            : e.material.transmission
          : !e.material.transmission) &&
        (transparent ? e.material.blend : !e.material.blend),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i]!;
      // Computed once for this entity/draw and threaded through getPipeline
      // (defines) below, instead of recomputing the material feature walk.
      const materialFeatures = this.getMaterialDefines(entity);
      const pipeline = this.getPipeline(entity, options, materialFeatures);

      // View-space normal matrix: mat3(transpose(inverse(view * model))).
      mat4.set(TEMP_MAT4, uFrame.viewMatrix);
      mat4.mult(TEMP_MAT4, entity._transform!.modelMatrix);
      mat4.invert(TEMP_MAT4);
      mat4.transpose(TEMP_MAT4);

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
          uModel: {
            modelMatrix: entity._transform!.modelMatrix,
            normalMatrix: mat3.fromMat4(NORMAL_MATRIX, TEMP_MAT4),
          },
          ...(entity.skin && {
            uJointMatrices: getJointMatricesUniform(entity.skin),
          }),
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
  // `linear` selects the omni (point) variant: a fragment stage stores
  // normalized radial distance instead of clip depth. Rasterizer depth bias is
  // skipped there (frag_depth bypasses it; the point shader biases its compare).
  getDepthPipeline(entity: any, linear: boolean, light: any) {
    const { attributes } = entity._geometry;
    // Depth pass only cares about position-affecting features.
    const defines = new Set<string>();
    this.getFeatureFlags(attributes, DEPTH_PASS_VERTEX_FIELDS, defines);
    if (linear) defines.add("USE_LINEAR_DEPTH");

    const key = definesKey(defines);
    const pipeline = this.depthPipelineCache.getOrInsertComputed(key, () => {
      const shader = depthPassShader(defines, {});
      // 2D maps are vertex-only; the linear variant needs a fragment stage to
      // write frag_depth.
      return linear ? { vertex: shader, fragment: shader } : { vertex: shader };
    });
    pipeline.depthWriteEnabled = true;
    pipeline.cullMode = (entity.material.cullFace ?? true) ? "back" : "none";
    pipeline.topology = entity._geometry.primitive ?? "triangle-list";
    pipeline.frontFace =
      mat4.determinant(entity._transform.modelMatrix) < 0 ? "cw" : "ccw";
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

  // Depth-only pass into a light's shadow map. renderView.camera carries the
  // light's projection/view matrices; point lights (cubemap) store normalized
  // radial distance and need the light's far plane in uFrame.
  renderShadow(renderView: RenderView, entities: Entity[], options: any = {}) {
    const { camera, viewport } = renderView;
    const light = options.shadowMappingLight;
    const linear = !!light?._shadowCubemap;

    const uFrame = {
      projectionMatrix: camera.projectionMatrix!,
      viewMatrix: camera.viewMatrix!,
      inverseViewMatrix: camera.inverseViewMatrix! || IDENTITY_MAT4,
      cameraPosition: [0, 0, 0],
      viewportSize: [viewport[2]!, viewport[3]!],
      ...(linear ? { far: light._far } : {}),
    };

    const casters = entities.filter(
      (e) =>
        e.geometry &&
        e.material?.castShadows &&
        e.material.type === undefined &&
        e._geometry &&
        e._transform,
    );

    for (let i = 0; i < casters.length; i++) {
      const entity = casters[i]!;
      submit(ctx, {
        label: "drawShadowGeometryCmd",
        pipeline: this.getDepthPipeline(entity, linear, light),
        attributes: entity._geometry!.attributes,
        indices: entity._geometry!.indices,
        count: entity._geometry!.count,
        instanceCount: entity._geometry!.instances,
        uniforms: {
          uFrame,
          uModel: {
            modelMatrix: entity._transform!.modelMatrix,
            normalMatrix: mat3.fromMat4(
              NORMAL_MATRIX,
              entity._transform!.modelMatrix,
            ),
          },
          ...(entity.skin && {
            uJointMatrices: getJointMatricesUniform(entity.skin),
          }),
        },
      });
    }
  },
  dispose() {
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
  },
});
