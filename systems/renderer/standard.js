import { vec3, vec4, mat3, mat4, mat2x3 } from "pex-math";
import {
  pipeline as SHADERS,
  parser as ShaderParser,
} from "./pex-shaders/index.js";
import * as AreaLightsData from "./area-light-data.js";
import { TEMP_MAT2X3 } from "../../utils.js";

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
  [["material", "baseColorMap"], "BASE_COLOR_MAP", { type: "texture", uniform: "uBaseColorMap" }],
  [["material", "emissiveColorMap"], "EMISSIVE_COLOR_MAP", { type: "texture", uniform: "uEmissiveColorMap" }],
  [["material", "normalMap"], "NORMAL_MAP", { type: "texture", uniform: "uNormalMap" }],
  [["material", "roughnessMap"], "ROUGHNESS_MAP", { type: "texture", uniform: "uRoughnessMap" }],
  [["material", "metallicMap"], "METALLIC_MAP", { type: "texture", uniform: "uMetallicMap" }],
  [["material", "metallicRoughnessMap"], "METALLIC_ROUGHNESS_MAP", { type: "texture", uniform: "uMetallicRoughnessMap" }],
  [["material", "occlusionMap"], "OCCLUSION_MAP", { type: "texture", uniform: "uOcclusionMap" }],
  [["material", "alphaTest"], "USE_ALPHA_TEST", { uniform: "uAlphaTest" }],
  [["material", "alphaMap"], "ALPHA_MAP", { type: "texture", uniform: "uAlphaMap" }],
  [["material", "clearCoat"], "USE_CLEAR_COAT", { uniform: "uClearCoat" }],
  [["material", "clearCoatRoughness"], "USE_CLEAR_COAT_ROUGHNESS", { uniform: "uClearCoatRoughness" }],
  [["material", "clearCoatMap"], "CLEAR_COAT_MAP", { type: "texture", uniform: "uClearCoatMap" }],
  [["material", "clearCoatRoughnessMap"], "CLEAR_COAT_ROUGHNESS_MAP", { type: "texture", uniform: "uClearCoatRoughnessMap" }],
  [["material", "clearCoatNormalMap"], "CLEAR_COAT_NORMAL_MAP", { type: "texture", uniform: "uClearCoatNormalMap" }],
  [["material", "clearCoatNormalMapScale"], "", { uniform: "uClearCoatNormalMapScale" }],
  [["material", "sheenColor"], "USE_SHEEN", { uniform: "uSheenColor" }],
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

function buildProgram(ctx, vert, frag) {
  let program = null;
  try {
    program = ctx.program({ vert, frag });
  } catch (e) {
    program = ctx.program({
      vert: SHADERS.error.vert,
      frag: SHADERS.error.frag,
    });
    throw e;
  }
  return program;
}

