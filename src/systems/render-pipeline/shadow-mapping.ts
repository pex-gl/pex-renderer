import { vec3, mat4 } from "pex-math";
import { aabb } from "pex-geom";

import {
  NAMESPACE,
  TEMP_VEC3,
  TEMP_BOUNDS_POINTS,
  getCubeFaceCamera,
} from "../../utils.js";

const MIN_NEAR = 0.01;

/**
 * Create a shadow mapping object to compose with a render-pipeline-system
 *
 * Adds:
 *
 * - "directionalLight", "spotLight" and "pointLight" method to create shadow map
 *   render passes Requires:
 * - This.drawMeshes()
 * - This.descriptors
 *
 * @private
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").System}
 */
export default ({ renderGraph, resourceCache }) => ({
  checkLight(light, lightEntity) {
    if (!lightEntity._transform) {
      console.warn(
        NAMESPACE,
        `"${this.type}" light entity missing transform. Add a transformSystem.update(entities).`,
      );
    } else if (light._projectionMatrix) {
      return true;
    } else {
      console.warn(
        NAMESPACE,
        `"${this.type}" light component missing matrices. Add a lightSystem.update(entities).`,
      );
    }
  },
  computeLightProperties(lightEntity, light, shadowCastingEntities) {
    light._sceneBboxInLightSpace ??= aabb.create();

    aabb.fromPoints(
      light._sceneBboxInLightSpace,
      shadowCastingEntities.flatMap((entity) =>
        aabb
          .getCorners(entity.transform.worldBounds)
          .map((p) => vec3.multMat4(p, light._viewMatrix)),
      ),
    );

    light._near = Math.max(MIN_NEAR, -light._sceneBboxInLightSpace[1][2]);
    light._far = -light._sceneBboxInLightSpace[0][2];

    // Get frustum size
    aabb.size(light._sceneBboxInLightSpace, TEMP_VEC3);

    // Light radius as a UV fraction of the shadow map, measured at the plane the
    // projection defines so PCSS penumbra scaling is geometrically correct:
    // - orthographic (directional): the frustum has a constant cross-section.
    // - perspective (spot/area): the frustum width at the near plane, 2·near·tan(halfFov).
    if (lightEntity.directionalLight) {
      light._radiusUV = [
        light.bulbRadius / TEMP_VEC3[0],
        light.bulbRadius / TEMP_VEC3[1],
      ];
    } else {
      const halfFov = lightEntity.spotLight ? light.angle : Math.PI / 4;
      const nearPlaneSize = 2 * light._near * Math.tan(halfFov);
      const scale = lightEntity.areaLight ? lightEntity.transform.scale : null;
      light._radiusUV = [
        (light.bulbRadius * (scale ? scale[0] : 1)) / nearPlaneSize,
        (light.bulbRadius * (scale ? scale[1] : 1)) / nearPlaneSize,
      ];
    }
  },
  // Radial near/far for a point light's cube projection, derived from the scene
  // bounds relative to the light (scene-adaptive, nothing hardcoded).
  computePointLightProperties(lightEntity, light, bboxEntities) {
    const lightPosition = lightEntity._transform.worldPosition;

    light._sceneBbox ??= aabb.create();
    aabb.empty(light._sceneBbox);
    for (let i = 0; i < bboxEntities.length; i++) {
      aabb.includeAABB(light._sceneBbox, bboxEntities[i].transform.worldBounds);
    }

    // Farthest scene corner sets far; nearest point on the box sets near.
    aabb.getCorners(light._sceneBbox, TEMP_BOUNDS_POINTS);
    let far = MIN_NEAR;
    for (let i = 0; i < TEMP_BOUNDS_POINTS.length; i++) {
      far = Math.max(far, vec3.distance(lightPosition, TEMP_BOUNDS_POINTS[i]));
    }

    TEMP_VEC3[0] = Math.max(
      light._sceneBbox[0][0],
      Math.min(lightPosition[0], light._sceneBbox[1][0]),
    );
    TEMP_VEC3[1] = Math.max(
      light._sceneBbox[0][1],
      Math.min(lightPosition[1], light._sceneBbox[1][1]),
    );
    TEMP_VEC3[2] = Math.max(
      light._sceneBbox[0][2],
      Math.min(lightPosition[2], light._sceneBbox[1][2]),
    );

    light._near = Math.max(MIN_NEAR, vec3.distance(lightPosition, TEMP_VEC3));
    light._far = Math.max(light._near + MIN_NEAR, far);
  },
  getLightAttachments(light, descriptor, cubemap) {
    const { shadowMapDesc } = descriptor;

    shadowMapDesc.width = shadowMapDesc.height = light.shadowMapSize;

    // Modern shadow maps are sampleable depth textures; there is no color map.
    const shadowMap = cubemap
      ? resourceCache.textureCube(shadowMapDesc)
      : resourceCache.texture2D(shadowMapDesc);
    shadowMap.name = `shadowMap (id: ${shadowMap.id})`;

    return { depth: shadowMap };
  },

  renderDirectionalLightShadowMap(
    lightEntity,
    entities,
    renderers,
    colorAttachments,
    shadowCastingEntities,
  ) {
    const light = lightEntity.directionalLight;

    // Frustum must cover receivers too, not just casters: a hardware depth
    // comparison shadows anything whose clip depth falls outside [near, far].
    this.computeLightProperties(
      lightEntity,
      light,
      entities.filter((e) => e.geometry && e.material),
    );

    const { depth } = this.getLightAttachments(
      light,
      this.descriptors.directionalLightShadows,
    );

    mat4.orthoZO(
      light._projectionMatrix,
      light._sceneBboxInLightSpace[0][0],
      light._sceneBboxInLightSpace[1][0],
      light._sceneBboxInLightSpace[0][1],
      light._sceneBboxInLightSpace[1][1],
      light._near,
      light._far,
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
        ...this.descriptors.directionalLightShadows.pass,
        color: [],
        depth,
      }),
      renderView,
      render: () => {
        // Needs to be here for multi-view with different renderer to not overwrite it
        light._shadowMap = depth;

        this.drawMeshes({
          renderers,
          renderView,
          colorAttachments,
          entitiesInView: entities,
          shadowMappingLight: light,
          transparent: false,
        });
      },
    });

    light._shadowMap = depth; // TODO: we borrow it for a frame
  },

  renderSpotLightShadowMap(
    lightEntity,
    entities,
    renderers,
    colorAttachments,
    shadowCastingEntities,
  ) {
    const light = lightEntity.spotLight || lightEntity.areaLight;

    // Frustum must cover receivers too (see renderDirectionalLightShadowMap).
    this.computeLightProperties(
      lightEntity,
      light,
      entities.filter((e) => e.geometry && e.material),
    );

    const { depth } = this.getLightAttachments(
      light,
      this.descriptors.spotLightShadows,
    );

    mat4.perspectiveZO(
      light._projectionMatrix,
      light.angle ? 2 * light.angle : Math.PI / 2,
      depth.width / depth.height,
      light._near,
      light._far,
    );

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, depth.width, depth.height],
    };

    renderGraph.renderPass({
      name: `${lightEntity.areaLight ? "Area" : "Spot"}LightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
      pass: resourceCache.pass({
        // TODO: creating new descriptor to force new pass from cache
        ...this.descriptors.spotLightShadows.pass,
        color: [],
        depth: depth,
      }),
      renderView,
      render: () => {
        light._shadowMap = depth;

        this.drawMeshes({
          renderers,
          renderView,
          colorAttachments,
          entitiesInView: entities,
          shadowMappingLight: light,
          transparent: false,
        });
      },
    });

    light._shadowMap = depth; // TODO: we borrow it for a frame
  },

  renderPointLightShadowMap(
    lightEntity,
    entities,
    renderers,
    colorAttachments,
  ) {
    const light = lightEntity.pointLight;

    const { depth } = this.getLightAttachments(
      light,
      this.descriptors.pointLightShadows,
      true,
    );

    this.computePointLightProperties(
      lightEntity,
      light,
      entities.filter((e) => e.geometry && e.material),
    );

    const lightPosition = lightEntity._transform.worldPosition;
    // Projection (90° cube face, per-light near/far to match the shader) is
    // identical across faces and reused; the per-face view must be a distinct
    // allocation because the render graph defers passes and reads each at endFrame.
    const projectionMatrix = mat4.create();

    for (let i = 0; i < this.descriptors.pointLightShadows.passes.length; i++) {
      const pass = this.descriptors.pointLightShadows.passes[i];
      //TODO: need to create new descriptor to get uniq
      const passDesc = { ...pass };
      passDesc.color = [];
      // Render into a single cube face of the depth texture.
      passDesc.depth = { texture: depth, target: i };

      const { viewMatrix } = getCubeFaceCamera(
        i,
        lightPosition,
        light._near,
        light._far,
        mat4.create(),
        projectionMatrix,
      );
      const renderView = {
        camera: { projectionMatrix, viewMatrix },
        viewport: [0, 0, depth.width, depth.height],
      };

      renderGraph.renderPass({
        name: `PointLightShadowMap [${renderView.viewport}] (id: ${lightEntity.id})`,
        pass: resourceCache.pass(passDesc),
        renderView,
        render: () => {
          //why?
          light._shadowCubemap = depth; // TODO: we borrow it for a frame
          light._projectionMatrix = projectionMatrix;
          light._viewMatrix = renderView.camera.viewMatrix;

          this.drawMeshes({
            renderers,
            renderView,
            colorAttachments,
            entitiesInView: entities,
            shadowMappingLight: light,
            transparent: false,
          });
        },
      });
    }

    light._shadowCubemap = depth; // TODO: we borrow it for a frame
  },
});
