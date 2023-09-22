import { vec3, mat4 } from "pex-math";
import { aabb } from "pex-geom";

export default ({ drawMeshes, renderGraph, resourceCache, descriptors }) => ({
  directionalLight(lightEntity, entities, shadowCastingEntities, renderers) {
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

    let colorMapDesc = descriptors.directionalLightShadows.colorMapDesc;
    let shadowMapDesc = descriptors.directionalLightShadows.shadowMapDesc;

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
    colorMap.name = `tempColorMap (id: ${colorMap.id})`;

    const shadowMap = resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = `shadowMap (id: ${shadowMap.id})`;

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, shadowMap.width, shadowMap.height],
    };

    renderGraph.renderPass({
      name: `DirectionalLightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
      pass: resourceCache.pass({
        // TODO: creating new descriptor to force new pass from cache
        ...descriptors.directionalLightShadows.pass,
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

  spotLight(lightEntity, entities, shadowCastingEntities, renderers) {
    const light = lightEntity.spotLight || lightEntity.areaLight;
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

    let colorMapDesc = descriptors.spotLightShadows.colorMapDesc;
    let shadowMapDesc = descriptors.spotLightShadows.shadowMapDesc;

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
    colorMap.name = `tempColorMap (id: ${colorMap.id})`;

    const shadowMap = resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = `shadowMap (id: ${shadowMap.id})`;

    mat4.perspective(
      light._projectionMatrix,
      light.angle ? 2 * light.angle : Math.PI / 2,
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
      name: `SpotLightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
      pass: resourceCache.pass({
        // TODO: creating new descriptor to force new pass from cache
        ...descriptors.spotLightShadows.pass,
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
          forward: false,
          drawTransparent: false,
          renderers,
        });
      },
    });

    light._shadowMap = shadowMap; // TODO: we borrow it for a frame
  },

  pointLight(lightEntity, entities, shadowCastingEntities, renderers) {
    const light = lightEntity.pointLight;

    let shadowCubemapDesc = descriptors.pointLightShadows.shadowCubemapDesc;
    let shadowMapDesc = descriptors.pointLightShadows.shadowMapDesc;

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
    shadowCubemap.name = `tempCubemap (id: ${shadowCubemap.id})`;

    const shadowMap = resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = `shadowMap (id: ${shadowMap.id})`;

    for (let i = 0; i < descriptors.pointLightShadows.passes.length; i++) {
      const pass = descriptors.pointLightShadows.passes[i];
      //TODO: need to create new descriptor to get uniq
      const passDesc = { ...pass };
      passDesc.color = [
        { texture: shadowCubemap, target: passDesc.color[0].target },
      ];
      passDesc.depth = shadowMap;

      const side = descriptors.pointLightShadows.cubemapSides[i];
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
        name: `PointLightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
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
});
