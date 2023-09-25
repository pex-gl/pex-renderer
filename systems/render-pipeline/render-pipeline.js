import { vec3, utils, avec4 } from "pex-math";

import addDescriptors from "./descriptors.js";
import addPostProcessingPasses from "./post-processing.js";
import addShadowMapping from "./shadow-mapping.js";

import { NAMESPACE, TEMP_VEC3, TEMP_VEC4 } from "../../utils.js";

function isEntityInFrustum(entity, frustum) {
  if (entity.geometry.culled !== false) {
    const worldBounds = entity.transform.worldBounds;
    for (let i = 0; i < 6; i++) {
      avec4.set(TEMP_VEC4, 0, frustum, i);
      TEMP_VEC3[0] = TEMP_VEC4[0] >= 0 ? worldBounds[1][0] : worldBounds[0][0];
      TEMP_VEC3[1] = TEMP_VEC4[1] >= 0 ? worldBounds[1][1] : worldBounds[0][1];
      TEMP_VEC3[2] = TEMP_VEC4[2] >= 0 ? worldBounds[1][2] : worldBounds[0][2];

      // Distance from plane to point
      if (vec3.dot(TEMP_VEC4, TEMP_VEC3) + TEMP_VEC4[3] < 0) return false;
    }
  }

  return true;
}

const cullEntities = (entities, camera) =>
  entities.filter(
    (entity) =>
      !entity.geometry ||
      (entity.transform && isEntityInFrustum(entity, camera.frustum))
  );

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
          const entities = renderView.camera.culling
            ? cullEntities(entitiesInView, renderView.camera)
            : entitiesInView;
          renderer.renderStages.opaque(renderView, entities, {
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
          const entities = renderView.camera.culling
            ? cullEntities(entitiesInView, renderView.camera)
            : entitiesInView;
          renderer.renderStages.transparent(renderView, entities, {
            backgroundColorTexture,
            shadowQuality,
          });
        }
      }
    }
  }
}

/**
 * Render pipeline system
 *
 * Adds:
 * - "_near", "_far" and "_sceneBboxInLightSpace" to light components that cast shadows
 * - "_shadowCubemap" to pointLight components and "_shadowMap" to other light components
 * @returns {import("../../types.js").System}
 */
