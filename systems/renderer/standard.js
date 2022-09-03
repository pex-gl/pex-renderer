import { vec3, vec4, mat3, mat4 } from "pex-math";
import { pipeline as SHADERS, chunks as SHADERS_CHUNKS } from "pex-shaders";
import { patchVS, patchFS } from "../../utils.js";

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

export default function createStandardRendererSystem(opts) {
  const { ctx } = opts;

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
    [["material", "unlit"], "USE_UNLIT_WORKFLOW", { type: "boolean", fallback: "USE_METALLIC_ROUGHNESS_WORKFLOW" }],
    [["material", "blend"], "USE_BLEND", { type: "boolean" }],
    [["skin"], "USE_SKIN"],
    [["skin", "joints", "length"], "NUM_JOINTS", { type: "counter", requires: "USE_SKIN" }],
    [["skin", "jointMatrices"], "", { uniform: "uJointMat", requires: "USE_SKIN" }],
    [["material", "baseColor"], "", { uniform: "uBaseColor"}],
    [["material", "metallic"], "", { uniform: "uMetallic"}],
    [["material", "roughness"], "", { uniform: "uRoughness"}],
    [["material", "emissiveColor"], "USE_EMISSIVE_COLOR", { uniform: "uEmissiveColor"}],
    [["material", "emissiveIntensity"], "", { uniform: "uEmissiveIntensity", default: 1}],
    [["material", "baseColorMap"], "BASE_COLOR_MAP", { type: "texture", uniform: "uBaseColorMap"}],
    [["material", "emissiveColorMap"], "EMISSIVE_COLOR_MAP", { type: "texture", uniform: "uEmissiveColorMap"}],
    [["material", "normalMap"], "NORMAL_MAP", { type: "texture", uniform: "uNormalMap"}],
    [["material", "roughnessMap"], "ROUGHNESS_MAP", { type: "texture", uniform: "uRoughnessMap"}],
    [["material", "metallicMap"], "METALLIC_MAP", { type: "texture", uniform: "uMetallicMap"}],
    [["material", "metallicRoughnessMap"], "METALLIC_ROUGHNESS_MAP", { type: "texture", uniform: "uMetallicRoughnessMap"}],
    [["material", "alphaTest"], "USE_ALPHA_TEST"],
    [["material", "alphaMap"], "ALPHA_MAP", { type: "texture", uniform: "uAlphaMap"}],
    [["material", "clearCoat"], "USE_CLEAR_COAT", { uniform: "uClearCoat"}],
    [["material", "clearCoatRoughness"], "USE_CLEAR_COAT_ROUGHNESS", { uniform: "uClearCoatRoughness"}],
    [["material", "clearCoatMap"], "CLEAR_COAT_MAP", { type: "texture", uniform: "uClearCoatMap"}],
    [["material", "clearCoatNormalMap"], "CLEAR_COAT_NORMAL_MAP", { type: "texture", uniform: "uClearCoatNormalMap"}],
    [["material", "sheenColor"], "USE_SHEEN", { uniform: "uSheenColor"}],
    [["material", "sheenRoughness"], "", { uniform: "uSheenRoughness", requires: "USE_SHEEN"}],
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

  let frameCount = 0;

  function getMaterialProgramAndFlags(
    ctx,
    entity,
    options = {},
    // TODO: pass shadowQuality as option
    State
  ) {
    const { _geometry: geometry, material } = entity;

    let flags = [
      //[["ctx", "capabilities", "maxColorAttachments"], "USE_DRAW_BUFFERS"
      ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
      // (!geometry.attributes.aNormal || material.unlit) && "USE_UNLIT_WORKFLOW",
      // "USE_UNLIT_WORKFLOW",
      "SHADOW_QUALITY 2",
    ];
    let materialUniforms = {};

    for (let i = 0; i < flagDefs.length; i++) {
      const [path, defineName, opts = {}] = flagDefs[i];

      if (opts.requires && !flags.includes(opts.requires)) {
        continue;
      }

      //TODO: GC
      const obj = {
        ...entity,
        geometry,
        options,
      };
      let value = obj;

      for (let j = 0; j < path.length; j++) {
        value = value[path[j]];
      }

      if (opts.type == "counter") {
        flags.push(`${defineName} ${value}`);
      } else if (opts.type == "texture" && value) {
        flags.push(`USE_${defineName}`);
        flags.push(`${defineName}_TEX_COORD_INDEX 0`);
        materialUniforms[opts.uniform] = value.texture || value;
        if (value.texCoordTransformMatrix) {
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
    frag ||= SHADERS.material.frag;
    return {
      flags: flags
        .flat()
        .filter(Boolean)
        .map((flag) => `#define ${flag}`),
      vert,
      frag,
      materialUniforms,
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
        .replace(/NUM_AMBIENT_LIGHTS/g, options.ambientLights.length || 0)
        .replace(
          /NUM_DIRECTIONAL_LIGHTS/g,
          options.directionalLights.length || 0
        )
        .replace(/NUM_POINT_LIGHTS/g, options.pointLights.length || 0)
        .replace(/NUM_SPOT_LIGHTS/g, options.spotLights.length || 0)
        .replace(/NUM_AREA_LIGHTS/g, options.areaLights.length || 0);

      for (let i = Number.parseInt(start); i < Number.parseInt(end); i++) {
        unroll += snippet.replace(/\[i\]/g, `[${i}]`);
      }

      return unroll;
    });

    return string;
  }

  function getMaterialProgram(ctx, entity, options) {
    const { flags, vert, frag, materialUniforms } = getMaterialProgramAndFlags(
      ctx,
      entity,
      options
    );
    const extensions = getExtensions();
    const flagsStr = `${flags.join("\n")}\n`;
    entity._flags = flags;
    const vertSrc = flagsStr + vert;
    const fragSrc = extensions + flagsStr + frag;
    let program = programCacheMap.getValue(flags, vert, frag);
    try {
      if (!program) {
        console.log("render-system", "New program", flags, entity);
        program = buildProgram(
          parseShader(
            ctx.capabilities.isWebGL2 ? patchVS(vertSrc) : vertSrc,
            options
          ),
          parseShader(
            ctx.capabilities.isWebGL2 ? patchFS(fragSrc, 3) : fragSrc,
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
    return { program, materialUniforms };
  }

  function gatherLightInfo({ entities, sharedUniforms, shadowMapping }) {
    const ambientLights = shadowMapping
      ? []
      : entities.filter((e) => e.ambientLight);
    const directionalLights = shadowMapping
      ? []
      : entities.filter((e) => e.directionalLight);
    const pointLights = shadowMapping
      ? []
      : entities.filter((e) => e.pointLight);
    const spotLights = shadowMapping ? [] : entities.filter((e) => e.spotLight);
    const areaLights = shadowMapping ? [] : entities.filter((e) => e.areaLight);

    directionalLights.forEach((lightEntity, i) => {
      const light = lightEntity.directionalLight;
      // const dir4 = [0, 0, 0]; // TODO: GC
      // const dir = [0, 0, 0];
      const dir = [...lightEntity._transform.worldPosition];
      vec3.scale(dir, -1);
      vec3.normalize(dir);
      // vec4.multMat4(dir4, lightEntity._transform.modelMatrix);
      // vec3.set(dir, dir4);

      let useNodeNodeOrientationLikeOldPexRenderer = true;
      if (useNodeNodeOrientationLikeOldPexRenderer) {
        const position = lightEntity._transform.worldPosition;
        const target = [0, 0, 1, 0];
        const up = [0, 1, 0];
        vec4.multMat4(target, lightEntity._transform.modelMatrix);
        vec3.add(target, position);

        vec3.set(dir, target);
        vec3.sub(dir, position);
        vec3.normalize(dir);
        // vec4.multMat4(up, lightEntity._transform.modelMatrix);
        if (!light._viewMatrix) {
          light._viewMatrix = mat4.create();
        }
        mat4.lookAt(light._viewMatrix, position, target, up);
      } else {
        const position = lightEntity._transform.worldPosition;
        const target = [0, 0, 0];
        const up = [0, 1, 0, 0];
        vec4.multMat4(up, lightEntity._transform.modelMatrix);
        if (!light._viewMatrix) {
          light._viewMatrix = mat4.create();
        }
        mat4.lookAt(light._viewMatrix, position, target, up);
      }

      // prettier-ignore
      {
      sharedUniforms[`uDirectionalLights[${i}].direction`] = dir;
      sharedUniforms[`uDirectionalLights[${i}].color`] = light.color.map((c, j) => {
        if (j < 3)
          return Math.pow(
            c * light.intensity,
            1.0 / 2.2
          );
        else return c;
      });;
      sharedUniforms[`uDirectionalLights[${i}].castShadows`] = light.castShadows;
      sharedUniforms[`uDirectionalLights[${i}].projectionMatrix`] = light._projectionMatrix || tempMat4; //FIXME
      sharedUniforms[`uDirectionalLights[${i}].viewMatrix`] = light._viewMatrix || tempMat4; //FIXME;
      sharedUniforms[`uDirectionalLights[${i}].near`] = light._near || 0.1;
      sharedUniforms[`uDirectionalLights[${i}].far`] = light._far || 100;
      sharedUniforms[`uDirectionalLights[${i}].bias`] = light.bias || 0.1;
      sharedUniforms[`uDirectionalLights[${i}].shadowMapSize`] = light.castShadows ? [light._shadowMap.width, light._shadowMap.height] : [0, 0];
      sharedUniforms[`uDirectionalLightShadowMaps[${i}]`] = light.castShadows ? light._shadowMap : dummyTexture2D;
      }
    });

    ambientLights.forEach((lightEntity, i) => {
      // console.log(
      //   "lightEntity.ambientLight.color",
      //   lightEntity.ambientLight.color
      // );
      sharedUniforms[`uAmbientLights[${i}].color`] =
        lightEntity.ambientLight.color;
    });
  }

  function getGeometryPipeline(ctx, entity, opts) {
    const { material, _geometry: geometry } = entity;
    const { program, materialUniforms } = getMaterialProgram(ctx, entity, opts);
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

  function gatherReflectionProbeInfo({
    entities,
    sharedUniforms,
    shadowMapping,
  }) {
    const reflectionProbes = shadowMapping
      ? []
      : entities.filter((e) => e.reflectionProbe);
    if (reflectionProbes.length > 0) {
      // && reflectionProbes[0]._reflectionMap) {
      sharedUniforms.uReflectionMap =
        reflectionProbes[0]._reflectionProbe._reflectionMap;
      sharedUniforms.uReflectionMapEncoding =
        reflectionProbes[0]._reflectionProbe._reflectionMap.encoding;
    }
  }

  function render(renderView, entities, opts) {
    const { camera, cameraEntity } = renderView;
    const { shadowMapping, shadowMappingLight, transparent } = opts;

    const sharedUniforms = {
      //uOutputEncoding: renderPipelineSystem.outputEncoding,
      uOutputEncoding: ctx.Encoding.Linear,
    };

    gatherLightInfo({ entities, sharedUniforms, shadowMapping });
    gatherReflectionProbeInfo({
      entities,
      sharedUniforms,
      shadowMapping,
    });

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
      sharedUniforms.uCameraPosition =
        cameraEntity.camera.position || cameraEntity.transform.worldPosition; //TODO: ugly
    }

    const renderableEntities = entities.filter(
      (e) =>
        e.geometry &&
        e.material &&
        (!shadowMapping || e.material.castShadows) &&
        !e.drawSegments &&
        (transparent ? e.material.blend : !e.material.blend) //TODO: what is transparent?
    ); //hardcoded e.drawSegments

    const opaqueEntities = renderableEntities.filter((e) => !e.material.blend);
    renderableEntities.forEach((renderableEntity) => {
      const {
        _geometry: geometry,
        _transform: transform,
        material,
        skin,
      } = renderableEntity;
      const cachedUniforms = {};
      cachedUniforms.uModelMatrix = transform.modelMatrix; //FIXME: bypasses need for transformSystem access
      cachedUniforms.uNormalScale = 1;
      cachedUniforms.uAlphaTest = material.alphaTest || 1;
      cachedUniforms.uAlphaMap = material.alphaMap;
      cachedUniforms.uReflectance =
        material.reflectance !== undefined ? material.reflectance : 0.5;
      cachedUniforms.uExposure = 1.0;

      cachedUniforms.uPointSize = 1;
      cachedUniforms.uMetallicRoughnessMap = material.metallicRoughnessMap;
      renderableEntity._uniforms = cachedUniforms;

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
        }
      );

      Object.assign(cachedUniforms, sharedUniforms);
      Object.assign(cachedUniforms, materialUniforms);

      // FIXME: this is expensive and not cached
      let viewMatrix;
      if (shadowMappingLight) {
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
      ctx.submit(cmd);
    });
  }

  const standardRendererSystem = {
    renderStages: {
      shadow: (renderView, entitites, opts = {}) => {
        render(renderView, entitites, opts);
      },
      opaque: (renderView, entitites, opts = {}) => {
        render(renderView, entitites, opts);
      },
      transparent: (renderView, entitites, opts = {}) => {
        render(renderView, entitites, { ...opts, transparent: true });
      },
    },
    update: () => {},
  };
  return standardRendererSystem;
}