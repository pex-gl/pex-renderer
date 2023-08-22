import { vec3, mat4, utils } from "pex-math";
import { aabb } from "pex-geom";
import createDescriptors from "./renderer/descriptors.js";
import { NAMESPACE } from "../utils.js";

function drawMeshes({
  viewport,
  cameraEntity,
  shadowMapping,
  shadowMappingLight,
  entitiesInView,
  // forward, // TODO: is not used. remove?
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
  const renderView = renderViewUpstream || { viewport };

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
    for (let i = 0; i < renderers.length; i++) {
      const renderer = renderers[i];
      if (renderer.renderStages.shadow) {
        renderer.renderStages.shadow(renderView, entitiesInView, {
          shadowMapping: true,
          shadowMappingLight,
        });
      }
    }
  } else {
    if (!drawTransparent) {
      for (let i = 0; i < renderers.length; i++) {
        const renderer = renderers[i];
        if (renderer.renderStages.opaque) {
          renderer.renderStages.opaque(renderView, entitiesInView, {
            shadowQuality,
          });
        }
      }
      for (let i = 0; i < renderers.length; i++) {
        const renderer = renderers[i];
        if (renderer.renderStages.background) {
          renderer.renderStages.background(renderView, entitiesInView, {
            shadowQuality,
          });
        }
      }
    } else {
      //TODO: capture color buffer and blur it for transmission/refraction
      for (let i = 0; i < renderers.length; i++) {
        const renderer = renderers[i];
        if (renderer.renderStages.transparent) {
          renderer.renderStages.transparent(renderView, entitiesInView, {
            backgroundColorTexture,
            shadowQuality,
          });
        }
      }
    }
  }
}