function getMaterialProgramAndFlags(ctx, entity, options = {}) {
  const { _geometry: geometry, material } = entity;

  const flags = [
    //[["ctx", "capabilities", "maxColorAttachments"], "USE_DRAW_BUFFERS"
    ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
    // (!geometry.attributes.aNormal || material.unlit) && "USE_UNLIT_WORKFLOW",
    // "USE_UNLIT_WORKFLOW",
    "SHADOW_QUALITY " +
      (entity.material.receiveShadows ? options.shadowQuality : 0),
  ];
  let materialUniforms = {};

  for (let i = 0; i < flagDefs.length; i++) {
    const [path, defineName, opts = {}] = flagDefs[i];

    if (opts.requires && !flags.includes(opts.requires)) continue;

    //TODO: GC
    const obj = { ...entity, geometry, options };
    let value = obj;

    for (let j = 0; j < path.length; j++) {
      value = value[path[j]];
    }

    if (opts.type == "counter") {
      flags.push(`${defineName} ${value}`);
    } else if (opts.type == "texture" && value) {
      flags.push(`USE_${defineName}`);
      flags.push(`${defineName}_TEX_COORD_INDEX ${value.texCoord || 0}`);
      materialUniforms[opts.uniform] = value.texture || value;

      if (value.texture && (value.offset || value.rotation || value.scale)) {
        mat2x3.identity(TEMP_MAT2X3);
        mat2x3.translate(TEMP_MAT2X3, value.offset || [0, 0]);
        mat2x3.rotate(TEMP_MAT2X3, -value.rotation || 0);
        mat2x3.scale(TEMP_MAT2X3, value.scale || [1, 1]);

        value.texCoordTransformMatrix = mat3.fromMat2x3(
          value.texCoordTransformMatrix
            ? mat3.identity(value.texCoordTransformMatrix)
            : mat3.create(),
          TEMP_MAT2X3
        );
      }
      if (value.texCoordTransformMatrix) {
        flags.push(`USE_${defineName}_TEX_COORD_TRANSFORM`);
        materialUniforms[opts.uniform + "TexCoordTransform"] =
          value.texCoordTransformMatrix;
      }
    } else if (value !== undefined || opts.default !== undefined) {
      if (opts.type !== "boolean" || value) {
        flags.push(defineName);
      } else {
        if (opts.fallback) {
          flags.push(opts.fallback);
        }
      }
      if (opts.uniform) {
        materialUniforms[opts.uniform] =
          value !== undefined ? value : opts.default;
      }
    } else if (opts.fallback) {
      flags.push(opts.fallback);
    }
  }

  let { vert, frag } = material;

  vert ||= SHADERS.material.vert;
  frag ||= options.depthPassOnly
    ? SHADERS.depthPass.frag
    : SHADERS.material.frag;

  if (material.hooks) {
    if (material.hooks.vert) {
      for (let [hookName, hookCode] of Object.entries(material.hooks.vert)) {
        const hook = `#define HOOK_VERT_${hookName}`;
        vert = vert.replace(hook, hookCode);
      }
    }
    if (material.hooks.frag) {
      for (let [hookName, hookCode] of Object.entries(material.hooks.frag)) {
        const hook = `#define HOOK_FRAG_${hookName}`;
        frag = frag.replace(hook, hookCode);
      }
    }
    if (material.hooks.uniforms) {
      const hookUniforms = material.hooks.uniforms(entity, []);
      Object.assign(materialUniforms, hookUniforms);
    }
  }

  let debugRender = options.debugRender;
  if (debugRender) {
    let scale = "";
    let pow = 1;
    let mode = debugRender.toLowerCase();
    if (mode.includes("normal")) {
      scale = "*0.5 + 0.5";
    }
    if (mode.includes("texcoord")) {
      debugRender = `vec3(${debugRender}, 0.0)`;
    }
    if (
      mode.includes("ao") ||
      mode.includes("normal") ||
      mode.includes("metallic") ||
      mode.includes("roughness")
    ) {
      pow = "2.2";
    }
    frag = frag.replace(
      "gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);",
      `gl_FragData[0] = vec4(pow(vec3(${debugRender}${scale}), vec3(${pow})), 1.0);`
    );
  }

  return {
    flags: flags.flat().filter(Boolean),
    vert,
    frag,
    materialUniforms,
  };
}

