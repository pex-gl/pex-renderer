import { mat3, mat4 } from "pex-math";
import { pipeline as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";
import { NAMESPACE, TEMP_MAT4 } from "../../utils.js";

// prettier-ignore
const flagDefinitions = [
  [["options", "attachmentsLocations", "color"], "LOCATION_COLOR", { type: "value" }],
  [["options", "attachmentsLocations", "normal"], "LOCATION_NORMAL", { type: "value" }],
  [["options", "attachmentsLocations", "emissive"], "LOCATION_EMISSIVE", { type: "value" }],
  [["options", "toneMap"], "TONE_MAP", { type: "value" }],

  [["options", "depthPassOnly"], "DEPTH_PASS_ONLY"],
  [["options", "depthPassOnly"], "USE_UNLIT_WORKFLOW"], //force unlit in depth pass mode
  [["options", "shadowQuality"], "SHADOW_QUALITY", { type: "value" }],
  [["options", "ambientLights", "length"], "NUM_AMBIENT_LIGHTS", { type: "value" }],
  [["options", "directionalLights", "length"], "NUM_DIRECTIONAL_LIGHTS", { type: "value" }],
  [["options", "pointLights", "length"], "NUM_POINT_LIGHTS", { type: "value" }],
  [["options", "spotLights", "length"], "NUM_SPOT_LIGHTS", { type: "value" }],
  [["options", "areaLights", "length"], "NUM_AREA_LIGHTS", { type: "value" }],
  [["options", "reflectionProbes", "length"], "USE_REFLECTION_PROBES"],
  [["options", "transmitted"], "USE_TRANSMISSION"],

  [["material", "unlit"], "USE_UNLIT_WORKFLOW", { fallback: "USE_METALLIC_ROUGHNESS_WORKFLOW" }],
  [["material", "blend"], "USE_BLEND"],

  [["skin"], "USE_SKIN"],
  [["skin", "joints", "length"], "NUM_JOINTS", { type: "value", requires: "USE_SKIN" }],
  [["skin", "jointMatrices"], "", { uniform: "uJointMat", requires: "USE_SKIN" }],

  [["material", "baseColor"], "", { uniform: "uBaseColor" }],
  [["material", "metallic"], "", { uniform: "uMetallic" }],
  [["material", "roughness"], "", { uniform: "uRoughness" }],

  [["material", "ior"], "USE_IOR", { uniform: "uIor" }],
  [["material", "specular"], "USE_SPECULAR", { uniform: "uSpecular" }], // TODO: specular 0 is allowed
  [["material", "specularTexture"], "SPECULAR_TEXTURE", { type: "texture", uniform: "uSpecularTexture", requires: "USE_SPECULAR" }],
  [["material", "specularColor"], "", { uniform: "uSpecularColor", requires: "USE_SPECULAR", default: [1, 1, 1] }],
  [["material", "specularColorTexture"], "SPECULAR_COLOR_TEXTURE", { type: "texture", uniform: "uSpecularColorTexture", requires: "USE_SPECULAR" }],

  [["material", "emissiveColor"], "USE_EMISSIVE_COLOR", { uniform: "uEmissiveColor" }],
  [["material", "emissiveIntensity"], "", { uniform: "uEmissiveIntensity", requires: "USE_EMISSIVE_COLOR", default: 1 }],
  [["material", "baseColorTexture"], "BASE_COLOR_TEXTURE", { type: "texture", uniform: "uBaseColorTexture" }],
  [["material", "emissiveColorTexture"], "EMISSIVE_COLOR_TEXTURE", { type: "texture", uniform: "uEmissiveColorTexture" }],
  [["material", "normalTexture"], "NORMAL_TEXTURE", { type: "texture", uniform: "uNormalTexture" }],
  [["material", "normalTextureScale"], "", { uniform: "uNormalTextureScale", requires: "USE_NORMAL_TEXTURE", default: 1 }],
  [["material", "roughnessTexture"], "ROUGHNESS_TEXTURE", { type: "texture", uniform: "uRoughnessTexture" }],
  [["material", "metallicTexture"], "METALLIC_TEXTURE", { type: "texture", uniform: "uMetallicTexture" }],
  [["material", "metallicRoughnessTexture"], "METALLIC_ROUGHNESS_TEXTURE", { type: "texture", uniform: "uMetallicRoughnessTexture" }],
  [["material", "occlusionTexture"], "OCCLUSION_TEXTURE", { type: "texture", uniform: "uOcclusionTexture" }],
  [["material", "alphaTest"], "USE_ALPHA_TEST", { uniform: "uAlphaTest" }],
  [["material", "alphaTexture"], "ALPHA_TEXTURE", { type: "texture", uniform: "uAlphaTexture" }],

  [["material", "clearCoat"], "USE_CLEAR_COAT", { uniform: "uClearCoat" }],
  [["material", "clearCoatRoughness"], "USE_CLEAR_COAT_ROUGHNESS", { uniform: "uClearCoatRoughness", requires: "USE_CLEAR_COAT" }],
  [["material", "clearCoatTexture"], "CLEAR_COAT_TEXTURE", { type: "texture", uniform: "uClearCoatTexture", requires: "USE_CLEAR_COAT" }],
  [["material", "clearCoatRoughnessTexture"], "CLEAR_COAT_ROUGHNESS_TEXTURE", { type: "texture", uniform: "uClearCoatRoughnessTexture", requires: "USE_CLEAR_COAT" }],
  [["material", "clearCoatNormalTexture"], "CLEAR_COAT_NORMAL_TEXTURE", { type: "texture", uniform: "uClearCoatNormalTexture", requires: "USE_CLEAR_COAT" }],
  [["material", "clearCoatNormalTextureScale"], "", { uniform: "uClearCoatNormalTextureScale", requires: "USE_CLEAR_COAT" }],

  [["material", "sheenColor"], "USE_SHEEN", { uniform: "uSheenColor" }],
  [["material", "sheenColorTexture"], "SHEEN_COLOR_TEXTURE", { uniform: "uSheenColorMap", requires: "USE_SHEEN" }],
  [["material", "sheenRoughness"], "", { uniform: "uSheenRoughness", requires: "USE_SHEEN" }],
  [["material", "sheenRoughnessTexture"], "", { uniform: "uSheenRoughnessTexture", requires: "USE_SHEEN" }],

  [["material", "transmission"], "", { uniform: "uTransmission", requires: "USE_TRANSMISSION" }],
  [["material", "transmissionTexture"], "TRANSMISSION_TEXTURE", { type: "texture", uniform: "uTransmissionTexture", requires: "USE_TRANSMISSION" }],
  [["material", "dispersion"], "USE_DISPERSION", { uniform: "uDispersion", requires: "USE_TRANSMISSION" }],

  [["material", "diffuseTransmission"], "USE_DIFFUSE_TRANSMISSION", { uniform: "uDiffuseTransmission" }],
  [["material", "diffuseTransmissionTexture"], "DIFFUSE_TRANSMISSION_TEXTURE", { type: "texture", uniform: "uDiffuseTransmissionTexture", requires: "USE_DIFFUSE_TRANSMISSION" }],
  [["material", "diffuseTransmissionColor"], "", { uniform: "uDiffuseTransmissionColor", requires: "USE_DIFFUSE_TRANSMISSION", default: [1, 1, 1] }],
  [["material", "diffuseTransmissionColorTexture"], "DIFFUSE_TRANSMISSION_COLOR_TEXTURE", { type: "texture", uniform: "uDiffuseTransmissionColorTexture", requires: "USE_DIFFUSE_TRANSMISSION" }],

  [["material", "thickness"], "USE_VOLUME", { uniform: "uThickness", requires: "USE_TRANSMISSION" }],
  [["material", "thickness"], "USE_VOLUME", { uniform: "uThickness", requires: "USE_DIFFUSE_TRANSMISSION", excludes: "USE_TRANSMISSION" }], // excludes to avoid overwritting
  [["material", "thicknessTexture"], "THICKNESS_TEXTURE", { type: "texture", uniform: "uThicknessTexture", requires: "USE_VOLUME" }],
  [["material", "attenuationDistance"], "", { uniform: "uAttenuationDistance", requires: "USE_VOLUME", default: Infinity }],
  [["material", "attenuationColor"], "", { uniform: "uAttenuationColor", requires: "USE_VOLUME", default: [1, 1, 1] }],

  [["_geometry", "attributes", "aNormal"], "USE_NORMALS", { fallback: "USE_UNLIT_WORKFLOW" }],
  [["_geometry", "attributes", "aTangent"], "USE_TANGENTS"],
  [["_geometry", "attributes", "aTexCoord0"], "USE_TEXCOORD_0"],
  [["_geometry", "attributes", "aTexCoord1"], "USE_TEXCOORD_1"],
  [["_geometry", "attributes", "aOffset"], "USE_INSTANCED_OFFSET"],
  [["_geometry", "attributes", "aScale"], "USE_INSTANCED_SCALE"],
  [["_geometry", "attributes", "aRotation"], "USE_INSTANCED_ROTATION"],
  [["_geometry", "attributes", "aColor"], "USE_INSTANCED_COLOR"],
  [["_geometry", "attributes", "aVertexColor"], "USE_VERTEX_COLORS"],
];

const lightColorToSrgb = (light) =>
  light.color.map((c, j) =>
    j < 3 ? Math.pow(c * light.intensity, 1.0 / 2.2) : c,
  );

/**
 * Standard renderer
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.standard
 */
export default ({ ctx, shadowQuality = 3 }) => ({
  ...createBaseSystem(),
  type: "standard-renderer",
  debug: false,
  flagDefinitions,
  shadowQuality,
  debugRender: "",
  pipelineMaterialDefaults: {
    depthWrite: undefined,
    depthTest: undefined,
    depthFunc: ctx.DepthFunc.Less,
    blend: undefined,
    blendSrcRGBFactor: undefined,
    blendSrcAlphaFactor: undefined,
    blendDstRGBFactor: undefined,
    blendDstAlphaFactor: undefined,
    cullFace: true,
    cullFaceMode: ctx.Face.Back,
  },
  textures: {
    dummyTexture2D: ctx.texture2D({
      name: "dummyTexture2D",
      width: 4,
      height: 4,
    }),
    dummyTextureCube: ctx.textureCube({
      name: "dummyTextureCube",
      width: 4,
      height: 4,
    }),
    ltc_1: null,
    ltc_2: null,
  },
  isLoadingAreaLightData: null,
  checkLight(light) {
    if (light.castShadows && !(light._shadowMap || light._shadowCubemap)) {
      console.warn(
        NAMESPACE,
        this.type,
        `light component missing shadowMap. Add a renderPipeplineSystem.update(entities).`,
      );
    } else {
      return true;
    }
  },
  checkReflectionProbe(reflectionProbe) {
    if (!reflectionProbe._reflectionProbe?._reflectionMap) {
      console.warn(
        NAMESPACE,
        this.type,
        `reflectionProbe component missing _reflectionProbe. Add a reflectionProbeSystem.update(entities, { renderers: [skyboxRendererSystem] }).`,
      );
    } else {
      return true;
    }
  },
  checkRenderableEntity(entity) {
    if (!entity._geometry) {
      console.warn(
        NAMESPACE,
        this.type,
        `entity missing _geometry. Add a geometrySystem.update(entities).`,
      );
    } else if (!entity._transform) {
      console.warn(
        NAMESPACE,
        this.type,
        `entity missing _transform. Add a transformSystem.update(entities).`,
      );
    } else {
      return true;
    }
  },
  getVertexShader: () => SHADERS.standard.vert,
  getFragmentShader: (options) =>
    options.depthPassOnly ? SHADERS.depthPass.frag : SHADERS.standard.frag,
  getPipelineHash(entity, options) {
    const { material, _geometry: geometry } = entity;

    return `${material.id}_${geometry.primitive}_${options.cullFaceMode ?? ""}_${Object.entries(
      this.pipelineMaterialDefaults,
    )
      .map(([key, value]) => material[key] ?? value)
      .join("_")}`;
  },
  getPipelineOptions(entity, options) {
    const { material, _geometry: geometry } = entity;

    return {
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      depthFunc: material.depthFunc || ctx.DepthFunc.Less,
      blend: material.blend,
      blendSrcRGBFactor: material.blendSrcRGBFactor,
      blendSrcAlphaFactor: material.blendSrcAlphaFactor,
      blendDstRGBFactor: material.blendDstRGBFactor,
      blendDstAlphaFactor: material.blendDstAlphaFactor,
      cullFace:
        options.cullFaceMode && material.cullFace === false
          ? true
          : (material.cullFace ?? true),
      cullFaceMode:
        options.cullFaceMode || material.cullFaceMode || ctx.Face.Back,
      primitive: geometry.primitive ?? ctx.Primitive.Triangles,
    };
  },
  async loadAreaLightData() {
    try {
      const { g_ltc_1, g_ltc_2 } = await import("./area-light-data.js");
      if (ctx.isDisposed) return;
      const areaLightTextureOptions = {
        width: 64,
        height: 64,
        pixelFormat: ctx.PixelFormat.RGBA32F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Nearest,
        mag: ctx.Filter.Linear,
      };
      this.textures.ltc_1 = ctx.texture2D({
        name: "areaLightMatTexture",
        data: g_ltc_1,
        ...areaLightTextureOptions,
      });
      this.textures.ltc_2 = ctx.texture2D({
        name: "areaLightMagTexture",
        data: g_ltc_2,
        ...areaLightTextureOptions,
      });
    } catch (error) {
      console.error(NAMESPACE, error);
    }
  },
  gatherLightsInfo(lights, sharedUniforms) {
    const {
      ambientLights,
      directionalLights,
      pointLights,
      spotLights,
      areaLights,
      shadowCastingEntities,
    } = lights;

    const castShadows = shadowCastingEntities.length;

    for (let i = 0; i < directionalLights.length; i++) {
      const lightEntity = directionalLights[i];
      const light = lightEntity.directionalLight;

      const uniform = `uDirectionalLights[${i}].`;
      const shadows = castShadows && light.castShadows;
      if (shadows) this.checkLight(light);

      sharedUniforms[`${uniform}direction`] = light._direction;
      sharedUniforms[`${uniform}color`] = lightColorToSrgb(light);
      sharedUniforms[`${uniform}castShadows`] = shadows;

      sharedUniforms[`${uniform}projectionMatrix`] = light._projectionMatrix;
      sharedUniforms[`${uniform}viewMatrix`] = light._viewMatrix;
      sharedUniforms[`${uniform}near`] = shadows ? light._near : 0;
      sharedUniforms[`${uniform}far`] = shadows ? light._far : 0;
      sharedUniforms[`${uniform}bias`] = light.bias;
      sharedUniforms[`${uniform}radiusUV`] = shadows ? light._radiusUV : [0, 0];
      sharedUniforms[`${uniform}shadowMapSize`] = shadows
        ? [light._shadowMap.width, light._shadowMap.height]
        : [0, 0];
      sharedUniforms[`uDirectionalLightShadowMaps[${i}]`] = shadows
        ? light._shadowMap
        : this.textures.dummyTexture2D;
    }

    for (let i = 0; i < spotLights.length; i++) {
      const lightEntity = spotLights[i];
      const light = lightEntity.spotLight;

      const uniform = `uSpotLights[${i}].`;
      const shadows = castShadows && light.castShadows;
      if (shadows) this.checkLight(light);

      sharedUniforms[`${uniform}position`] =
        lightEntity._transform.worldPosition;
      sharedUniforms[`${uniform}direction`] = light._direction;
      sharedUniforms[`${uniform}color`] = lightColorToSrgb(light);
      sharedUniforms[`${uniform}angle`] = light.angle;
      sharedUniforms[`${uniform}innerAngle`] = light.innerAngle;
      sharedUniforms[`${uniform}range`] = light.range;
      sharedUniforms[`${uniform}castShadows`] = shadows;

      sharedUniforms[`${uniform}projectionMatrix`] = light._projectionMatrix;
      sharedUniforms[`${uniform}viewMatrix`] = light._viewMatrix;
      sharedUniforms[`${uniform}near`] = shadows ? light._near : 0;
      sharedUniforms[`${uniform}far`] = shadows ? light._far : 0;
      sharedUniforms[`${uniform}bias`] = light.bias;
      sharedUniforms[`${uniform}radiusUV`] = shadows ? light._radiusUV : [0, 0];
      sharedUniforms[`${uniform}shadowMapSize`] = shadows
        ? [light._shadowMap.width, light._shadowMap.height]
        : [0, 0];
      sharedUniforms[`uSpotLightShadowMaps[${i}]`] = shadows
        ? light._shadowMap
        : this.textures.dummyTexture2D;
    }

    for (let i = 0; i < pointLights.length; i++) {
      const lightEntity = pointLights[i];
      const light = lightEntity.pointLight;

      const uniform = `uPointLights[${i}].`;
      const shadows = castShadows && light.castShadows;
      if (shadows) this.checkLight(light);

      sharedUniforms[`${uniform}position`] =
        lightEntity._transform.worldPosition;
      sharedUniforms[`${uniform}color`] = lightColorToSrgb(light);
      sharedUniforms[`${uniform}range`] = light.range;
      sharedUniforms[`${uniform}castShadows`] = shadows;

      sharedUniforms[`${uniform}bias`] = light.bias;
      sharedUniforms[`${uniform}radius`] = light.bulbRadius;
      sharedUniforms[`${uniform}shadowMapSize`] = shadows
        ? [light._shadowCubemap.width, light._shadowCubemap.height]
        : [0, 0];
      sharedUniforms[`uPointLightShadowMaps[${i}]`] = shadows
        ? light._shadowCubemap
        : this.textures.dummyTextureCube;
    }

    if (areaLights.length) {
      if (!this.isLoadingAreaLightData) {
        this.isLoadingAreaLightData = true;
        this.loadAreaLightData();
      }
    }

    if (this.textures.ltc_1 && this.textures.ltc_2) {
      for (let i = 0; i < areaLights.length; i++) {
        const lightEntity = areaLights[i];
        const light = lightEntity.areaLight;

        const uniform = `uAreaLights[${i}].`;
        const shadows = castShadows && light.castShadows;
        if (shadows) this.checkLight(light);

        sharedUniforms.ltc_1 = this.textures.ltc_1;
        sharedUniforms.ltc_2 = this.textures.ltc_2;
        sharedUniforms[`${uniform}position`] = lightEntity.transform.position;
        sharedUniforms[`${uniform}color`] = lightColorToSrgb(light);
        sharedUniforms[`${uniform}rotation`] = lightEntity.transform.rotation;
        sharedUniforms[`${uniform}size`] = [
          lightEntity.transform.scale[0] / 2,
          lightEntity.transform.scale[1] / 2,
        ];
        sharedUniforms[`${uniform}disk`] = light.disk;
        sharedUniforms[`${uniform}doubleSided`] = light.doubleSided;
        sharedUniforms[`${uniform}castShadows`] = shadows;

        sharedUniforms[`${uniform}projectionMatrix`] = light._projectionMatrix;
        sharedUniforms[`${uniform}viewMatrix`] = light._viewMatrix;
        sharedUniforms[`${uniform}near`] = shadows ? light._near : 0;
        sharedUniforms[`${uniform}far`] = shadows ? light._far : 0;
        sharedUniforms[`${uniform}bias`] = light.bias;
        sharedUniforms[`${uniform}radiusUV`] = shadows
          ? light._radiusUV
          : [0, 0];
        sharedUniforms[`${uniform}shadowMapSize`] = shadows
          ? [light._shadowMap.width, light._shadowMap.height]
          : [0, 0];
        sharedUniforms[`uAreaLightShadowMaps[${i}]`] = shadows
          ? light._shadowMap
          : this.textures.dummyTexture2D;
      }
    }

    for (let i = 0; i < ambientLights.length; i++) {
      const lightEntity = ambientLights[i];
      const color = [...lightEntity.ambientLight.color];
      color[3] = lightEntity.ambientLight.intensity;
      sharedUniforms[`uAmbientLights[${i}].color`] = color;
    }
  },
  gatherReflectionProbeInfo(reflectionProbes, sharedUniforms) {
    if (
      reflectionProbes.length > 0 &&
      this.checkReflectionProbe(reflectionProbes[0])
    ) {
      sharedUniforms.uReflectionMap =
        reflectionProbes[0]._reflectionProbe._reflectionMap;
      sharedUniforms.uReflectionMapSize =
        reflectionProbes[0]._reflectionProbe._reflectionMap.width;
      sharedUniforms.uReflectionMapEncoding =
        reflectionProbes[0]._reflectionProbe._reflectionMap.encoding;
    }
  },
  render(renderView, entities, options) {
    const { camera, cameraEntity } = renderView;
    const {
      shadowMappingLight,
      transparent,
      transmitted,
      backgroundColorTexture,
      cullFaceMode,
      attachmentsLocations = {},
    } = options;
    const shadowMapping = !!shadowMappingLight;

    const pipelineOptions = {
      ambientLights: [],
      directionalLights: [],
      pointLights: [],
      spotLights: [],
      areaLights: [],
      shadowCastingEntities: [],
      reflectionProbes: entities.filter((e) => e.reflectionProbe),
      depthPassOnly: shadowMapping,
      targets: {},
      debugRender: !shadowMapping && this.debugRender,
      attachmentsLocations,
      toneMap: renderView.toneMap,
      transmitted,
      cullFaceMode,
    };

    const sharedUniforms = {
      uViewportSize: [renderView.viewport[2], renderView.viewport[3]],

      uExposure: renderView.exposure,
      uOutputEncoding: renderView.outputEncoding,
    };

    if (!shadowMapping) {
      // Post processing
      pipelineOptions.targets =
        cameraEntity.postProcessing?._targets?.[renderView.cameraEntity.id] ||
        {};

      // Lighting
      pipelineOptions.ambientLights = entities.filter((e) => e.ambientLight);
      pipelineOptions.directionalLights = entities.filter(
        (e) => e.directionalLight,
      );
      pipelineOptions.pointLights = entities.filter((e) => e.pointLight);
      pipelineOptions.spotLights = entities.filter((e) => e.spotLight);
      pipelineOptions.areaLights = entities.filter((e) => e.areaLight);
      pipelineOptions.shadowCastingEntities = entities.filter(
        (entity) => entity.geometry && entity.material?.castShadows,
      );

      this.gatherLightsInfo(pipelineOptions, sharedUniforms);
      this.gatherReflectionProbeInfo(
        pipelineOptions.reflectionProbes,
        sharedUniforms,
      );
    }

    if (shadowMappingLight) {
      sharedUniforms.uProjectionMatrix = shadowMappingLight._projectionMatrix;
      sharedUniforms.uViewMatrix = shadowMappingLight._viewMatrix;
      sharedUniforms.uInverseViewMatrix = mat4.create();
      sharedUniforms.uCameraPosition = [0, 0, 5];
    } else {
      sharedUniforms.uProjectionMatrix = camera.projectionMatrix;
      sharedUniforms.uViewMatrix = camera.viewMatrix;
      sharedUniforms.uInverseViewMatrix =
        camera.invViewMatrix || camera.inverseViewMatrix; //TODO: settle on invViewMatrix
      sharedUniforms.uCameraPosition = cameraEntity._transform.worldPosition; //TODO: ugly
    }
    sharedUniforms.uNormalMatrix = mat3.create();

    if (backgroundColorTexture) {
      sharedUniforms.uCaptureTexture = backgroundColorTexture;
    }

    const renderableEntities = entities.filter(
      (e) =>
        e.geometry &&
        e.material &&
        e.material.type === undefined &&
        (!shadowMapping || e.material.castShadows) &&
        (transparent ? e.material.blend : !e.material.blend) &&
        (transmitted
          ? cullFaceMode === ctx.Face.Front
            ? !e.material.cullFace && e.material.transmission
            : e.material.transmission
          : !e.material.transmission),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i];

      if (!this.checkRenderableEntity(entity)) continue;

      // Set shadow quality per entity
      pipelineOptions.shadowQuality = entity.material.receiveShadows
        ? this.shadowQuality
        : 0;

      // Get pipeline and program from cache. Also computes this.uniforms
      const pipeline = this.getPipeline(ctx, entity, pipelineOptions);

      const uniforms = {
        uModelMatrix: entity._transform.modelMatrix, //FIXME: bypasses need for transformSystem access
        uPointSize: entity.material.pointSize ?? 1,
      };

      Object.assign(uniforms, sharedUniforms, this.uniforms);
      entity._uniforms = uniforms;

      // Set the normal matrix
      mat4.set(TEMP_MAT4, sharedUniforms.uViewMatrix);
      mat4.mult(TEMP_MAT4, entity._transform.modelMatrix);
      mat4.invert(TEMP_MAT4);
      mat4.transpose(TEMP_MAT4);
      mat3.fromMat4(sharedUniforms.uNormalMatrix, TEMP_MAT4);

      // TODO: fix CW
      // ctx.gl.frontFace(
      //   determinant(entity._transform.modelMatrix) < 0 ? ctx.gl.CW : ctx.gl.CCW,
      // );

      ctx.submit({
        name: transparent
          ? "drawTransparentGeometryCmd"
          : `drawOpaque${transmitted ? "Transmitted" : ""}GeometryCmd`,
        pipeline,
        attributes: entity._geometry.attributes,
        indices: entity._geometry.indices,
        count: entity._geometry.count,
        instances: entity._geometry.instances,
        uniforms,
        multiDraw: entity.geometry.multiDraw,
      });
    }
  },
  renderShadow(renderView, entities, options) {
    this.render(renderView, entities, options);
  },
  renderOpaque(renderView, entities, options) {
    this.render(renderView, entities, options);
  },
  renderTransparent(renderView, entities, options) {
    this.render(renderView, entities, { ...options, transparent: true });
  },
  dispose() {
    for (let [key, value] of Object.entries(this.textures)) {
      if (value) {
        ctx.dispose(value);
        this.textures[key] = null;
      }
    }
    this.isLoadingAreaLightData = null;

    this.pipelineCache.dispose();
  },
});
