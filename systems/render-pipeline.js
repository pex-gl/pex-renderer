import { vec3, vec4, mat3, mat4 } from "pex-math";
import { aabb } from "pex-geom";
import createPassDescriptors from "./renderer/passes.js";
import directionalLight from "../components/directional-light.js";

export default function createRenderPipelineSystem(opts) {
  const { ctx, resourceCache, renderGraph } = opts;

  ctx.gl.getExtension("WEBGL_color_buffer_float");
  ctx.gl.getExtension("WEBGL_color_buffer_half_float");
  ctx.gl.getExtension("EXT_color_buffer_half_float");
  ctx.gl.getExtension("EXT_color_buffer_half_float");
  ctx.gl.getExtension("EXT_shader_texture_lod");
  ctx.gl.getExtension("OES_standard_derivatives");
  ctx.gl.getExtension("WEBGL_draw_buffers");
  ctx.gl.getExtension("OES_texture_float");
  ctx.gl.getExtension("EXT_float_blend");

  const dummyTexture2D = ctx.texture2D({ width: 4, height: 4 });
  const dummyTextureCube = ctx.textureCube({ width: 4, height: 4 });
  const tempMat4 = mat4.create(); //FIXME
  const passes = createPassDescriptors(ctx);

  let clearCmd = {
    pass: ctx.pass({
      clearColor: [0, 0, 0, 0],
      clearDepth: 1,
    }),
  };

  const renderPipelineSystem = {
    cache: {},
    debug: true,
    shadowQuality: 1, //TODO: not implemented  shadowQuality
    outputEncoding: opts.outputEncoding || ctx.Encoding.Linear,
    renderers: [],
  };

  function drawMeshes({
    cameraEntity,
    shadowMapping,
    shadowMappingLight,
    entities,
    renderableEntities,
    skybox,
    forward,
    renderers,
  }) {
    const renderView = {};
    if (cameraEntity) {
      renderView.cameraEntity = cameraEntity;
      renderView.camera = cameraEntity.camera;
    }
    if (shadowMappingLight) {
      renderView.camera = {
        projectionMatrix: shadowMappingLight._projectionMatrix,
        viewMatrix: shadowMappingLight._viewMatrix,
      };
    }
    renderers.forEach((renderer) => {
      if (!shadowMapping) {
        if (renderer.renderStages.opaque) {
          renderer.renderStages.opaque(renderView, entities);
        }
      }
    });

    renderers.forEach((renderer) => {
      if (!shadowMapping) {
        if (renderer.renderStages.background) {
          renderer.renderStages.background(renderView, entities);
        }
      }
    });

    //TODO: capture color buffer and blur it for refraction

    renderers.forEach((renderer) => {
      if (!shadowMapping) {
        if (renderer.renderStages.transparent) {
          renderer.renderStages.transparent(renderView, entities);
        }
      }
    });
  }

  // TODO remove, should be in AABB
  function aabbToPoints(bbox) {
    if (aabb.isEmpty(bbox)) return [];
    return [
      [bbox[0][0], bbox[0][1], bbox[0][2], 1],
      [bbox[1][0], bbox[0][1], bbox[0][2], 1],
      [bbox[1][0], bbox[0][1], bbox[1][2], 1],
      [bbox[0][0], bbox[0][1], bbox[1][2], 1],
      [bbox[0][0], bbox[1][1], bbox[0][2], 1],
      [bbox[1][0], bbox[1][1], bbox[0][2], 1],
      [bbox[1][0], bbox[1][1], bbox[1][2], 1],
      [bbox[0][0], bbox[1][1], bbox[1][2], 1],
    ];
  }

  renderPipelineSystem.updateDirectionalLightShadowMap = function (
    lightEnt,
    entities,
    shadowCastingEntities,
    renderers
  ) {
    const light = lightEnt.directionalLight;
    // const position = lightEnt._transform.worldPosition;
    // const target = [0, 0, 1, 0];
    // const up = [0, 1, 0, 0];
    // vec4.multMat4(target, lightEnt._transform.modelMatrix);
    // vec3.add(target, position);
    // vec4.multMat4(up, lightEnt._transform.modelMatrix);
    // mat4.lookAt(light._viewMatrix, position, target, up);

    const shadowBboxPoints = shadowCastingEntities.reduce(
      (points, entity) =>
        points.concat(aabbToPoints(entity.transform.worldBounds)),
      []
    );

    // TODO: gc vec3.copy, all the bounding box creation
    const bboxPointsInLightSpace = shadowBboxPoints.map((p) =>
      vec3.multMat4(vec3.copy(p), light._viewMatrix)
    );
    const sceneBboxInLightSpace = aabb.create();
    aabb.fromPoints(sceneBboxInLightSpace, bboxPointsInLightSpace);

    // console.log("sceneBboxInLightSpace", ...sceneBboxInLightSpace);

    const lightNear = -sceneBboxInLightSpace[1][2];
    const lightFar = -sceneBboxInLightSpace[0][2];

    light._near = lightNear;
    light._far = lightFar;

    mat4.ortho(
      light._projectionMatrix,
      sceneBboxInLightSpace[0][0],
      sceneBboxInLightSpace[1][0],
      sceneBboxInLightSpace[0][1],
      sceneBboxInLightSpace[1][1],
      lightNear,
      lightFar
    );

    light.sceneBboxInLightSpace = sceneBboxInLightSpace;

    //TODO: can this be all done at once?
    let colorMap = resourceCache.texture2D(
      passes.directionalLightShadows.colorMapDesc
    );
    colorMap.name = "TempColorMap\n" + colorMap.id;

    let shadowMap = resourceCache.texture2D(
      passes.directionalLightShadows.shadowMapDesc
    );
    shadowMap.name = "ShadowMap\n" + shadowMap.id;

    //TODO: need to create new descriptor to get uniq
    let passDesc = { ...passes.directionalLightShadows.pass };
    passDesc.color[0] = colorMap;
    passDesc.depth = shadowMap;

    let shadowMapPass = resourceCache.pass(passDesc);

    if (false)
      //TEMP
      renderGraph.renderPass({
        name: "RenderShadowMap",
        pass: shadowMapPass,
        render: () => {
          drawMeshes({
            shadowMapping: true,
            shadowMappingLight: light,
            entities,
            renderableEntities: shadowCastingEntities,
            forward: false,
            renderers,
          });
        },
      });

    light._shadowMap = shadowMap; // TODO: we borrow it for a frame
    // ctx.submit(shadowMapDrawCommand, () => {
    // drawMeshes(null, true, light, entities, shadowCastingEntities);
    // });
  };

  renderPipelineSystem.patchDirectionalLight = (directionalLight) => {
    directionalLight._viewMatrix = mat4.create();
    directionalLight._projectionMatrix = mat4.create();

    //TODO: who will release those?
    // directionalLight._colorMap = ctx.texture2D({
    //   name: "directionalLightColorMap",
    //   width: 2048,
    //   height: 2048,
    //   pixelFormat: ctx.PixelFormat.RGBA8,
    //   encoding: ctx.Encoding.Linear,
    //   min: ctx.Filter.Linear,
    //   mag: ctx.Filter.Linear,
    // });

    // directionalLight._shadowMap =
    //   directionalLight._shadowMap ||
    //   ctx.texture2D({
    //     name: "directionalLightShadowMap",
    //     width: 2048,
    //     height: 2048,
    //     pixelFormat: ctx.PixelFormat.Depth,
    //     encoding: ctx.Encoding.Linear,
    //     min: ctx.Filter.Nearest,
    //     mag: ctx.Filter.Nearest,
    //   });

    // directionalLight._shadowMapDrawCommand = {
    //   name: "DirectionalLight.shadowMap",
    //   pass: ctx.pass({
    //     name: "DirectionalLight.shadowMap",
    //     color: [directionalLight._colorMap],
    //     depth: directionalLight._shadowMap,
    //     clearColor: [0, 0, 0, 1],
    //     clearDepth: 1,
    //   }),
    //   viewport: [0, 0, 2048, 2048], // TODO: viewport bug
    //   scissor: [0, 0, 2048, 2048], //TODO: disable that and try with new render pass system
    //   // colorMask: [0, 0, 0, 0] // TODO
    // };
  };

  renderPipelineSystem.update = (entities, options = {}) => {
    let { renderView, renderers } = options;
    // ctx.submit(clearCmd);

    const rendererableEntities = entities.filter(
      (e) => e.geometry && e.material
    );

    const cameraEntities = entities.filter((e) => e.camera);
    const skyboxEntities = entities.filter((e) => e.skybox);
    const directionalLightEntities = entities.filter((e) => e.directionalLight);
    const shadowCastingEntities = rendererableEntities.filter(
      (e) => e.material.castShadows
    );

    if (!renderView) {
      renderView = {
        camera: cameraEntities[0].camera,
        viewport: [0, 0, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
      };
    }

    directionalLightEntities.forEach((lightEntity) => {
      if (!lightEntity.directionalLight._viewMatrix) {
        renderPipelineSystem.patchDirectionalLight(
          lightEntity.directionalLight
        );
      }
      if (
        lightEntity.directionalLight.castShadows &&
        options.shadowPass !== false
      ) {
        renderPipelineSystem.updateDirectionalLightShadowMap(
          lightEntity,
          entities,
          shadowCastingEntities,
          renderers
        );
      }
    });

    const shadowMaps = directionalLightEntities.map((e) => {
      return e.directionalLight._shadowMap;
    });
    // cameraEntities.forEach((camera) => {
    let entitiesToDraw = rendererableEntities;
    if (renderView.camera.layer) {
      entitiesToDraw = rendererableEntities.filter((e) => {
        return !e.layer || e.layer == renderView.camera.layer;
      });
    }

    //TODO: this should be done on the fly by render graph
    passes.mainPass.outputTextureDesc.width = renderView.viewport[2];
    passes.mainPass.outputTextureDesc.height = renderView.viewport[3];
    const mainPassOutputTexture = resourceCache.texture2D(
      passes.mainPass.outputTextureDesc
    );
    mainPassOutputTexture.name = `mainPassOutput\n${mainPassOutputTexture.id}`;

    passes.mainPass.outputDepthTextureDesc.width = renderView.viewport[2];
    passes.mainPass.outputDepthTextureDesc.height = renderView.viewport[3];
    const outputDepthTexture = resourceCache.texture2D(
      passes.mainPass.outputDepthTextureDesc
    );
    outputDepthTexture.name = `mainPassDepth\n${outputDepthTexture.id}`;

    const mainPass = resourceCache.pass({
      color: [mainPassOutputTexture],
      depth: outputDepthTexture,
      clearColor: [0, 0, 0, 1],
      clearDepth: 1,
    });
    renderGraph.renderPass({
      name: `MainPass ${renderView.viewport}`,
      uses: [...shadowMaps],
      renderView: {
        ...renderView,
        viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
      },
      pass: mainPass,
      render: () => {
        drawMeshes({
          cameraEntity: renderView.cameraEntity,
          shadowMapping: false,
          entities: entities,
          renderableEntities: entitiesToDraw,
          skybox: skyboxEntities[0]?._skybox,
          forward: true,
          renderers: renderers,
        });
      },
    });

    const postProcessingPipeline = resourceCache.pipeline(
      passes.tonemap.pipelineDesc
    );
    const fullscreenTriangle = resourceCache.fullscreenTriangle();

    const postProcessingCmd = {
      attributes: fullscreenTriangle.attributes,
      count: fullscreenTriangle.count,
      pipeline: postProcessingPipeline,
      uniforms: {
        uViewport: renderView.viewport,
        uTexture: mainPassOutputTexture,
      },
    };
    renderGraph.renderPass({
      name: "PostProcessingPass",
      // pass: ctx.pass({ color: [{ id: -1 }] }),
      uses: [mainPassOutputTexture],
      renderView,
      render: () => {
        ctx.submit(postProcessingCmd);
      },
    });
    // });
  };

  return renderPipelineSystem;
}
