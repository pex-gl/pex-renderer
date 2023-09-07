import { mat3, mat4 } from "pex-math";
import { pipeline as SHADERS, parser as ShaderParser } from "pex-shaders";
import * as AreaLightsData from "./area-light-data.js";
import {
  ProgramCache,
  shadersPostReplace,
  buildProgram,
  getMaterialFlagsAndUniforms,
} from "./utils.js";
import { NAMESPACE } from "../../utils.js";

let ltc_mat;
let ltc_mag;

// prettier-ignore
const flagDefs = [
  [["options", "depthPassOnly"], "DEPTH_PASS_ONLY", { type: "boolean" }],
  [["options", "depthPassOnly"], "USE_UNLIT_WORKFLOW", { type: "boolean" }], //force unlit in depth pass mode
  [["options", "ambientLights", "length"], "NUM_AMBIENT_LIGHTS", { type: "counter" }],
  [["options", "directionalLights", "length"], "NUM_DIRECTIONAL_LIGHTS", { type: "counter" }],
  [["options", "pointLights", "length"], "NUM_POINT_LIGHTS", { type: "counter" }],
  [["options", "spotLights", "length"], "NUM_SPOT_LIGHTS", { type: "counter" }],
  [["options", "areaLights", "length"], "NUM_AREA_LIGHTS", { type: "counter" }],
  [["options", "reflectionProbes", "length"], "USE_REFLECTION_PROBES", { type: "boolean" }],
  [["options", "useTonemapping"], "USE_TONEMAPPING", { type: "boolean" }],
  [["options", "envMapSize"], "", { uniform: "uEnvMapSize" }], // Blurred env map size
  [["material", "unlit"], "USE_UNLIT_WORKFLOW", { type: "boolean", fallback: "USE_METALLIC_ROUGHNESS_WORKFLOW" }],
  [["material", "blend"], "USE_BLEND", { type: "boolean" }],
  [["skin"], "USE_SKIN"],
  [["skin", "joints", "length"], "NUM_JOINTS", { type: "counter", requires: "USE_SKIN" }],
  [["skin", "jointMatrices"], "", { uniform: "uJointMat", requires: "USE_SKIN" }],
  [["material", "baseColor"], "", { uniform: "uBaseColor" }],
  [["material", "metallic"], "", { uniform: "uMetallic" }],
  [["material", "roughness"], "", { uniform: "uRoughness" }],
  [["material", "emissiveColor"], "USE_EMISSIVE_COLOR", { uniform: "uEmissiveColor" }],
  [["material", "emissiveIntensity"], "", { uniform: "uEmissiveIntensity", default: 1}],
  [["material", "baseColorTexture"], "BASE_COLOR_TEXTURE", { type: "texture", uniform: "uBaseColorTexture" }],
  [["material", "emissiveColorTexture"], "EMISSIVE_COLOR_TEXTURE", { type: "texture", uniform: "uEmissiveColorTexture" }],
  [["material", "normalTexture"], "NORMAL_TEXTURE", { type: "texture", uniform: "uNormalTexture" }],
  [["material", "roughnessTexture"], "ROUGHNESS_TEXTURE", { type: "texture", uniform: "uRoughnessTexture" }],
  [["material", "metallicTexture"], "METALLIC_TEXTURE", { type: "texture", uniform: "uMetallicTexture" }],
  [["material", "metallicRoughnessTexture"], "METALLIC_ROUGHNESS_TEXTURE", { type: "texture", uniform: "uMetallicRoughnessTexture" }],
  [["material", "occlusionTexture"], "OCCLUSION_TEXTURE", { type: "texture", uniform: "uOcclusionTexture" }],
  [["material", "alphaTest"], "USE_ALPHA_TEST", { uniform: "uAlphaTest" }],
  [["material", "alphaTexture"], "ALPHA_TEXTURE", { type: "texture", uniform: "uAlphaTexture" }],
  [["material", "clearCoat"], "USE_CLEAR_COAT", { uniform: "uClearCoat" }],
  [["material", "clearCoatRoughness"], "USE_CLEAR_COAT_ROUGHNESS", { uniform: "uClearCoatRoughness" }],
  [["material", "clearCoatTexture"], "CLEAR_COAT_TEXTURE", { type: "texture", uniform: "uClearCoatTexture" }],
  [["material", "clearCoatRoughnessTexture"], "CLEAR_COAT_ROUGHNESS_TEXTURE", { type: "texture", uniform: "uClearCoatRoughnessTexture" }],
  [["material", "clearCoatNormalTexture"], "CLEAR_COAT_NORMAL_TEXTURE", { type: "texture", uniform: "uClearCoatNormalTexture" }],
  [["material", "clearCoatNormalTextureScale"], "", { uniform: "uClearCoatNormalTextureScale" }],
  [["material", "sheenColor"], "USE_SHEEN", { uniform: "uSheenColor" }],
  [["material", "sheenColorTexture"], "USE_SHEEN_COLOR_TEXTURE", { uniform: "uSheenColorMap" }],
  [["material", "sheenRoughness"], "", { uniform: "uSheenRoughness", requires: "USE_SHEEN" }],
  [["material", "transmission"], "USE_TRANSMISSION", { uniform: "uTransmission", requires: "USE_BLEND" }],
  [["geometry", "attributes", "aNormal"], "USE_NORMALS", { fallback: "USE_UNLIT_WORKFLOW" }],
  [["geometry", "attributes", "aTangent"], "USE_TANGENTS"],
  [["geometry", "attributes", "aTexCoord0"], "USE_TEXCOORD_0"],
  [["geometry", "attributes", "aTexCoord1"], "USE_TEXCOORD_1"],
  [["geometry", "attributes", "aOffset"], "USE_INSTANCED_OFFSET"],
  [["geometry", "attributes", "aScale"], "USE_INSTANCED_SCALE"],
  [["geometry", "attributes", "aRotation"], "USE_INSTANCED_ROTATION"],
  [["geometry", "attributes", "aColor"], "USE_INSTANCED_COLOR"],
  [["geometry", "attributes", "aVertexColor"], "USE_VERTEX_COLORS"],
];