export default ({
  ctx,
  resourceCache,
  renderGraph,
  shadowQuality = 2,
  outputEncoding,
}) => ({
  type: "render-pipeline-system",
  cache: {},
  debug: false,
  shadowQuality,
  outputEncoding: outputEncoding || ctx.Encoding.Linear,
  renderers: [],
  descriptors: addDescriptors(ctx),
  postProcessingPasses: null,
  shadowMapping: null,
  drawMeshes,
  cullEntities,

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

    const shadowCastingEntities = entities.filter(
      (e) => e.geometry && e.material?.castShadows
    );
    const cameraEntities = entities.filter((e) => e.camera);
    const directionalLightEntities = entities.filter((e) => e.directionalLight);
    const pointLightEntities = entities.filter((e) => e.pointLight);
    const spotLightEntities = entities.filter((e) => e.spotLight);
    const areaLightEntities = entities.filter((e) => e.areaLight);

    renderView ||= {
      camera: cameraEntities[0].camera,
      viewport: [0, 0, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
    };

    // Update shadow maps
    this.shadowMapping ||= addShadowMapping({
      drawMeshes,
      renderGraph,
      resourceCache,
      descriptors: this.descriptors,
    });

    for (let i = 0; i < directionalLightEntities.length; i++) {
      const entity = directionalLightEntities[i];

      // options.shadowPass !== false // FIXME: why this was here?
      if (
        entity.directionalLight.castShadows &&
        this.checkLight(entity.directionalLight, entity)
      ) {
        this.shadowMapping.directionalLight(
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
        this.shadowMapping.pointLight(
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
        this.shadowMapping.spotLight(
          entity,
          entities,
          shadowCastingEntities,
          renderers
        );
      }
    }

    for (let i = 0; i < areaLightEntities.length; i++) {
      const entity = areaLightEntities[i];

      if (
        entity.areaLight.castShadows &&
        this.checkLight(entity.areaLight, entity)
      ) {
        this.shadowMapping.spotLight(
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
          e.areaLight?._shadowMap ||
          e.pointLight?._shadowCubemap
      )
      .filter(Boolean);

    // Filter entities by layer
    const layer = renderView.camera.layer;
    const entitiesInView = layer
      ? entities.filter((e) => !e.layer || e.layer === layer)
      : entities;

    const postProcessing = renderView.cameraEntity.postProcessing;

    // Main pass
    //TODO: this should be done on the fly by render graph
    this.descriptors.mainPass.outputTextureDesc.width = renderView.viewport[2];
    this.descriptors.mainPass.outputTextureDesc.height = renderView.viewport[3];
    let mainPassOutputTexture = resourceCache.texture2D(
      this.descriptors.mainPass.outputTextureDesc
    );
    mainPassOutputTexture.name = `mainPassOutput (id: ${mainPassOutputTexture.id})`;

    const mainPassNormalOutputTexture = resourceCache.texture2D(
      this.descriptors.mainPass.outputTextureDesc
    );
    mainPassNormalOutputTexture.name = `mainPassNormalOutput (id: ${mainPassNormalOutputTexture.id})`;

    let mainPassEmissiveOutputTexture;
    if (postProcessing) {
      mainPassEmissiveOutputTexture = resourceCache.texture2D(
        this.descriptors.mainPass.outputTextureDesc
      );
      mainPassEmissiveOutputTexture.name = `mainPassEmissiveOutput (id: ${mainPassEmissiveOutputTexture.id})`;
    }

    this.descriptors.mainPass.outputDepthTextureDesc.width =
      renderView.viewport[2];
    this.descriptors.mainPass.outputDepthTextureDesc.height =
      renderView.viewport[3];
    const outputDepthTexture = resourceCache.texture2D(
      this.descriptors.mainPass.outputDepthTextureDesc
    );
    outputDepthTexture.name = `mainPassDepth (id: ${outputDepthTexture.id})`;

    renderGraph.renderPass({
      name: `MainPass [${renderView.viewport}]`,
      uses: [...shadowMaps],
      renderView: {
        ...renderView,
        viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
      },
      pass: resourceCache.pass({
        name: "mainPass",
        color: [
          mainPassOutputTexture,
          mainPassNormalOutputTexture,
          postProcessing && mainPassEmissiveOutputTexture,
        ].filter(Boolean),
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
      grabPassColorCopyTexture.name = `grabPassOutput (id: ${grabPassColorCopyTexture.id})`;

      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const copyTextureCmd = {
        name: "grabPassCopyTextureCmd",
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
        name: `GrabPass [${viewport}]`,
        uses: [mainPassOutputTexture],
        renderView: { ...renderView, viewport },
        pass: resourceCache.pass({
          name: "grabPass",
          color: [grabPassColorCopyTexture],
        }),
        render: () => {
          ctx.submit(copyTextureCmd);
        },
      });
    }

    // Transparent pass
    renderGraph.renderPass({
      name: `TransparentPass [${renderView.viewport}]`,
      uses: [...shadowMaps, grabPassColorCopyTexture].filter(Boolean),
      renderView: {
        ...renderView,
        viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
      },
      pass: resourceCache.pass({
        name: "transparentPass",
        color: [mainPassOutputTexture],
        depth: outputDepthTexture,
      }),
      render: () => {
        drawMeshes({
          viewport: renderView.viewport,
          cameraEntity: renderView.cameraEntity,
          shadowMapping: false,
          entitiesInView: entitiesInView,
          forward: true,
          drawTransparent: true,
          backgroundColorTexture: grabPassColorCopyTexture,
          renderers: renderers,
          shadowQuality: this.shadowQuality, //FIXME: that's a lot of passing down
        });
      },
    });

    // Store attachments. Can be overwritten by PostProcessingPass
    const attachments = {
      color: mainPassOutputTexture,
      normal: mainPassNormalOutputTexture,
      emissive: mainPassEmissiveOutputTexture,
      depth: outputDepthTexture,
    };

    // Post-processing pass
    if (postProcessing) {
      this.postProcessingPasses ||= addPostProcessingPasses({
        ctx,
        resourceCache,
        descriptors: this.descriptors,
        cache: this.cache,
      });

      renderGraph.renderPass({
        name: `PostProcessingPass [${renderView.viewport}]`,
        uses: Object.values(attachments).filter(Boolean),
        renderView: {
          ...renderView,
          viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
        },
        render: () => {
          for (let i = 0; i < renderers.length; i++) {
            const renderer = renderers[i];
            renderer.renderStages.post?.(renderView, entitiesInView, {
              attachments,
              descriptors: this.descriptors,
              passes: this.postProcessingPasses,
            });
          }
        },
      });
    }

    if (drawToScreen !== false) {
      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const blitCmd = {
        name: "drawBlitFullScreenTriangleCmd",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(
          this.descriptors.postProcessing.pipelineDesc
        ),
      };

      renderGraph.renderPass({
        name: `BlitPass [${renderView.viewport}]`,
        uses: [attachments.color],
        renderView,
        render: () => {
          ctx.submit(blitCmd, {
            uniforms: {
              uUseTonemapping: !postProcessing,
              uViewport: renderView.viewport,
              // uViewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
              uTexture: attachments.color,
            },
          });
        },
      });
    }

    return attachments;
  },

  dispose(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.material) {
        for (let property of Object.values(entity.material)) {
          if (
            property?.class === "texture" &&
            ctx.resources.indexOf(property) !== -1
          ) {
            ctx.dispose(property);
          }
        }
      }
    }
  },
});
