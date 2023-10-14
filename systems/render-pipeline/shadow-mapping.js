import { vec3, mat4 } from "pex-math";
import { aabb } from "pex-geom";

import { TEMP_VEC3 } from "../../utils.js";

export default ({ renderGraph, resourceCache, descriptors, drawMeshes }) => ({
  computeLightProperties(lightEntity, light, shadowCastingEntities) {
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

    // Get frustum size
    aabb.size(light._sceneBboxInLightSpace, TEMP_VEC3);

    light._radiusUV = [
      (1 / TEMP_VEC3[0]) *
        (light.radius *
          (lightEntity.areaLight ? lightEntity.transform.scale[0] : 1)),
      (1 / TEMP_VEC3[1]) *
        (light.radius *
          (lightEntity.areaLight ? lightEntity.transform.scale[1] : 1)),
    ];
  },
  getAttachments(light, descriptor, cubemap) {
    let { colorMapDesc, shadowMapDesc } = descriptor;

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
    const colorMap =
      resourceCache[cubemap ? "textureCube" : "texture2D"](colorMapDesc);
    colorMap.name = `tempColorMap (id: ${colorMap.id})`;

    const shadowMap = resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = `shadowMap (id: ${shadowMap.id})`;

    return { color: colorMap, depth: shadowMap };
  },

  directionalLight(lightEntity, entities, renderers, shadowCastingEntities) {
    const light = lightEntity.directionalLight;

    this.computeLightProperties(lightEntity, light, shadowCastingEntities);

    const { color, depth } = this.getAttachments(
      light,
      descriptors.directionalLightShadows
    );

    mat4.ortho(
      light._projectionMatrix,
      light._sceneBboxInLightSpace[0][0],
      light._sceneBboxInLightSpace[1][0],
      light._sceneBboxInLightSpace[0][1],
      light._sceneBboxInLightSpace[1][1],
      light._near,
      light._far
    );

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, depth.width, depth.height],
    };

    renderGraph.renderPass({
      name: `DirectionalLightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
      pass: resourceCache.pass({
        // TODO: creating new descriptor to force new pass from cache
        ...descriptors.directionalLightShadows.pass,
        color: [color],
        depth,
      }),
      renderView: renderView,
      render: () => {
        // Needs to be here for multi-view with different renderer to not overwrite it
        light._shadowMap = depth;
        // renderView.camera.position = lightEntity._transform.worldPosition;

        drawMeshes({
          renderView,
          // viewport: renderView.viewport,
          // //TODO: passing camera entity around is a mess
          // cameraEntity: {
          //   camera: {
          //     position: lightEntity._transform.worldPosition,
          //   },
          // },
          shadowMapping: true,
          shadowMappingLight: light,
          entitiesInView: entities,
          drawTransparent: false,
          renderers,
        });
      },
    });

    light._shadowMap = depth; // TODO: we borrow it for a frame
  },

  spotLight(lightEntity, entities, renderers, shadowCastingEntities) {
    const light = lightEntity.spotLight || lightEntity.areaLight;

    this.computeLightProperties(lightEntity, light, shadowCastingEntities);

    const { color, depth } = this.getAttachments(
      light,
      descriptors.spotLightShadows
    );

    mat4.perspective(
      light._projectionMatrix,
      light.angle ? 2 * light.angle : Math.PI / 2,
      depth.width / depth.height,
      light._near,
      light._far
    );

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, depth.width, depth.height],
    };

    renderGraph.renderPass({
      name: `SpotLightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
      pass: resourceCache.pass({
        // TODO: creating new descriptor to force new pass from cache
        ...descriptors.spotLightShadows.pass,
        color: [color],
        depth: depth,
      }),
      renderView: renderView,
      render: () => {
        light._shadowMap = depth;

        // renderView.camera.position = lightEntity._transform.worldPosition;

        drawMeshes({
          renderView,
          // viewport: renderView.viewport,
          //TODO: passing camera entity around is a mess
          // cameraEntity: {
          //   camera: {
          //     position: lightEntity._transform.worldPosition,
          //   },
          // },
          shadowMapping: true,
          shadowMappingLight: light,
          entitiesInView: entities,
          drawTransparent: false,
          renderers,
        });
      },
    });

    light._shadowMap = depth; // TODO: we borrow it for a frame
  },

  pointLight(lightEntity, entities, renderers) {
    const light = lightEntity.pointLight;

    const { color, depth } = this.getAttachments(
      light,
      descriptors.pointLightShadows,
      true
    );

    for (let i = 0; i < descriptors.pointLightShadows.passes.length; i++) {
      const pass = descriptors.pointLightShadows.passes[i];
      //TODO: need to create new descriptor to get uniq
      const passDesc = { ...pass };
      passDesc.color = [{ texture: color, target: passDesc.color[0].target }];
      passDesc.depth = depth;

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
        viewport: [0, 0, depth.width, depth.height],
      };

      renderGraph.renderPass({
        name: `PointLightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
        pass: resourceCache.pass(passDesc),
        renderView: renderView,
        render: () => {
          //why?
          light._shadowCubemap = color; // TODO: we borrow it for a frame
          light._projectionMatrix = side.projectionMatrix;
          light._viewMatrix = renderView.camera.viewMatrix;

          // renderView.camera.projectionMatrix = light._projectionMatrix;
          // renderView.camera.viewMatrix = light._viewMatrix;
          drawMeshes({
            // viewport: renderView.viewport,
            renderView,
            //TODO: passing camera entity around is a mess
            // cameraEntity: {
            //   camera: {},
            // },
            shadowMapping: true,
            shadowMappingLight: light,
            entitiesInView: entities,
            drawTransparent: false,
            renderers,
          });
        },
      });
    }

    light._shadowCubemap = color; // TODO: we borrow it for a frame
  },
});