export default ({ ctx }) => {
  const pipelineCache = {};
  const programCacheMap = {
    values: [],
    getValue(flags, vert, frag) {
      for (let i = 0; i < this.values.length; i++) {
        const v = this.values[i];
        if (v.frag === frag && v.vert === vert) {
          if (v.flags.length === flags.length) {
            let found = true;
            for (let j = 0; j < flags.length; j++) {
              if (v.flags[j] !== flags[j]) {
                found = false;
                break;
              }
            }
            if (found) {
              return v.program;
            }
          }
        }
      }
      return false;
    },
    setValue(flags, vert, frag, program) {
      this.values.push({ flags, vert, frag, program });
    },
  };

  const dummyTexture2D = ctx.texture2D({ width: 4, height: 4 });
  const dummyTextureCube = ctx.textureCube({ width: 4, height: 4 });

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

  function getMaterialProgram(ctx, entity, options) {
    const { flags, vert, frag, materialUniforms } = getMaterialProgramAndFlags(
      ctx,
      entity,
      options
    );
    entity._flags = flags;

    const extensions = {};
    if (!ctx.capabilities.isWebGL2) {
      extensions.GL_OES_standard_derivatives = "require";
      if (ctx.capabilities.maxColorAttachments > 1) {
        extensions.GL_EXT_draw_buffers = "enable";
      }
    }

    if (options.debugRender) flags.push(options.debugRender);

    let program = programCacheMap.getValue(flags, vert, frag);

    if (!program) {
      const defines = options.debugRender
        ? flags.filter((flag) => flag !== options.debugRender)
        : flags;
      const vertSrc = ShaderParser.parse(ctx, vert, {
        stage: "vertex",
        defines,
        ...options,
      });
      const fragSrc = ShaderParser.parse(ctx, frag, {
        stage: "fragment",
        extensions,
        defines,
        ...options,
      });

      try {
        console.debug("render-system", "New program", flags, entity);
        program = buildProgram(
          ctx,
          ShaderParser.replaceStrings(vertSrc, options),
          ShaderParser.replaceStrings(fragSrc, options)
        );
        programCacheMap.setValue(flags, vert, frag, program);
      } catch (error) {
        console.error(error);
        console.warn(
          "glsl error",
          ShaderParser.getFormattedError(error, {
            vert: vertSrc,
            frag: fragSrc,
          })
        );
      }
    }
    return { program, materialUniforms };
  }

  function gatherLightInfo({ entities, sharedUniforms }) {
    // TODO: reduce
    const ambientLights = entities.filter((e) => e.ambientLight);
    const directionalLights = entities.filter((e) => e.directionalLight);
    const pointLights = entities.filter((e) => e.pointLight);
    const spotLights = entities.filter((e) => e.spotLight);
    const areaLights = entities.filter((e) => e.areaLight);

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
      sharedUniforms[`uDirectionalLights[${i}].viewMatrix`] = light._viewMatrix;
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
      sharedUniforms[`uPointLightShadowMaps[${i}]`] =
        light.castShadows && light._shadowCubemap
          ? light._shadowCubemap
          : dummyTextureCube;
    }

    // TODO: dispose if no areaLights
    if (areaLights.length) {
      ltc_mat ||= ctx.texture2D({
        data: AreaLightsData.mat,
        width: 64,
        height: 64,
        pixelFormat: ctx.PixelFormat.RGBA32F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
      });
      ltc_mag ||= ctx.texture2D({
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
  }

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

  function getGeometryPipeline(ctx, entity, opts) {
    const { material, _geometry: geometry } = entity;
    const { program, materialUniforms } = getMaterialProgram(ctx, entity, opts);

    const hash = `${material.id}_${program.id}_${
      geometry.primitive
    }_${Object.entries(pipelineMaterialDefaults)
      .map(([key, value]) => material[key] ?? value)
      .join("_")}`;

    let pipeline = pipelineCache[hash];
    if (!pipeline || material.needsPipelineUpdate) {
      material.needsPipelineUpdate = false;
      pipeline = ctx.pipeline({
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
      pipelineCache[hash] = pipeline;
    }

    return { pipeline, materialUniforms };
  }

  function gatherReflectionProbeInfo({ entities, sharedUniforms }) {
    const reflectionProbes = entities.filter((e) => e.reflectionProbe);
    if (
      reflectionProbes.length > 0 &&
      standardRendererSystem.checkReflectionProbe(reflectionProbes[0])
    ) {
      // && reflectionProbes[0]._reflectionMap) {
      sharedUniforms.uReflectionMap =
        reflectionProbes[0]._reflectionProbe._reflectionMap;
      sharedUniforms.uReflectionMapSize =
        reflectionProbes[0]._reflectionProbe._reflectionMap.width;
      sharedUniforms.uReflectionMapEncoding =
        reflectionProbes[0]._reflectionProbe._reflectionMap.encoding;
    }
  }

  function render(renderView, entities, opts) {
    const { camera, cameraEntity } = renderView;
    const {
      shadowMapping,
      shadowMappingLight,
      transparent,
      backgroundColorTexture,
    } = opts;

    const sharedUniforms = {
      //uOutputEncoding: renderPipelineSystem.outputEncoding,
      uOutputEncoding: ctx.Encoding.Linear,
      uScreenSize: [renderView.viewport[2], renderView.viewport[3]],
    };

    if (!shadowMapping) {
      gatherLightInfo({ entities, sharedUniforms });
      gatherReflectionProbeInfo({
        entities,
        sharedUniforms,
        shadowMapping,
      });
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
        (transparent ? e.material.blend : !e.material.blend) //TODO: what is transparent?
    ); //hardcoded e.drawSegments

    // const opaqueEntities = renderableEntities.filter((e) => !e.material.blend);
    for (let i = 0; i < renderableEntities.length; i++) {
      const renderableEntity = renderableEntities[i];
      const {
        _geometry: geometry,
        _transform: transform,
        material,
        skin,
      } = renderableEntity;

      if (!standardRendererSystem.checkRenderableEntity(renderableEntity))
        continue;

      const cachedUniforms = {};
      cachedUniforms.uModelMatrix = transform.modelMatrix; //FIXME: bypasses need for transformSystem access
      cachedUniforms.uNormalScale = 1; // TODO: uniform
      // cachedUniforms.uAlphaTest = material.alphaTest;
      // cachedUniforms.uAlphaMap = material.alphaMap;
      cachedUniforms.uReflectance =
        material.reflectance !== undefined ? material.reflectance : 0.5;
      cachedUniforms.uExposure = 1.0;

      cachedUniforms.uPointSize = material.pointSize || 1;
      cachedUniforms.uMetallicRoughnessMap = material.metallicRoughnessMap;
      renderableEntity._uniforms = cachedUniforms;

      sharedUniforms.uRefraction =
        0.1 * (material.refraction !== undefined ? material.refraction : 0.5);

      //duplicated variables
      const ambientLights = shadowMapping
        ? []
        : entities.filter((e) => e.ambientLight);
      const directionalLights = shadowMapping
        ? []
        : entities.filter((e) => e.directionalLight);
      const pointLights = shadowMapping
        ? []
        : entities.filter((e) => e.pointLight);
      const spotLights = shadowMapping
        ? []
        : entities.filter((e) => e.spotLight);
      const areaLights = shadowMapping
        ? []
        : entities.filter((e) => e.areaLight);
      const reflectionProbes = shadowMapping
        ? []
        : entities.filter((e) => e.reflectionProbe);

      const { pipeline, materialUniforms } = getGeometryPipeline(
        ctx,
        renderableEntity,
        {
          ambientLights,
          directionalLights,
          pointLights,
          spotLights,
          areaLights,
          reflectionProbes,
          depthPassOnly: shadowMapping,
          useSSAO: false,
          // postProcessingCmp &&
          // postProcessingCmp.enabled &&
          // postProcessingCmp.ssao,
          useTonemapping: false, //!(postProcessingCmp && postProcessingCmp.enabled),
          shadowQuality: opts.shadowQuality,
          debugRender: opts.debugRender,
        }
      );

      Object.assign(cachedUniforms, sharedUniforms);
      Object.assign(cachedUniforms, materialUniforms);

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
        name: transparent ? "drawTransparentGeometry" : "drawGeometry",
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
  }

  const standardRendererSystem = {
    type: "standard-renderer",
    debugRender: "",
    checkLight(light) {
      if (light.castShadows && !(light._shadowMap || light._shadowCubemap)) {
        console.warn(
          `"${this.type}": light component missing shadowMap. Add a renderPipeplineSystem.update(entities).`
        );
      } else {
        return true;
      }
    },
    checkReflectionProbe(reflectionProbe) {
      if (!reflectionProbe._reflectionProbe?._reflectionMap) {
        console.warn(
          `"${this.type}": reflectionProbe component missing _reflectionProbe. Add a reflectionProbeSystem.update(entities, { renderers: [skyboxRendererSystem] }).`
        );
      } else {
        return true;
      }
    },
    checkRenderableEntity(entity) {
      if (!entity._geometry) {
        console.warn(
          `"${this.type}": entity missing _geometry. Add a geometrySystem.update(entities).`
        );
      } else if (!entity._transform) {
        console.warn(
          `"${this.type}": entity missing _transform. Add a transformSystem.update(entities).`
        );
      } else {
        return true;
      }
    },
    renderStages: {
      shadow: (renderView, entitites, opts = {}) => {
        render(renderView, entitites, opts);
      },
      opaque: (renderView, entitites, opts = {}) => {
        opts.debugRender = standardRendererSystem.debugRender;
        render(renderView, entitites, opts);
      },
      transparent: (renderView, entitites, opts = {}) => {
        // opts.debugRender = standardRendererSystem.debugRender;
        render(renderView, entitites, { ...opts, transparent: true });
      },
    },
    update: () => {},
  };
  return standardRendererSystem;
};