export default ({
  ctx,
  resourceCache,
  renderGraph,
  shadowQuality = 2,
  outputEncoding,
}) => ({
  type: "render-pipeline-system",
  cache: {},
  debug: true,
  shadowQuality,
  outputEncoding: outputEncoding || ctx.Encoding.Linear,
  renderers: [],
  descriptors: createDescriptors(ctx),
  drawMeshes,
  updateDirectionalLightShadowMap(
    lightEntity,
    entities,
    shadowCastingEntities,
    renderers
  ) {
    const light = lightEntity.directionalLight;
    light._sceneBboxInLightSpace ??= aabb.create();

    aabb.empty(light._sceneBboxInLightSpace);
    aabb.fromPoints(
      light._sceneBboxInLightSpace,
      shadowCastingEntities.flatMap((entity) =>
        aabb
          .getCorners(entity.transform.worldBounds) // TODO: gc corners points
          .map((p) => vec3.multMat4(p, light._viewMatrix))
      )
    );

    light._near = -light._sceneBboxInLightSpace[1][2];
    light._far = -light._sceneBboxInLightSpace[0][2];

    mat4.ortho(
      light._projectionMatrix,
      light._sceneBboxInLightSpace[0][0],
      light._sceneBboxInLightSpace[1][0],
      light._sceneBboxInLightSpace[0][1],
      light._sceneBboxInLightSpace[1][1],
      light._near,
      light._far
    );

    let colorMapDesc = this.descriptors.directionalLightShadows.colorMapDesc;
    let shadowMapDesc = this.descriptors.directionalLightShadows.shadowMapDesc;

    // Only update descriptors for custom map size
    // TODO: could texture be cached if they have the same descriptor
    if (light.shadowMapSize) {
      colorMapDesc = {
        ...colorMapDesc,
        width: light.shadowMapSize,
        height: light.shadowMapSize,
      };
      shadowMapDesc = {
        ...shadowMapDesc,
        width: light.shadowMapSize,
        height: light.shadowMapSize,
      };
    }
    //TODO: can this be all done at once?
    const colorMap = resourceCache.texture2D(colorMapDesc);
    colorMap.name = "TempColorMap\n" + colorMap.id;

    const shadowMap = resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = "ShadowMap\n" + shadowMap.id;

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, shadowMap.width, shadowMap.height],
    };

    renderGraph.renderPass({
      name: "RenderShadowMap" + lightEntity.id,
      pass: resourceCache.pass({
        // TODO: creating new descriptor to force new pass from cache
        ...this.descriptors.directionalLightShadows.pass,
        color: [colorMap],
        depth: shadowMap,
      }),
      renderView: renderView,
      render: () => {
        // Needs to be here for multi-view with different renderer to not overwrite it
        light._shadowMap = shadowMap;

        drawMeshes({
          viewport: renderView.viewport,
          //TODO: passing camera entity around is a mess
          cameraEntity: {
            camera: {
              position: lightEntity._transform.worldPosition,
            },
          },
          shadowMapping: true,
          shadowMappingLight: light,
          entitiesInView: entities,
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
  },

  updateSpotLightShadowMap(
    lightEntity,
    entities,
    shadowCastingEntities,
    renderers
  ) {
    const light = lightEntity.spotLight;
    light._sceneBboxInLightSpace ??= aabb.create();

    aabb.empty(light._sceneBboxInLightSpace);
    aabb.fromPoints(
      light._sceneBboxInLightSpace,
      shadowCastingEntities.flatMap((entity) =>
        aabb
          .getCorners(entity.transform.worldBounds) // TODO: gc corners points
          .map((p) => vec3.multMat4(p, light._viewMatrix))
      )
    );

    light._near = -light._sceneBboxInLightSpace[1][2];
    light._far = -light._sceneBboxInLightSpace[0][2];

    let colorMapDesc = this.descriptors.spotLightShadows.colorMapDesc;
    let shadowMapDesc = this.descriptors.spotLightShadows.shadowMapDesc;

    // Only update descriptors for custom map size
    // TODO: could texture be cached if they have the same descriptor
    if (light.shadowMapSize) {
      colorMapDesc = {
        ...colorMapDesc,
        width: light.shadowMapSize,
        height: light.shadowMapSize,
      };
      shadowMapDesc = {
        ...shadowMapDesc,
        width: light.shadowMapSize,
        height: light.shadowMapSize,
      };
    }

    //TODO: can this be all done at once?
    const colorMap = resourceCache.texture2D(colorMapDesc);
    colorMap.name = "TempColorMap\n" + colorMap.id;

    const shadowMap = resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = "ShadowMap\n" + shadowMap.id;

    mat4.perspective(
      light._projectionMatrix,
      2 * light.angle,
      shadowMap.width / shadowMap.height,
      light._near,
      light._far
    );

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, shadowMap.width, shadowMap.height],
    };

    renderGraph.renderPass({
      name: "RenderShadowMap" + lightEntity.id,
      pass: resourceCache.pass({
        // TODO: creating new descriptor to force new pass from cache
        ...this.descriptors.spotLightShadows.pass,
        color: [colorMap],
        depth: shadowMap,
      }),
      renderView: renderView,
      render: () => {
        light._shadowMap = shadowMap;
        drawMeshes({
          viewport: renderView.viewport,
          //TODO: passing camera entity around is a mess
          cameraEntity: {
            camera: {
              position: lightEntity._transform.worldPosition,
            },
          },
          shadowMapping: true,
          shadowMappingLight: light,
          entitiesInView: entities,
          renderableEntities: shadowCastingEntities,
          forward: false,
          drawTransparent: false,
          renderers,
        });
      },
    });

    light._shadowMap = shadowMap; // TODO: we borrow it for a frame
  },

  updatePointLightShadowMap(
    lightEntity,
    entities,
    shadowCastingEntities,
    renderers
  ) {
    const light = lightEntity.pointLight;

    let shadowCubemapDesc =
      this.descriptors.pointLightShadows.shadowCubemapDesc;
    let shadowMapDesc = this.descriptors.pointLightShadows.shadowMapDesc;

    // Only update descriptors for custom map size
    // TODO: could texture be cached if they have the same descriptor
    if (light.shadowMapSize) {
      shadowCubemapDesc = {
        ...shadowCubemapDesc,
        width: light.shadowMapSize,
        height: light.shadowMapSize,
      };
      shadowMapDesc = {
        ...shadowMapDesc,
        width: light.shadowMapSize,
        height: light.shadowMapSize,
      };
    }

    //TODO: can this be all done at once?
    const shadowCubemap = resourceCache.textureCube(shadowCubemapDesc);
    shadowCubemap.name = "TempCubemap\n" + shadowCubemap.id;

    const shadowMap = resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = "ShadowMap\n" + shadowMap.id;

    for (let i = 0; i < this.descriptors.pointLightShadows.passes.length; i++) {
      const pass = this.descriptors.pointLightShadows.passes[i];
      //TODO: need to create new descriptor to get uniq
      const passDesc = { ...pass };
      passDesc.color = [
        { texture: shadowCubemap, target: passDesc.color[0].target },
      ];
      passDesc.depth = shadowMap;

      const side = this.descriptors.pointLightShadows.cubemapSides[i];
      const renderView = {
        camera: {
          projectionMatrix: side.projectionMatrix,
          viewMatrix: mat4.lookAt(
            mat4.create(), // This can't be GC as assigned in light._viewMatrix for multi-view
            vec3.add([...side.eye], lightEntity._transform.worldPosition),
            vec3.add([...side.target], lightEntity._transform.worldPosition),
            side.up
          ),
        },
        viewport: [0, 0, shadowMap.width, shadowMap.height],
      };

      renderGraph.renderPass({
        name: "RenderShadowMap" + lightEntity.id,
        pass: resourceCache.pass(passDesc),
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
            entitiesInView: entities,
            renderableEntities: shadowCastingEntities,
            forward: false,
            drawTransparent: false,
            renderers,
          });
        },
      });
    }

    light._shadowCubemap = shadowCubemap; // TODO: we borrow it for a frame
    // ctx.submit(shadowMapDrawCommand, () => {
    // drawMeshes(null, true, light, entities, shadowCastingEntities);
    // });
  },

  checkLight(light, lightEntity) {
    if (!lightEntity._transform) {
      console.warn(
        NAMESPACE,
        `"${this.type}" light entity missing transform. Add a transformSystem.update(entities).`
      );
    } else if (!light._projectionMatrix) {
      console.warn(
        NAMESPACE,
        `"${this.type}" light component missing matrices. Add a lightSystem.update(entities).`
      );
    } else {
      return true;
    }
  },

  update(entities, options = {}) {
    let { renderView, renderers, drawToScreen } = options;

    const rendererableEntities = entities.filter(
      (e) => e.geometry && e.material
    );
    const shadowCastingEntities = rendererableEntities.filter(
      (e) => e.material.castShadows
    );
    const cameraEntities = entities.filter((e) => e.camera);
    const directionalLightEntities = entities.filter((e) => e.directionalLight);
    const pointLightEntities = entities.filter((e) => e.pointLight);
    const spotLightEntities = entities.filter((e) => e.spotLight);

    renderView ||= {
      camera: cameraEntities[0].camera,
      viewport: [0, 0, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
    };

    // Update shadow maps
    for (let i = 0; i < directionalLightEntities.length; i++) {
      const entity = directionalLightEntities[i];

      // options.shadowPass !== false // FIXME: why this was here?
      if (
        entity.directionalLight.castShadows &&
        this.checkLight(entity.directionalLight, entity)
      ) {
        this.updateDirectionalLightShadowMap(
          entity,
          entities,
          shadowCastingEntities,
          renderers
        );
      }
    }

    for (let i = 0; i < pointLightEntities.length; i++) {
      const entity = pointLightEntities[i];

      if (
        entity.pointLight.castShadows &&
        this.checkLight(entity.pointLight, entity)
      ) {
        this.updatePointLightShadowMap(
          entity,
          entities,
          shadowCastingEntities,
          renderers
        );
      }
    }

    for (let i = 0; i < spotLightEntities.length; i++) {
      const entity = spotLightEntities[i];

      if (
        entity.spotLight.castShadows &&
        this.checkLight(entity.spotLight, entity)
      ) {
        this.updateSpotLightShadowMap(
          entity,
          entities,
          shadowCastingEntities,
          renderers
        );
      }
    }

    // TODO: this also get entities with shadowmap regardless of castShadows changes
    const shadowMaps = entities
      .map(
        (e) =>
          e.directionalLight?._shadowMap ||
          e.spotLight?._shadowMap ||
          e.pointLight?._shadowCubemap
      )
      .filter((_) => _);

    // Filter entities by layer
    const layer = renderView.camera.layer;
    const entitiesInView = layer
      ? entities.filter((e) => !e.layer || e.layer === layer)
      : entities;
    const entitiesToDraw = layer
      ? rendererableEntities.filter((e) => !e.layer || e.layer === layer)
      : rendererableEntities;

    // Main pass
    //TODO: this should be done on the fly by render graph
    this.descriptors.mainPass.outputTextureDesc.width = renderView.viewport[2];
    this.descriptors.mainPass.outputTextureDesc.height = renderView.viewport[3];
    const mainPassOutputTexture = resourceCache.texture2D(
      this.descriptors.mainPass.outputTextureDesc
    );
    mainPassOutputTexture.name = `mainPassOutput\n${mainPassOutputTexture.id}`;

    const mainPassNormalOutputTexture = resourceCache.texture2D(
      this.descriptors.mainPass.outputTextureDesc
    );
    mainPassNormalOutputTexture.name = `mainPassNormalOutput\n${mainPassNormalOutputTexture.id}`;

    this.descriptors.mainPass.outputDepthTextureDesc.width =
      renderView.viewport[2];
    this.descriptors.mainPass.outputDepthTextureDesc.height =
      renderView.viewport[3];
    const outputDepthTexture = resourceCache.texture2D(
      this.descriptors.mainPass.outputDepthTextureDesc
    );
    outputDepthTexture.name = `mainPassDepth\n${outputDepthTexture.id}`;

    renderGraph.renderPass({
      name: `MainPass ${renderView.viewport}`,
      uses: [...shadowMaps],
      renderView: {
        ...renderView,
        viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
      },
      pass: resourceCache.pass({
        color: [mainPassOutputTexture, mainPassNormalOutputTexture],
        depth: outputDepthTexture,
        clearColor: renderView.camera.clearColor,
        clearDepth: 1,
      }),
      render: () => {
        drawMeshes({
          viewport: renderView.viewport,
          cameraEntity: renderView.cameraEntity,
          shadowMapping: false,
          entitiesInView: entitiesInView,
          renderableEntities: entitiesToDraw,
          forward: true,
          drawTransparent: false,
          renderers: renderers,
          shadowQuality: this.shadowQuality,
        });
      },
    });

    // Grab pass
    let grabPassColorCopyTexture;
    if (entitiesInView.some((e) => e.material?.transmission)) {
      const viewport = [
        0,
        0,
        utils.prevPowerOfTwo(renderView.viewport[2]),
        utils.prevPowerOfTwo(renderView.viewport[3]),
      ];
      // const viewport = [0, 0, renderView.viewport[2], renderView.viewport[3]];
      this.descriptors.grabPass.colorCopyTextureDesc.width = viewport[2];
      this.descriptors.grabPass.colorCopyTextureDesc.height = viewport[3];
      grabPassColorCopyTexture = resourceCache.texture2D(
        this.descriptors.grabPass.colorCopyTextureDesc
      );
      grabPassColorCopyTexture.name = `grabPassOutput\n${grabPassColorCopyTexture.id}`;

      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const copyTextureCmd = {
        name: "Copy Texture",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(
          this.descriptors.grabPass.copyTexturePipelineDesc
        ),
        uniforms: {
          uViewport: viewport,
          uTexture: mainPassOutputTexture,
        },
      };

      renderGraph.renderPass({
        name: `GrabPass ${viewport}`,
        uses: [mainPassOutputTexture],
        renderView: { ...renderView, viewport },
        pass: resourceCache.pass({ color: [grabPassColorCopyTexture] }),
        render: () => {
          ctx.submit(copyTextureCmd);
        },
      });
    }

    // Transparent pass
    renderGraph.renderPass({
      name: `TransparentMainPass ${renderView.viewport}`,
      uses: [...shadowMaps, grabPassColorCopyTexture].filter((_) => _), //filter out nulls
      renderView: {
        ...renderView,
        viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
      },
      pass: resourceCache.pass({
        color: [mainPassOutputTexture],
        depth: outputDepthTexture,
      }),
      render: () => {
        drawMeshes({
          viewport: renderView.viewport,
          cameraEntity: renderView.cameraEntity,
          shadowMapping: false,
          entitiesInView: entitiesInView,
          renderableEntities: entitiesToDraw,
          forward: true,
          drawTransparent: true,
          backgroundColorTexture: grabPassColorCopyTexture,
          renderers: renderers,
          shadowQuality: this.shadowQuality, //FIXME: that's a lot of passing down
        });
      },
    });

    // Post-processing pass
    if (drawToScreen !== false) {
      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const postProcessingCmd = {
        name: "Draw FSTriangle",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(this.descriptors.tonemap.pipelineDesc),
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
  },
});
