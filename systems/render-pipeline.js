import { vec3, vec4, mat3, mat4 } from "pex-math";
import { aabb } from "pex-geom";
import createPassDescriptors from "./renderer/passes.js";

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

  const tempMat4 = mat4.create(); //FIXME
  const passes = createPassDescriptors(ctx);

  let clearCmd = {
    pass: ctx.pass({
      clearColor: [0, 0, 0, 0],
      clearDepth: 1,
    }),
  };

  function nextPowerOfTwo(n) {
    if (n === 0) return 1;
    n--;
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    return n + 1;
  }

  function prevPowerOfTwo(n) {
    return nextPowerOfTwo(n) / 2;
  }

  const renderPipelineSystem = {
    cache: {},
    debug: true,
    shadowQuality: opts.shadowQuality !== undefined ? opts.shadowQuality : 2,
    outputEncoding: opts.outputEncoding || ctx.Encoding.Linear,
    renderers: [],
  };

  function drawMeshes({
    viewport,
    cameraEntity,
    shadowMapping,
    shadowMappingLight,
    entities,
    renderableEntities,
    skybox,
    forward,
    renderView: renderViewUpstream,
    renderers,
    drawTransparent,
    backgroundColorTexture,
    shadowQuality,
  }) {
    // if (backgroundColorTexture) {
    //   ctx.update(backgroundColorTexture, { mipmap: true });
    // }

    //FIXME: code smell
    const renderView = renderViewUpstream || {
      viewport: viewport,
    };

    //FIXME: code smell
    if (cameraEntity && !renderView.camera) {
      renderView.cameraEntity = cameraEntity;
      renderView.camera = cameraEntity.camera;
    }
    if (shadowMappingLight) {
      renderView.camera = {
        projectionMatrix: shadowMappingLight._projectionMatrix,
        viewMatrix: shadowMappingLight._viewMatrix,
      };
    }

    if (shadowMapping) {
      renderers.forEach((renderer) => {
        if (renderer.renderStages.shadow) {
          renderer.renderStages.shadow(renderView, entities, {
            shadowMapping: true,
            shadowMappingLight,
          });
        }
      });
    } else {
      if (!drawTransparent) {
        renderers.forEach((renderer) => {
          if (renderer.renderStages.opaque) {
            renderer.renderStages.opaque(renderView, entities, {
              shadowQuality,
            });
          }
        });
        renderers.forEach((renderer) => {
          if (renderer.renderStages.background) {
            renderer.renderStages.background(renderView, entities, {
              shadowQuality,
            });
          }
        });
      }

      if (drawTransparent) {
        //TODO: capture color buffer and blur it for transmission/refraction
        renderers.forEach((renderer) => {
          if (renderer.renderStages.transparent) {
            renderer.renderStages.transparent(renderView, entities, {
              backgroundColorTexture,
              shadowQuality,
            });
          }
        });
      }
    }
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

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, shadowMap.width, shadowMap.height],
    };

    renderGraph.renderPass({
      name: "RenderShadowMap" + lightEnt.id,
      pass: shadowMapPass,
      renderView: renderView,
      render: () => {
        light._shadowMap = shadowMap;
        drawMeshes({
          viewport: renderView.viewport,
          //TODO: passing camera entity around is a mess
          cameraEntity: {
            camera: {
              position: lightEnt._transform.worldPosition,
            },
          },
          shadowMapping: true,
          shadowMappingLight: light,
          entities,
          renderableEntities: shadowCastingEntities,
          forward: false,
          drawTransparent: false,
          renderers,
        });
      },
    });

    light._shadowMap = shadowMap; // TODO: we borrow it for a frame
    // ctx.submit(shadowMapDrawCommand, () => {
    // drawMeshes(null, true, light, entities, shadowCastingEntities);
    // });
  };

  renderPipelineSystem.updatePointLightShadowMap = function (
    lightEnt,
    entities,
    shadowCastingEntities,
    renderers
  ) {
    const light = lightEnt.pointLight;

    //TODO: can this be all done at once?
    let shadowCubemap = resourceCache.textureCube(
      passes.pointLightShadows.shadowCubemapDesc
    );
    shadowCubemap.name = "TempCubemap\n" + shadowCubemap.id;

    let shadowMap = resourceCache.texture2D(
      passes.pointLightShadows.shadowMapDesc
    );
    shadowMap.name = "ShadowMap\n" + shadowMap.id;

    passes.pointLightShadows.passes.forEach((pass, i) => {
      //TODO: need to create new descriptor to get uniq
      let passDesc = { ...pass };
      passDesc.color = [
        { texture: shadowCubemap, target: passDesc.color[0].target },
      ];
      passDesc.depth = shadowMap;

      let shadowMapPass = resourceCache.pass(passDesc);

      const side = passes.pointLightShadows.cubemapSides[i];
      const renderView = {
        camera: {
          projectionMatrix: side.projectionMatrix,
          viewMatrix: mat4.lookAt(
            mat4.create(),
            vec3.add([...side.eye], lightEnt._transform.worldPosition),
            vec3.add([...side.target], lightEnt._transform.worldPosition),
            side.up
          ),
        },
        viewport: [0, 0, shadowMap.width, shadowMap.height],
      };

      renderGraph.renderPass({
        name: "RenderShadowMap" + lightEnt.id,
        pass: shadowMapPass,
        renderView: renderView,
        render: () => {
          //why?
          light._shadowCubemap = shadowCubemap; // TODO: we borrow it for a frame
          light._projectionMatrix = side.projectionMatrix;
          light._viewMatrix = renderView.camera.viewMatrix;
          drawMeshes({
            viewport: renderView.viewport,
            renderView,
            //TODO: passing camera entity around is a mess
            // cameraEntity: {
            //   camera: {},
            // },
            shadowMapping: true,
            shadowMappingLight: light,
            entities,
            renderableEntities: shadowCastingEntities,
            forward: false,
            drawTransparent: false,
            renderers,
          });
        },
      });
    });

    light._shadowCubemap = shadowCubemap; // TODO: we borrow it for a frame
    // ctx.submit(shadowMapDrawCommand, () => {
    // drawMeshes(null, true, light, entities, shadowCastingEntities);
    // });
  };

  renderPipelineSystem.patchDirectionalLight = (directionalLight) => {
    directionalLight._viewMatrix = mat4.create();
    directionalLight._projectionMatrix = mat4.create();
  };

  renderPipelineSystem.update = (entities, options = {}) => {
    let { renderView, renderers, drawToScreen } = options;
    // ctx.submit(clearCmd);

    const rendererableEntities = entities.filter(
      (e) => e.geometry && e.material
    );

    const cameraEntities = entities.filter((e) => e.camera);
    const skyboxEntities = entities.filter((e) => e.skybox);
    const directionalLightEntities = entities.filter((e) => e.directionalLight);
    const pointLightEntities = entities.filter((e) => e.pointLight);
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
        lightEntity.directionalLight.castShadows
        // FIXME: why this was here?
        // options.shadowPass !== false
      ) {
        renderPipelineSystem.updateDirectionalLightShadowMap(
          lightEntity,
          entities,
          shadowCastingEntities,
          renderers
        );
      }
    });

    pointLightEntities.forEach((lightEntity) => {
      if (lightEntity.pointLight.castShadows) {
        renderPipelineSystem.updatePointLightShadowMap(
          lightEntity,
          entities,
          shadowCastingEntities,
          renderers
        );
      }
    });

    const shadowMaps = directionalLightEntities
      .map((e) => {
        return e.directionalLight._shadowMap;
      })
      .filter((_) => _);
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

    const mainPassNormalOutputTexture = resourceCache.texture2D(
      passes.mainPass.outputTextureDesc
    );
    mainPassNormalOutputTexture.name = `mainPassNormalOutput\n${mainPassNormalOutputTexture.id}`;

    passes.mainPass.outputDepthTextureDesc.width = renderView.viewport[2];
    passes.mainPass.outputDepthTextureDesc.height = renderView.viewport[3];
    const outputDepthTexture = resourceCache.texture2D(
      passes.mainPass.outputDepthTextureDesc
    );
    outputDepthTexture.name = `mainPassDepth\n${outputDepthTexture.id}`;

    const mainPass = resourceCache.pass({
      color: [mainPassOutputTexture, mainPassNormalOutputTexture],
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
          viewport: renderView.viewport,
          cameraEntity: renderView.cameraEntity,
          shadowMapping: false,
          entities: entities,
          renderableEntities: entitiesToDraw,
          skybox: skyboxEntities[0]?._skybox,
          forward: true,
          drawTransparent: false,
          renderers: renderers,
          shadowQuality: renderPipelineSystem.shadowQuality,
        });
      },
    });

    const needsGrabPass = !!entities.find((e) => e.material?.transmission);
    let grabPassColorCopyTexture;
    if (needsGrabPass) {
      passes.grabPass.colorCopyTextureDesc.width = prevPowerOfTwo(
        renderView.viewport[2]
      );
      passes.grabPass.colorCopyTextureDesc.height = prevPowerOfTwo(
        renderView.viewport[3]
      );
      grabPassColorCopyTexture = resourceCache.texture2D(
        passes.grabPass.colorCopyTextureDesc
      );
      grabPassColorCopyTexture.name = `grapbPassOutput\n${grabPassColorCopyTexture.id}`;

      const grabPass = resourceCache.pass({
        color: [grabPassColorCopyTexture],
      });

      const copyTexturePipeline = resourceCache.pipeline(
        passes.grabPass.copyTexturePipelineDesc
      );
      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const copyTextureCmd = {
        name: "Copy Texture",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: copyTexturePipeline,
        uniforms: {
          //uViewport: renderView.viewport,
          uViewport: [
            0,
            0,
            grabPassColorCopyTexture.width,
            grabPassColorCopyTexture.height,
          ],
          uTexture: mainPassOutputTexture,
        },
      };

      renderGraph.renderPass({
        name: `GrabPass ${renderView.viewport}`,
        uses: [mainPassOutputTexture],
        renderView: {
          ...renderView,
          //viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
          viewport: [
            0,
            0,
            grabPassColorCopyTexture.width,
            grabPassColorCopyTexture.height,
          ],
        },
        pass: grabPass,
        render: () => {
          ctx.submit(copyTextureCmd);
        },
      });
    }
    // console.log("needsGrabPass", needsGrabPass);

    const transparentPass = resourceCache.pass({
      color: [mainPassOutputTexture],
      depth: outputDepthTexture,
    });
    renderGraph.renderPass({
      name: `TransparentMainPass ${renderView.viewport}`,
      uses: [...shadowMaps, grabPassColorCopyTexture].filter((_) => _), //filter out nulls
      renderView: {
        ...renderView,
        viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
      },
      pass: transparentPass,
      render: () => {
        drawMeshes({
          viewport: renderView.viewport,
          cameraEntity: renderView.cameraEntity,
          shadowMapping: false,
          entities: entities,
          renderableEntities: entitiesToDraw,
          skybox: skyboxEntities[0]?._skybox,
          forward: true,
          drawTransparent: true,
          backgroundColorTexture: grabPassColorCopyTexture,
          renderers: renderers,
          shadowQuality: renderPipelineSystem.shadowQuality, //FIXME: that's a lot of passing down
        });
      },
    });

    if (drawToScreen !== false) {
      const postProcessingPipeline = resourceCache.pipeline(
        passes.tonemap.pipelineDesc
      );
      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const postProcessingCmd = {
        name: "Draw FSTriangle",
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
        uses: [],
        renderView,
        render: () => {
          ctx.submit(postProcessingCmd);
        },
      });
    }

    return {
      color: mainPassOutputTexture,
      normal: mainPassNormalOutputTexture,
      depth: outputDepthTexture,
    };
  };

  return renderPipelineSystem;
}
