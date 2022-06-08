import { pipeline as SHADERS, chunks as SHADERS_CHUNKS } from "pex-shaderlib";
import { es300Fragment, es300Vertex, getFileExtension } from "../utils.js";
import { mat3, mat4 } from "pex-math";

export default function createRenderSystem(opts) {
  const ctx = opts.ctx;

  let clearCmd = {
    pass: ctx.pass({
      clearColor: [0, 0.75, 0.5, 1],
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

  function getMaterialProgramAndFlags(
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
        material.emissiveColor !== null && "USE_EMISSIVE_COLOR",
        material.clearCoat !== null && "USE_CLEAR_COAT",
        material.sheenColor !== null && "USE_SHEEN",
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
    if (!program) {
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
        depthFunc: material.depthFunc,
        // blend: material.blend,
        // blendSrcRGBFactor: material.blendSrcRGBFactor,
        // blendSrcAlphaFactor: material.blendSrcAlphaFactor,
        // blendDstRGBFactor: material.blendDstRGBFactor,
        // blendDstAlphaFactor: material.blendDstAlphaFactor,
        cullFace: material.cullFace,
        cullFaceMode: material.cullFaceMode,
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

    const sharedUniforms = {};
    const ambientLights = entities.filter((e) => e.ambientLight);
    const directionalLights = entities.filter((e) => e.directionalLight);
    console.log(
      "directionalLights",
      directionalLights.length,
      directionalLights
    );
    const pointLights = entities.filter((e) => e.pointLight);
    const spotLights = entities.filter((e) => e.spotLight);
    const areaLights = entities.filter((e) => e.areaLight);
    const reflectionProbes = entities.filter((e) => e.reflectionProbe);
    // const areaLights = entities.filter((e) => e.areaLight);

    // sharedUniforms.uCameraPosition = camera.entity.transform.worldPosition;
    sharedUniforms.uProjectionMatrix = camera.projectionMatrix;
    sharedUniforms.uViewMatrix = camera.viewMatrix;
    sharedUniforms.uInverseViewMatrix = camera.inverseViewMatrix; //TODO

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

      const pipeline = getGeometryPipeline(ctx, renderableEntity, {
        numAmbientLights: ambientLights.length,
        numDirectionalLights: directionalLights.length,
        numPointLights: pointLights.length,
        numSpotLights: spotLights.length,
        numAreaLights: areaLights.length,
        useReflectionProbes: reflectionProbes.length, // TODO: reflection probes true
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

      ctx.submit({
        name: "drawGeometry",
        attributes: geometry.attributes,
        indices: geometry.indices,
        count: geometry.count,
        pipeline,
        uniforms: cachedUniforms,
        instances: geometry.instances,
      });
    }
  }

  renderSystem.update = (entities) => {
    ctx.submit(clearCmd);

    const rendererableEntities = entities.filter(
      (e) => e.geometry && e.material
    );

    const cameraEntities = entities.filter((e) => e.camera);

    drawMeshes(
      cameraEntities[0],
      false,
      null,
      entities,
      rendererableEntities,
      null,
      true
    );
  };

  return renderSystem;
}
