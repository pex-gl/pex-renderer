import { pipeline as SHADERS, chunks as SHADERS_CHUNKS } from "pex-shaders";
import { es300Fragment, es300Vertex, getFileExtension } from "../utils.js";
import { vec3, vec4, mat3, mat4 } from "pex-math";

export default function createRenderSystem(opts) {
  const ctx = opts.ctx;

  const dummyTexture2D = ctx.texture2D({ width: 4, height: 4 });
  const dummyTextureCube = ctx.textureCube({ width: 4, height: 4 });
  const tempMat4 = mat4.create(); //FIXME

  let clearCmd = {
    pass: ctx.pass({
      clearColor: [0, 0, 0, 1],
    }),
  };

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

  const renderSystem = {
    cache: {},
    debug: true,
    shadowQuality: 1,
  };

  const getFlagsFromObject = (obj, flags, fn = (flag) => flag) =>
    Object.values(
      Object.fromEntries(
        Object.entries(flags)
          .filter(([key]) => obj[key])
          .map(([key, flag]) => [key, fn(flag, obj[key])])
      )
    );

  const parseMapFlags = (flag, map) => [
    `USE_${flag}`,
    `${flag}_TEX_COORD_INDEX ${map.texCoord || 0}`,
    map.texCoordTransformMatrix && `USE_${flag}_TEX_COORD_TRANSFORM`,
  ];

  const ATTRIBUTES_FLAGS = {
    aNormal: "USE_NORMALS",
    aTangent: "USE_TANGENTS",
    aTexCoord0: "USE_TEXCOORD_0",
    aTexCoord1: "USE_TEXCOORD_1",
    aOffset: "USE_INSTANCED_OFFSET",
    aScale: "USE_INSTANCED_SCALE",
    aRotation: "USE_INSTANCED_ROTATION",
    aColor: "USE_INSTANCED_COLOR",
    aVertexColor: "USE_VERTEX_COLORS",
  };

  const SHARED_MATERIALS_FLAGS = {
    displacementMap: "USE_DISPLACEMENT_MAP", // Not a glTF material property
    alphaTest: "USE_ALPHA_TEST",
  };

  const SHARED_MATERIAL_MAPS_FLAGS = {
    baseColorMap: "BASE_COLOR_MAP",
    alphaMap: "ALPHA_MAP",
  };

  const MATERIALS_FLAGS = {
    useSpecularGlossinessWorkflow: "USE_SPECULAR_GLOSSINESS_WORKFLOW",
    blend: "USE_BLEND",
  };
  const MATERIAL_MAPS_FLAGS = {
    diffuseMap: "DIFFUSE_MAP",
    specularGlossinessMap: "SPECULAR_GLOSSINESS_MAP",
    metallicMap: "METALLIC_MAP",
    roughnessMap: "ROUGHNESS_MAP",
    metallicRoughnessMap: "METALLIC_ROUGHNESS_MAP",
    occlusionMap: "OCCLUSION_MAP",
    normalMap: "NORMAL_MAP",
    emissiveColorMap: "EMISSIVE_COLOR_MAP",
    clearCoatMap: "CLEAR_COAT_MAP",
    clearCoatRoughnessMap: "CLEAR_COAT_ROUGHNESS_MAP",
    clearCoatNormalMap: "CLEAR_COAT_NORMAL_MAP",
    sheenColorMap: "SHEEN_COLOR_MAP",
  };

  const DEPTH_PASS_FLAGS = [
    "SHADOW_QUALITY 0",
    "NUM_AMBIENT_LIGHTS 0",
    "NUM_DIRECTIONAL_LIGHTS 0",
    "NUM_POINT_LIGHTS 0",
    "NUM_SPOT_LIGHTS 0",
    "NUM_AREA_LIGHTS 0",
  ];

  function buildProgram(vertSrc, fragSrc) {
    let program = null;
    try {
      program = ctx.program({ vert: vertSrc, frag: fragSrc });
    } catch (e) {
      console.error("pex-renderer glsl error", e, fragSrc);
      program = ctx.program({
        vert: SHADERS.error.vert,
        frag: SHADERS.error.frag,
      });
      throw e;
    }
    return program;
  }

  function getMaterialProgramAndFlagsOld(
    ctx,
    entity,
    options = {},
    // TODO: pass shadowQuality as option
    State
  ) {
    const { _geometry: geometry, material, skin } = entity;
    const flags = [
      ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS", // TODO: move into getExtensions
      (!geometry.attributes.aNormal || material.unlit) && "USE_UNLIT_WORKFLOW",
      ...getFlagsFromObject(geometry.attributes, ATTRIBUTES_FLAGS),
      ...getFlagsFromObject(material, SHARED_MATERIALS_FLAGS),
      ...getFlagsFromObject(
        material,
        SHARED_MATERIAL_MAPS_FLAGS,
        parseMapFlags
      ),
      skin && ["USE_SKIN", `NUM_JOINTS ${skin.joints.length}`],
    ];

    let { vert, frag } = material;

    if (options.depthPrePassOnly) {
      vert ||= SHADERS.depthPass.vert;
      frag ||= SHADERS.depthPrePass.frag;

      flags.push("DEPTH_PRE_PASS_ONLY", ...DEPTH_PASS_FLAGS);
    } else if (options.depthPassOnly) {
      vert ||= SHADERS.depthPass.vert;
      frag ||= SHADERS.depthPass.frag;

      flags.push("DEPTH_PASS_ONLY", ...DEPTH_PASS_FLAGS);
    } else {
      vert ||= SHADERS.material.vert;
      frag ||= SHADERS.material.frag;

      flags.push(
        `SHADOW_QUALITY ${
          material.receiveShadows ? renderSystem.shadowQuality : 0
        }`,
        ...getFlagsFromObject(material, MATERIALS_FLAGS),
        ...getFlagsFromObject(material, MATERIAL_MAPS_FLAGS, parseMapFlags),
        !material.useSpecularGlossinessWorkflow &&
          "USE_METALLIC_ROUGHNESS_WORKFLOW",
        // TODO: is checking for "null" required here
        material.emissiveColor != null && "USE_EMISSIVE_COLOR",
        material.clearCoat != null && "USE_CLEAR_COAT",
        material.sheenColor != null && "USE_SHEEN",
        `NUM_AMBIENT_LIGHTS ${options.numAmbientLights || 0}`,
        `NUM_DIRECTIONAL_LIGHTS ${options.numDirectionalLights || 0}`,
        `NUM_POINT_LIGHTS ${options.numPointLights || 0}`,
        `NUM_SPOT_LIGHTS ${options.numSpotLights || 0}`,
        `NUM_AREA_LIGHTS ${options.numAreaLights || 0}`,
        options.useSSAO && "USE_AO",
        options.useReflectionProbes && "USE_REFLECTION_PROBES",
        options.useTonemapping && "USE_TONEMAPPING"
      );
    }

    return {
      flags: flags
        .flat()
        .filter(Boolean)
        .map((flag) => `#define ${flag}`),
      vert,
      frag,
    };
  }

  // prettier-ignore
  const flagDefs = [
    [["options", "ambientLights", "length"], "NUM_AMBIENT_LIGHTS", { type: "counter" }],
    [["options", "directionalLights", "length"], "NUM_DIRECTIONAL_LIGHTS", { type: "counter" }],
    [["options", "pointLights", "length"], "NUM_POINT_LIGHTS", { type: "counter" }],
    [["options", "spotLights", "length"], "NUM_SPOT_LIGHTS", { type: "counter" }],
    [["options", "areaLights", "length"], "NUM_AREA_LIGHTS", { type: "counter" }],
    [["options", "reflectionProbes", "length"], "USE_REFLECTION_PROBES"],    
    [["material", "baseColorMap"], "BASE_COLOR_MAP", { type: "textureMap", uniform: "uBaseColorMap"}],
    [["material", "normalMap"], "NORMAL_MAP", { type: "textureMap", uniform: "uNormalMap"}],
    [["material", "metallicRoughnessMap"], "METALLIC_ROUGHNESS_MAP", { type: "textureMap", uniform: "uMetallicRoughnessMap"}],
    [["geometry", "attributes", "aNormal"], "USE_NORMALS"],
    [["geometry", "attributes", "aTangent"], "USE_TANGENTS"],
    [["geometry", "attributes", "aTexCoord0"], "USE_TEXCOORD_0"],
    [["geometry", "attributes", "aTexCoord1"], "USE_TEXCOORD_1"],
    [["geometry", "attributes", "aOffset"], "USE_INSTANCED_OFFSET"],
    [["geometry", "attributes", "aScale"], "USE_INSTANCED_SCALE"],
    [["geometry", "attributes", "aRotation"], "USE_INSTANCED_ROTATION"],
    [["geometry", "attributes", "aColor"], "USE_INSTANCED_COLOR"],
    [["geometry", "attributes", "aVertexColor"], "USE_VERTEX_COLORS"],
  ];

  function getMaterialProgramAndFlags(
    ctx,
    entity,
    options = {},
    // TODO: pass shadowQuality as option
    State
  ) {
    const { _geometry: geometry, material, skin } = entity;
    const obj = {
      geometry,
      material,
      options,
    };

    let flags = [
      //[["ctx", "capabilities", "maxColorAttachments"], "USE_DRAW_BUFFERS"
      ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
      // (!geometry.attributes.aNormal || material.unlit) && "USE_UNLIT_WORKFLOW",
      // "USE_UNLIT_WORKFLOW",
      "USE_METALLIC_ROUGHNESS_WORKFLOW",
      "SHADOW_QUALITY 0",
    ];

    for (let i = 0; i < flagDefs.length; i++) {
      const [path, defineName, opts = {}] = flagDefs[i];

      let value = obj;
      for (let j = 0; j < path.length; j++) {
        value = value[path[j]];
      }

      if (opts.type == "counter") flags.push(`${defineName} ${value}`);
      else if (opts.type == "textureMap" && value) {
        flags.push(`USE_${defineName}`);
        flags.push(`${defineName}_TEX_COORD_INDEX 0`);
      } else if (value) {
        flags.push(defineName);
      }
    }

    // console.log("flags", flags);

    let { vert, frag } = material;

    vert ||= SHADERS.material.vert;
    frag ||= SHADERS.material.frag;
    return {
      flags: flags
        .flat()
        .filter(Boolean)
        .map((flag) => `#define ${flag}`),
      vert,
      frag,
    };
  }

  function getExtensions() {
    return ctx.capabilities.isWebGL2
      ? ""
      : /* glsl */ `
#extension GL_OES_standard_derivatives : require
${
  ctx.capabilities.maxColorAttachments > 1
    ? `#extension GL_EXT_draw_buffers : enable`
    : ""
}
`;
  }

  function parseShader(string, options) {
    // Unroll loop
    const unrollLoopPattern =
      /#pragma unroll_loop[\s]+?for \(int i = (\d+); i < (\d+|\D+); i\+\+\) \{([\s\S]+?)(?=\})\}/g;

    string = string.replace(unrollLoopPattern, (match, start, end, snippet) => {
      let unroll = "";

      // Replace lights number
      end = end
        .replace(/NUM_AMBIENT_LIGHTS/g, options.numAmbientLights || 0)
        .replace(/NUM_DIRECTIONAL_LIGHTS/g, options.numDirectionalLights || 0)
        .replace(/NUM_POINT_LIGHTS/g, options.numPointLights || 0)
        .replace(/NUM_SPOT_LIGHTS/g, options.numSpotLights || 0)
        .replace(/NUM_AREA_LIGHTS/g, options.numAreaLights || 0);

      for (let i = Number.parseInt(start); i < Number.parseInt(end); i++) {
        unroll += snippet.replace(/\[i\]/g, `[${i}]`);
      }

      return unroll;
    });

    return string;
  }

  function getMaterialProgram(ctx, entity, options) {
    const { flags, vert, frag } = getMaterialProgramAndFlags(
      ctx,
      entity,
      options
    );
    const extensions = getExtensions();
    const flagsStr = `${flags.join("\n")}\n`;
    const vertSrc = flagsStr + vert;
    const fragSrc = extensions + flagsStr + frag;
    let program = programCacheMap.getValue(flags, vert, frag);
    try {
      if (!program) {
        console.log("render-system", "New program", flags, entity);
        program = buildProgram(
          parseShader(
            ctx.capabilities.isWebGL2 ? es300Vertex(vertSrc) : vertSrc,
            options
          ),
          parseShader(
            ctx.capabilities.isWebGL2 ? es300Fragment(fragSrc, 3) : fragSrc,
            options
          )
        );
        programCacheMap.setValue(flags, vert, frag, program);
      }
    } catch (e) {
      console.error(e);
      console.log(vert);
      // console.log(frag);
    }
    return program;
  }

  function getGeometryPipeline(ctx, entity, opts) {
    const { material, _geometry: geometry } = entity;
    const program = getMaterialProgram(ctx, entity, opts);
    if (!pipelineCache) {
      pipelineCache = {};
    }
    const hash = `${material.id}_${program.id}_${geometry.primitive}`;
    let pipeline = pipelineCache[hash];
    if (!pipeline || material.needsPipelineUpdate) {
      material.needsPipelineUpdate = false;
      pipeline = ctx.pipeline({
        program,
        depthTest: material.depthTest,
        depthWrite: material.depthWrite,
        depthFunc: material.depthFunc || ctx.DepthFunc.Less,
        // blend: material.blend,
        // blendSrcRGBFactor: material.blendSrcRGBFactor,
        // blendSrcAlphaFactor: material.blendSrcAlphaFactor,
        // blendDstRGBFactor: material.blendDstRGBFactor,
        // blendDstAlphaFactor: material.blendDstAlphaFactor,
        cullFace: material.cullFace || true,
        cullFaceMode: material.cullFaceMode || ctx.Face.Back,
        primitive: geometry.primitive || ctx.Primitive.Triangles,
      });
      pipelineCache[hash] = pipeline;
    }

    return pipeline;
  }

  function drawMeshes(
    cameraEntity,
    shadowMapping,
    shadowMappingLight,
    entities,
    renderableEntities,
    skybox,
    forward
  ) {
    const camera = cameraEntity.camera;

    const sharedUniforms = {
      uOutputEncoding: ctx.Encoding.Gamma,
    };
    const ambientLights = entities.filter((e) => e.ambientLight);
    const directionalLights = entities.filter((e) => e.directionalLight);

    const pointLights = entities.filter((e) => e.pointLight);
    const spotLights = entities.filter((e) => e.spotLight);
    const areaLights = entities.filter((e) => e.areaLight);
    const reflectionProbes = entities.filter((e) => e.reflectionProbe);
    // const areaLights = entities.filter((e) => e.areaLight);

    // sharedUniforms.uCameraPosition = camera.entity.transform.worldPosition;
    sharedUniforms.uProjectionMatrix = camera.projectionMatrix;
    sharedUniforms.uViewMatrix = camera.viewMatrix;
    sharedUniforms.uInverseViewMatrix = camera.inverseViewMatrix; //TODO
    sharedUniforms.uCameraPosition = cameraEntity._transform.worldPosition;

    ambientLights.forEach((lightEntity, i) => {
      // console.log(
      //   "lightEntity.ambientLight.color",
      //   lightEntity.ambientLight.color
      // );
      sharedUniforms[`uAmbientLights[${i}].color`] =
        lightEntity.ambientLight.color;
    });

    directionalLights.forEach((lightEntity, i) => {
      const light = lightEntity.directionalLight;
      const dir4 = [0, 0, 1, 0]; // TODO: GC
      const dir = [0, 0, 0];
      vec4.multMat4(dir4, lightEntity._transform.modelMatrix);
      vec3.set(dir, dir4);

      // prettier-ignore
      {
      sharedUniforms[`uDirectionalLights[${i}].direction`] = dir;
      sharedUniforms[`uDirectionalLights[${i}].color`] = light.color;
      sharedUniforms[`uDirectionalLights[${i}].castShadows`] = light.castShadows;
      sharedUniforms[`uDirectionalLights[${i}].projectionMatrix`] = light._projectionMatrix || tempMat4; //FIXME
      sharedUniforms[`uDirectionalLights[${i}].viewMatrix`] = light._viewMatrix || tempMat4; //FIXME;
      sharedUniforms[`uDirectionalLights[${i}].near`] = light._near || 0.1;
      sharedUniforms[`uDirectionalLights[${i}].far`] = light._far || 100;
      sharedUniforms[`uDirectionalLights[${i}].bias`] = light.bias || 0;
      sharedUniforms[`uDirectionalLights[${i}].shadowMapSize`] = light.castShadows ? [light._shadowMap.width, light._shadowMap.height] : [0, 0];
      sharedUniforms[`uDirectionalLightShadowMaps[${i}]`] = light.castShadows ? light._shadowMap : dummyTexture2D;
      }
    });

    if (reflectionProbes.length > 0) {
      // && reflectionProbes[0]._reflectionMap) {
      sharedUniforms.uReflectionMap =
        reflectionProbes[0]._reflectionProbe._reflectionMap;
      sharedUniforms.uReflectionMapEncoding =
        reflectionProbes[0]._reflectionProbe._reflectionMap.encoding;
    }

    for (let i = 0; i < renderableEntities.length; i++) {
      const renderableEntity = renderableEntities[i];
      const {
        _geometry: geometry,
        _transform: transform,
        material,
        skin,
      } = renderableEntity;
      // const cachedUniforms = material._uniforms;
      const cachedUniforms = {};
      cachedUniforms.uModelMatrix = transform.modelMatrix; //FIXME: bypasses need for transformSystem access
      cachedUniforms.uBaseColor = material.baseColor;
      cachedUniforms.uBaseColorMap = material.baseColorMap;
      cachedUniforms.uRoughness = material.roughness;
      cachedUniforms.uMetallic = material.metallic;
      cachedUniforms.uNormalMap = material.normalMap;
      cachedUniforms.uNormalScale = 1;
      cachedUniforms.uReflectance = 0.5;

      cachedUniforms.uPointSize = 1;
      cachedUniforms.uMetallicRoughnessMap = material.metallicRoughnessMap;

      // uPointSize, uCameraPosition, uExposure, uSheenColor, uSheenRoughness, uReflectance, uClearCoat, uClearCoatRoughness, uReflectionMapEncoding, uEmissiveColor, uEmissiveIntensity, uMetallic, uRoughness, uReflectionMap

      const pipeline = getGeometryPipeline(ctx, renderableEntity, {
        numAmbientLights: ambientLights.length,
        numDirectionalLights: directionalLights.length,
        numPointLights: pointLights.length,
        numSpotLights: spotLights.length,
        numAreaLights: areaLights.length,
        ambientLights,
        directionalLights,
        pointLights,
        spotLights,
        areaLights,
        reflectionProbes,
        useSSAO: false,
        // postProcessingCmp &&
        // postProcessingCmp.enabled &&
        // postProcessingCmp.ssao,
        useTonemapping: true, //!(postProcessingCmp && postProcessingCmp.enabled),
      });

      Object.assign(cachedUniforms, sharedUniforms);

      const normalMat = mat4.copy(camera.viewMatrix);
      mat4.mult(normalMat, transform.modelMatrix);
      mat4.invert(normalMat);
      mat4.transpose(normalMat);
      cachedUniforms.uNormalMatrix = mat3.fromMat4(mat3.create(), normalMat);

      const cmd = {
        name: "drawGeometry",
        attributes: geometry.attributes,
        indices: geometry.indices,
        count: geometry.count,
        pipeline,
        uniforms: cachedUniforms,
        instances: geometry.instances,
      };
      if (camera.viewport) {
        cmd.viewport = camera.viewport;
        cmd.scissor = camera.viewport;
      }
      ctx.submit(cmd);
    }

    //TODO: draw skybox before first transparent
    if (skybox) {
      // TEMP
      skybox.draw(camera, {
        outputEncoding: sharedUniforms.uOutputEncoding,
        backgroundMode: true,
      });
    }
  }

  renderSystem.update = (entities) => {
    ctx.submit(clearCmd);

    const rendererableEntities = entities.filter(
      (e) => e.geometry && e.material
    );

    const cameraEntities = entities.filter((e) => e.camera);
    const skyboxEntities = entities.filter((e) => e.skybox);

    cameraEntities.forEach((camera) => {
      let entitiesToDraw = rendererableEntities;
      if (camera.layer) {
        entitiesToDraw = rendererableEntities.filter((e) => {
          return !e.layer || e.layer == camera.layer;
        });
      }
      drawMeshes(
        camera,
        false,
        null,
        entities,
        entitiesToDraw,
        skyboxEntities[0]?._skybox,
        true
      );
    });
  };

  return renderSystem;
}