export default ({ ctx }) => {
  const dummyTexture2D = ctx.texture2D({
    name: "dummyTexture2D",
    width: 4,
    height: 4,
  });
  const dummyTextureCube = ctx.textureCube({
    name: "dummyTextureCube",
    width: 4,
    height: 4,
  });

  // function render() {
  //   skybox.draw(camera, {
  //     outputEncoding: sharedUniforms.uOutputEncoding,
  //     backgroundMode: true,
  //   });

  //   //TODO: add some basic sorting of transparentEntities
  //   // prettier-ignore
  //   const transparentEntities = shadowMapping ? [] : renderableEntities.filter((e) => e.material.blend);

  //   // sharedUniforms.uCameraPosition = camera.entity.transform.worldPosition;

  //   const geometryPasses = [opaqueEntities, transparentEntities];

  //   for (let passIndex = 0; passIndex < geometryPasses.length; passIndex++) {
  //     const passEntities = geometryPasses[passIndex];

  //     // Draw skybox before transparent meshes
  //     if (
  //       passEntities == transparentEntities &&
  //       skybox &&
  //       !shadowMappingLight
  //     ) {
  //     }

  //     for (let i = 0; i < passEntities.length; i++) {
  //       if (camera?.viewport) {
  //         // cmd.viewport = camera.viewport;
  //         // cmd.scissor = camera.viewport;
  //       }
  //       ctx.submit(cmd);
  //     }
  //   }
  // }

  const pipelineMaterialDefaults = {
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
  };

  const standardRendererSystem = {
    type: "standard-renderer",
    cache: {
      programs: new ProgramCache(),
      pipelines: {},
    },
    debug: false,
    debugRender: "",
    checkLight(light) {
      if (light.castShadows && !(light._shadowMap || light._shadowCubemap)) {
        console.warn(
          NAMESPACE,
          this.type,
          `light component missing shadowMap. Add a renderPipeplineSystem.update(entities).`
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
          `reflectionProbe component missing _reflectionProbe. Add a reflectionProbeSystem.update(entities, { renderers: [skyboxRendererSystem] }).`
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
          `entity missing _geometry. Add a geometrySystem.update(entities).`
        );
      } else if (!entity._transform) {
        console.warn(
          NAMESPACE,
          this.type,
          `entity missing _transform. Add a transformSystem.update(entities).`
        );
      } else {
        return true;
      }
    },
    getProgram(ctx, entity, options) {
      const { material } = entity;
      const { flags, materialUniforms } = getMaterialFlagsAndUniforms(
        ctx,
        entity,
        flagDefs,
        options
      );
      this.materialUniforms = materialUniforms;
      entity._flags = flags;

      const descriptor = {
        vert: material.vert || SHADERS.material.vert,
        frag:
          material.frag ||
          (options.depthPassOnly
            ? SHADERS.depthPass.frag
            : SHADERS.material.frag),
      };
      shadersPostReplace(
        descriptor,
        entity,
        this.materialUniforms,
        options.debugRender
      );
      if (options.debugRender) flags.push(options.debugRender);

      const { vert, frag } = descriptor;

      let program = this.cache.programs.get(flags, vert, frag);

      if (!program) {
        const defines = options.debugRender
          ? flags.filter((flag) => flag !== options.debugRender)
          : flags;
        const vertSrc = ShaderParser.build(ctx, vert, defines);
        const fragSrc = ShaderParser.build(ctx, frag, defines);

        try {
          if (this.debug) {
            console.debug(NAMESPACE, this.type, "new program", flags, entity);
          }
          program = buildProgram(
            ctx,
            ShaderParser.replaceStrings(vertSrc, options),
            ShaderParser.replaceStrings(fragSrc, options)
          );
          this.cache.programs.set(flags, vert, frag, program);
        } catch (error) {
          console.error(NAMESPACE, error);
          console.warn(
            NAMESPACE,
            "glsl error",
            ShaderParser.getFormattedError(error, {
              vert: vertSrc,
              frag: fragSrc,
            })
          );
        }
      }
      return program;
    },
    getPipeline(ctx, entity, options) {
      const { material, _geometry: geometry } = entity;
      const program = this.getProgram(ctx, entity, options);

      const hash = `${material.id}_${program.id}_${
        geometry.primitive
      }_${Object.entries(pipelineMaterialDefaults)
        .map(([key, value]) => material[key] ?? value)
        .join("_")}`;

      if (!this.cache.pipelines[hash] || material.needsPipelineUpdate) {
        material.needsPipelineUpdate = false;
        if (this.debug) {
          console.debug(NAMESPACE, this.type, "new pipeline", hash, entity);
        }
        this.cache.pipelines[hash] = ctx.pipeline({
          program,
          depthTest: material.depthTest,
          depthWrite: material.depthWrite,
          depthFunc: material.depthFunc || ctx.DepthFunc.Less,
          blend: material.blend,
          blendSrcRGBFactor: material.blendSrcRGBFactor,
          blendSrcAlphaFactor: material.blendSrcAlphaFactor,
          blendDstRGBFactor: material.blendDstRGBFactor,
          blendDstAlphaFactor: material.blendDstAlphaFactor,
          cullFace: material.cullFace !== undefined ? material.cullFace : true,
          cullFaceMode: material.cullFaceMode || ctx.Face.Back,
          primitive: geometry.primitive || ctx.Primitive.Triangles,
        });
      }

      return this.cache.pipelines[hash];
    },
    gatherLightsInfo(lights, sharedUniforms) {
      const {
        ambientLights,
        directionalLights,
        pointLights,
        spotLights,
        areaLights,
      } = lights;

      for (let i = 0; i < directionalLights.length; i++) {
        const lightEntity = directionalLights[i];

        const light = lightEntity.directionalLight;
        standardRendererSystem.checkLight(light);

        sharedUniforms[`uDirectionalLights[${i}].direction`] = light._direction;
        sharedUniforms[`uDirectionalLights[${i}].color`] = light.color.map(
          (c, j) => {
            if (j < 3) return Math.pow(c * light.intensity, 1.0 / 2.2);
            else return c;
          }
        );
        sharedUniforms[`uDirectionalLights[${i}].castShadows`] =
          light.castShadows;
        sharedUniforms[`uDirectionalLights[${i}].projectionMatrix`] =
          light._projectionMatrix;
        sharedUniforms[`uDirectionalLights[${i}].viewMatrix`] =
          light._viewMatrix;
        sharedUniforms[`uDirectionalLights[${i}].near`] = light._near || 0.1;
        sharedUniforms[`uDirectionalLights[${i}].far`] = light._far || 100;
        sharedUniforms[`uDirectionalLights[${i}].bias`] = light.bias || 0.1;
        sharedUniforms[`uDirectionalLights[${i}].shadowMapSize`] =
          light.castShadows && light._shadowMap
            ? [light._shadowMap.width, light._shadowMap.height]
            : [0, 0];
        sharedUniforms[`uDirectionalLightShadowMaps[${i}]`] = light.castShadows
          ? light._shadowMap
          : dummyTexture2D;
      }

      for (let i = 0; i < spotLights.length; i++) {
        const lightEntity = spotLights[i];
        const light = lightEntity.spotLight;
        standardRendererSystem.checkLight(light);

        sharedUniforms[`uSpotLights[${i}].position`] =
          lightEntity._transform.worldPosition;
        sharedUniforms[`uSpotLights[${i}].direction`] = light._direction;
        sharedUniforms[`uSpotLights[${i}].color`] = light.color.map((c, j) => {
          if (j < 3) return Math.pow(c * light.intensity, 1.0 / 2.2);
          else return c;
        });
        sharedUniforms[`uSpotLights[${i}].angle`] = light.angle;
        sharedUniforms[`uSpotLights[${i}].innerAngle`] = light.innerAngle;
        sharedUniforms[`uSpotLights[${i}].range`] = light.range;
        sharedUniforms[`uSpotLights[${i}].castShadows`] = light.castShadows;
        sharedUniforms[`uSpotLights[${i}].projectionMatrix`] =
          light._projectionMatrix;
        sharedUniforms[`uSpotLights[${i}].viewMatrix`] = light._viewMatrix;
        sharedUniforms[`uSpotLights[${i}].near`] = light._near || 0.1;
        sharedUniforms[`uSpotLights[${i}].far`] = light._far || 100;
        sharedUniforms[`uSpotLights[${i}].bias`] = light.bias || 0.1;
        sharedUniforms[`uSpotLights[${i}].shadowMapSize`] = light.castShadows
          ? [light._shadowMap.width, light._shadowMap.height]
          : [0, 0];
        sharedUniforms[`uSpotLightShadowMaps[${i}]`] =
          light.castShadows && light._shadowMap
            ? light._shadowMap
            : dummyTexture2D;
      }

      for (let i = 0; i < pointLights.length; i++) {
        const lightEntity = pointLights[i];
        const light = lightEntity.pointLight;
        standardRendererSystem.checkLight(light);

        sharedUniforms[`uPointLights[${i}].position`] =
          lightEntity._transform.worldPosition;
        sharedUniforms[`uPointLights[${i}].color`] = light.color.map((c, j) => {
          if (j < 3) return Math.pow(c * light.intensity, 1.0 / 2.2);
          else return c;
        });
        sharedUniforms[`uPointLights[${i}].range`] = light.range;
        sharedUniforms[`uPointLights[${i}].castShadows`] = light.castShadows;
        sharedUniforms[`uPointLights[${i}].bias`] = light.bias || 0.1;
        sharedUniforms[`uPointLights[${i}].shadowMapSize`] = light.castShadows
          ? [light._shadowCubemap.width, light._shadowCubemap.height]
          : [0, 0];
        sharedUniforms[`uPointLightShadowMaps[${i}]`] =
          light.castShadows && light._shadowCubemap
            ? light._shadowCubemap
            : dummyTextureCube;
      }

      // TODO: dispose if no areaLights
      if (areaLights.length) {
        ltc_mat ||= ctx.texture2D({
          name: "areaLightMatTexture",
          data: AreaLightsData.mat,
          width: 64,
          height: 64,
          pixelFormat: ctx.PixelFormat.RGBA32F,
          encoding: ctx.Encoding.Linear,
          min: ctx.Filter.Linear,
          mag: ctx.Filter.Linear,
        });
        ltc_mag ||= ctx.texture2D({
          name: "areaLightMagTexture",
          data: AreaLightsData.mag,
          width: 64,
          height: 64,
          pixelFormat: ctx.PixelFormat.R32F,
          encoding: ctx.Encoding.Linear,
          min: ctx.Filter.Linear,
          mag: ctx.Filter.Linear,
        });
      }

      for (let i = 0; i < areaLights.length; i++) {
        const lightEntity = areaLights[i];
        const light = lightEntity.areaLight;
        sharedUniforms.ltc_mat = ltc_mat;
        sharedUniforms.ltc_mag = ltc_mag;
        sharedUniforms[`uAreaLights[${i}].position`] =
          lightEntity.transform.position;
        // TODO: mix color and intensity
        sharedUniforms[`uAreaLights[${i}].color`] = light.color;
        sharedUniforms[`uAreaLights[${i}].intensity`] = light.intensity;
        sharedUniforms[`uAreaLights[${i}].rotation`] =
          lightEntity.transform.rotation;
        sharedUniforms[`uAreaLights[${i}].size`] = [
          lightEntity.transform.scale[0] / 2,
          lightEntity.transform.scale[1] / 2,
        ];
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
    render(renderView, entities, opts) {
      const { camera, cameraEntity } = renderView;
      const {
        shadowMapping,
        shadowMappingLight,
        transparent,
        backgroundColorTexture,
        shadowQuality,
        debugRender,
      } = opts;

      const pipelineOptions = {
        ambientLights: [],
        directionalLights: [],
        pointLights: [],
        spotLights: [],
        areaLights: [],
        reflectionProbes: entities.filter((e) => e.reflectionProbe),
        depthPassOnly: shadowMapping,
        // useSSAO: false,
        // postProcessingCmp &&
        // postProcessingCmp.enabled &&
        // postProcessingCmp.ssao,
        useTonemapping: false, //!(postProcessingCmp && postProcessingCmp.enabled),
        shadowQuality,
        debugRender,
      };

      const sharedUniforms = {
        //uOutputEncoding: renderPipelineSystem.outputEncoding,
        uOutputEncoding: ctx.Encoding.Linear,
        uScreenSize: [renderView.viewport[2], renderView.viewport[3]],
      };

      if (!shadowMapping) {
        pipelineOptions.ambientLights = entities.filter((e) => e.ambientLight);
        pipelineOptions.directionalLights = entities.filter(
          (e) => e.directionalLight
        );
        pipelineOptions.pointLights = entities.filter((e) => e.pointLight);
        pipelineOptions.spotLights = entities.filter((e) => e.spotLight);
        pipelineOptions.areaLights = entities.filter((e) => e.areaLight);

        this.gatherLightsInfo(pipelineOptions, sharedUniforms);
        this.gatherReflectionProbeInfo(
          pipelineOptions.reflectionProbes,
          sharedUniforms
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

      sharedUniforms.uCaptureTexture = backgroundColorTexture;

      const renderableEntities = entities.filter(
        (e) =>
          e.geometry &&
          e.material &&
          e.material.type === undefined &&
          (!shadowMapping || e.material.castShadows) &&
          (transparent ? e.material.blend : !e.material.blend)
      );

      for (let i = 0; i < renderableEntities.length; i++) {
        const renderableEntity = renderableEntities[i];
        const {
          _geometry: geometry,
          _transform: transform,
          material,
        } = renderableEntity;

        if (!this.checkRenderableEntity(renderableEntity)) continue;

        // Get pipeline and program from cache. Also computes this.materialUniforms
        const pipeline = this.getPipeline(
          ctx,
          renderableEntity,
          pipelineOptions
        );

        // Get all uniforms
        const cachedUniforms = {};
        cachedUniforms.uModelMatrix = transform.modelMatrix; //FIXME: bypasses need for transformSystem access
        cachedUniforms.uNormalScale = 1; // TODO: uniform
        // cachedUniforms.uAlphaTest = material.alphaTest;
        // cachedUniforms.uAlphaMap = material.alphaMap;
        cachedUniforms.uReflectance =
          material.reflectance !== undefined ? material.reflectance : 0.5;
        cachedUniforms.uExposure = 1.0;

        cachedUniforms.uPointSize = material.pointSize || 1;
        // TODO: why is this here
        cachedUniforms.uMetallicRoughnessTexture =
          material.metallicRoughnessTexture;
        renderableEntity._uniforms = cachedUniforms;

        sharedUniforms.uRefraction =
          0.1 * (material.refraction !== undefined ? material.refraction : 0.5);

        Object.assign(cachedUniforms, sharedUniforms, this.materialUniforms);

        // FIXME: this is expensive and not cached
        let viewMatrix;
        if (shadowMappingLight && shadowMappingLight._viewMatrix) {
          viewMatrix = shadowMappingLight._viewMatrix;
        } else {
          viewMatrix = camera.viewMatrix;
        }

        const normalMat = mat4.copy(viewMatrix);
        mat4.mult(normalMat, transform.modelMatrix);
        mat4.invert(normalMat);
        mat4.transpose(normalMat);
        cachedUniforms.uNormalMatrix = mat3.fromMat4(mat3.create(), normalMat);

        const cmd = {
          name: transparent ? "drawTransparentGeometryCmd" : "drawGeometryCmd",
          attributes: geometry.attributes,
          indices: geometry.indices,
          count: geometry.count,
          pipeline,
          uniforms: cachedUniforms,
          instances: geometry.instances,
        };
        if (renderableEntity.geometry.multiDraw) {
          cmd.multiDraw = renderableEntity.geometry.multiDraw;
        }
        ctx.submit(cmd);
      }
    },
    renderStages: {
      shadow: (renderView, entitites, opts = {}) => {
        standardRendererSystem.render(renderView, entitites, opts);
      },
      opaque: (renderView, entitites, opts = {}) => {
        opts.debugRender = standardRendererSystem.debugRender;
        standardRendererSystem.render(renderView, entitites, opts);
      },
      transparent: (renderView, entitites, opts = {}) => {
        // opts.debugRender = standardRendererSystem.debugRender;
        standardRendererSystem.render(renderView, entitites, {
          ...opts,
          transparent: true,
        });
      },
    },
    update: () => {},
  };
  return standardRendererSystem;
};
