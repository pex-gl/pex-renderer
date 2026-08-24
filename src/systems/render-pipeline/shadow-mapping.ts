import { vec3, mat4 } from "pex-math";
import { aabb } from "pex-geom";

import {
  NAMESPACE,
  TEMP_VEC3,
  TEMP_MAT4,
  TEMP_BOUNDS_POINTS,
  TEMP_FRUSTUM,
  computeFrustumPlanes,
  isAABBInFrustum,
  getCubeFaceCamera,
} from "../../utils.js";

import type {
  Entity,
  RendererSystem,
  RenderPipelineSystem,
  ShadowMappingMethods,
  SystemOptions,
} from "../../types.js";
import type { ResourceHandle } from "../../frame-graph/index.js";

const MIN_NEAR = 0.01;
// Stand-in far plane for a light with no `range`: only the cone's side planes
// are wanted from that provisional frustum, so this just has to not clip.
const FAR_ENOUGH = 1e6;

/** Distance from a point to the nearest point of a world-space AABB. */
const closestDistance = (worldBounds: any, point: any) => {
  TEMP_VEC3[0] = Math.max(
    worldBounds[0][0],
    Math.min(point[0], worldBounds[1][0]),
  );
  TEMP_VEC3[1] = Math.max(
    worldBounds[0][1],
    Math.min(point[1], worldBounds[1][1]),
  );
  TEMP_VEC3[2] = Math.max(
    worldBounds[0][2],
    Math.min(point[2], worldBounds[1][2]),
  );
  return vec3.distance(point, TEMP_VEC3);
};

/**
 * Entities the shadow pass is about. A caster puts geometry in the map; a
 * receiver is depth-tested against it, and the frustum has to cover it too or
 * it shadows itself at the clip boundary. Anything that does neither — helpers,
 * unlit debug geometry — must not size the frustum, or it costs texel density
 * everywhere and drags the near plane down for perspective lights.
 */
const shadowParticipants = (entities: Entity[]) =>
  entities.filter(
    (entity) =>
      entity.geometry &&
      entity.transform?.worldBounds &&
      (entity.material?.castShadows || entity.material?.receiveShadows),
  );

/**
 * Create a shadow mapping object to compose with a render-pipeline-system
 *
 * Adds:
 *
 * - "directionalLight", "spotLight" and "pointLight" method to create shadow map
 *   render passes Requires:
 *
 * @private
 */
export default ({
  frameGraph,
}: Pick<SystemOptions, "frameGraph">): ShadowMappingMethods &
  ThisType<RenderPipelineSystem> => ({
  checkLight(light: any, lightEntity: Entity) {
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
  /**
   * Predicate rejecting world bounds the light cannot reach, used to keep the
   * shadow frustum fitted to what the map actually covers.
   *
   * Spot and area lights are cones — the same cone their shadow projection
   * uses, so the fit and the render agree by construction. `range` caps it
   * where the light stops contributing; without one the cone is open-ended and
   * only its sides reject.
   */
  getLightVolumeTest(lightEntity: Entity, light: any) {
    const fov = lightEntity.spotLight ? 2 * light.angle : Math.PI / 2;
    // Near is what the fit is trying to find, so the provisional frustum uses
    // the smallest legal one; only the side planes and the far cap matter here.
    mat4.perspectiveZO(
      TEMP_MAT4,
      fov,
      1,
      MIN_NEAR,
      light.range > 0 ? light.range : FAR_ENOUGH,
    );
    computeFrustumPlanes(TEMP_FRUSTUM, TEMP_MAT4, light._viewMatrix);
    return (worldBounds: any) => isAABBInFrustum(worldBounds, TEMP_FRUSTUM);
  },
  computeLightProperties(
    lightEntity: Entity,
    light: any,
    participants: Entity[],
  ) {
    light._sceneBboxInLightSpace ??= aabb.create();

    const perspective = !lightEntity.directionalLight;
    // Only geometry the light can actually reach may size its frustum. For a
    // perspective light that means the cone: the scene AABB includes everything
    // behind and beside the light, which pins near to MIN_NEAR and stretches
    // far past anything the map covers. The cone's side planes depend on the
    // fov alone, so it can be built before near/far are known — that is what
    // breaks the circularity.
    const inVolume = perspective
      ? this.getLightVolumeTest(lightEntity, light)
      : null;

    aabb.empty(light._sceneBboxInLightSpace);
    let near = Infinity;
    let far = 0;

    for (let i = 0; i < participants.length; i++) {
      const entity = participants[i]!;
      const worldBounds = entity.transform!.worldBounds!;
      if (inVolume && !inVolume(worldBounds)) continue;

      const corners = aabb.getCorners(worldBounds, TEMP_BOUNDS_POINTS);
      for (let c = 0; c < corners.length; c++) {
        const p: any = vec3.multMat4(corners[c]!, light._viewMatrix);
        aabb.includePoint(light._sceneBboxInLightSpace, p);
        // Depth is measured along -z. Corners behind the light describe nothing
        // the map can hold, and letting them through is what collapses near.
        const distance = -p[2];
        if (distance <= 0) continue;
        if (distance < near) near = distance;
        if (distance > far) far = distance;
      }
    }

    if (perspective) {
      // Nothing in reach: keep a valid frustum rather than a degenerate one.
      if (!Number.isFinite(near) || far <= 0) {
        near = MIN_NEAR;
        far = MIN_NEAR * 2;
      }
      // `range` is where the light stops contributing, so nothing beyond it can
      // shadow anything.
      if (light.range > 0) far = Math.min(far, light.range);

      light._near = Math.max(MIN_NEAR, near);
      light._far = Math.max(light._near + MIN_NEAR, far);
    } else {
      // An orthographic light has no apex, so its transform position carries no
      // meaning and "in front" is not a constraint: the box has to span every
      // participant along the light axis or casters on the far side of that
      // position get clipped out of the map. Negative near is legal here.
      light._near =
        light._sceneBboxInLightSpace[1][2] === -Infinity
          ? MIN_NEAR
          : -light._sceneBboxInLightSpace[1][2];
      light._far = Math.max(
        light._near + MIN_NEAR,
        -light._sceneBboxInLightSpace[0][2],
      );
    }

    // Get frustum size
    aabb.size(light._sceneBboxInLightSpace, TEMP_VEC3);
    const size: any = TEMP_VEC3;

    // Light radius as a UV fraction of the shadow map, measured at the plane the
    // projection defines so PCSS penumbra scaling is geometrically correct:
    // - orthographic (directional): the frustum has a constant cross-section.
    // - perspective (spot/area): the frustum width at the near plane, 2·near·tan(halfFov).
    if (lightEntity.directionalLight) {
      light._radiusUV = [
        light.bulbRadius / size[0],
        light.bulbRadius / size[1],
      ];
    } else {
      const halfFov = lightEntity.spotLight ? light.angle : Math.PI / 4;
      const nearPlaneSize = 2 * light._near * Math.tan(halfFov);
      const scale: any = lightEntity.areaLight
        ? lightEntity.transform!.scale
        : null;
      light._radiusUV = [
        (light.bulbRadius * (scale ? scale[0] : 1)) / nearPlaneSize,
        (light.bulbRadius * (scale ? scale[1] : 1)) / nearPlaneSize,
      ];
    }
  },
  // Radial near/far for a point light's cube projection, derived from the scene
  // bounds relative to the light (scene-adaptive, nothing hardcoded).
  computePointLightProperties(
    lightEntity: Entity,
    light: any,
    participants: Entity[],
  ) {
    const lightPosition: any = lightEntity._transform!.worldPosition;

    light._sceneBbox ??= aabb.create();
    aabb.empty(light._sceneBbox);
    for (let i = 0; i < participants.length; i++) {
      const worldBounds = participants[i]!.transform!.worldBounds!;
      // A point light reaches a sphere of `range`, so anything further away
      // than the nearest point of its bounds contributes nothing to the cube.
      if (
        light.range > 0 &&
        closestDistance(worldBounds, lightPosition) > light.range
      ) {
        continue;
      }
      aabb.includeAABB(light._sceneBbox, worldBounds);
    }

    // Farthest scene corner sets far; nearest point on the box sets near.
    aabb.getCorners(light._sceneBbox, TEMP_BOUNDS_POINTS);
    const points: any = TEMP_BOUNDS_POINTS;
    let far = MIN_NEAR;
    for (let i = 0; i < TEMP_BOUNDS_POINTS.length; i++) {
      far = Math.max(far, vec3.distance(lightPosition, points[i]));
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

    if (light.range > 0) far = Math.min(far, light.range);

    light._near = Math.max(MIN_NEAR, vec3.distance(lightPosition, TEMP_VEC3));
    light._far = Math.max(light._near + MIN_NEAR, far);
  },
  /**
   * One array texture for every shadow-casting light that asked for the same
   * size, since a light is a layer rather than a texture of its own.
   *
   * Sizes are not snapped to a ladder: a bucket per distinct size costs one
   * binding each — normally one, every light having the default — and every
   * light keeps exactly the resolution it asked for.
   *
   * Persistent rather than pooled. A bucket lives as long as the lights in it,
   * and pooling would save nothing while costing identity: the texture is read
   * outside the graph (`light._shadowMap`), so a debug view could never be sure
   * which frame's map it holds, and pex-gpu keys bind groups by texture, so
   * every material sampling it would get a fresh bind group every frame.
   */
  createShadowMapBucket(
    size: number,
    count: number,
    cubemap: boolean,
    scope: string,
  ): ResourceHandle {
    return frameGraph.createTexture({
      label: `shadowMaps${cubemap ? "Cube" : "2D"}.${size}${scope}`,
      width: size,
      height: size,
      format: "depth32float",
      persistent: true,
      depth: cubemap ? count * 6 : count,
      viewDimension: cubemap ? ("cube-array" as const) : ("2d-array" as const),
    });
  },

  /**
   * Shadow maps depend on the light and the scene, not on the camera, so a
   * frame with several cameras must declare them once — redeclaring would
   * re-render every map per camera and collide on pass names.
   *
   * Memoised per layer rather than per frame because that is the only thing
   * that changes the caster set: `render-engine` filters entities by the
   * camera's layer before handing them over.
   */
  declareShadowMaps(
    entities: Entity[],
    renderers: RendererSystem[],
    layer: string | undefined,
  ): { shadowMaps: ResourceHandle[]; shadowCastingLights: any[] } {
    const key = `shadowMaps.${layer ?? ""}`;
    const memoized = frameGraph.blackboard.get(key);
    if (memoized) return memoized as any;

    // Once per frame, ahead of every scope: targets are recycled when their
    // lifetime ends, so a map left over from a frame where the light did cast
    // would point at whatever texture took over that allocation. Declaration
    // all happens before execution, so the passes below still get to fill in
    // the lights that do cast.
    if (!frameGraph.blackboard.has("shadowMaps.cleared")) {
      frameGraph.blackboard.set("shadowMaps.cleared", true);
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]!;
        for (const light of [
          entity.directionalLight,
          entity.spotLight,
          entity.areaLight,
          entity.pointLight,
        ] as any[]) {
          if (light) {
            light._shadowMap = undefined;
            light._shadowCubemap = undefined;
            light._shadowBucket = 0;
            light._shadowLayer = 0;
          }
        }
      }
    }

    const shadowMaps: ResourceHandle[] = [];
    const shadowCastingLights: any[] = [];
    const result = { shadowMaps, shadowCastingLights };
    frameGraph.blackboard.set(key, result);

    const shadowCastingEntities = entities.filter(
      (entity) => entity.geometry && entity.material?.castShadows,
    );
    if (!shadowCastingEntities.length) return result;

    const scope = layer ? `.${layer}` : "";

    // Every caster is collected before any texture is allocated: lights sharing
    // a size share one array, so the whole set has to be known to size it.
    const casters: { entity: Entity; light: any; kind: string }[] = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      for (const [kind, light] of [
        ["directionalLight", entity.directionalLight],
        ["pointLight", entity.pointLight],
        ["spotLight", entity.spotLight],
        ["areaLight", entity.areaLight],
      ] as [string, any][]) {
        if (light?.castShadows && this.checkLight(light, entity)) {
          shadowCastingLights.push(light);
          casters.push({ entity, light, kind });
        }
      }
    }
    if (!casters.length) return result;

    // Bucket index is the binding the shader samples; layer is the slot within
    // it. Both are read back off the light component by the renderer.
    const buckets = new Map<
      string,
      { index: number; count: number; size: number; cubemap: boolean }
    >();
    for (const { light, kind } of casters) {
      const cubemap = kind === "pointLight";
      const key = `${cubemap ? "cube" : "2d"}.${light.shadowMapSize}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        // Indices are per kind: the shader dispatches over 2D and cube bindings
        // separately.
        let index = 0;
        for (const other of buckets.values()) {
          if (other.cubemap === cubemap) index++;
        }
        bucket = { index, count: 0, size: light.shadowMapSize, cubemap };
        buckets.set(key, bucket);
      }
      light._shadowBucket = bucket.index;
      light._shadowLayer = bucket.count;
      bucket.count++;
    }

    const bucketMaps = new Map<string, ResourceHandle>();
    for (const [key, { size, count, cubemap }] of buckets) {
      const handle = this.createShadowMapBucket(size, count, cubemap, scope);
      bucketMaps.set(key, handle);
      shadowMaps.push(handle);
    }

    for (const { entity, light, kind } of casters) {
      const cubemap = kind === "pointLight";
      const shadowMap = bucketMaps.get(
        `${cubemap ? "cube" : "2d"}.${light.shadowMapSize}`,
      )!;

      if (kind === "directionalLight") {
        this.renderDirectionalLightShadowMap(
          entity,
          entities,
          renderers,
          scope,
          shadowMap,
        );
      } else if (cubemap) {
        this.renderPointLightShadowMap(
          entity,
          entities,
          renderers,
          scope,
          shadowMap,
        );
      } else {
        this.renderSpotLightShadowMap(
          entity,
          entities,
          renderers,
          scope,
          shadowMap,
        );
      }
    }

    return result;
  },

  renderDirectionalLightShadowMap(
    lightEntity: Entity,
    entities: Entity[],
    renderers: RendererSystem[],
    scope: string,
    shadowMap: ResourceHandle,
  ) {
    const light: any = lightEntity.directionalLight;

    this.computeLightProperties(
      lightEntity,
      light,
      shadowParticipants(entities),
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
      viewport: [0, 0, light.shadowMapSize, light.shadowMapSize],
    };

    frameGraph.addPass({
      name: `directionalLightShadowMap${lightEntity.id}${scope}`,
      color: [],
      depth: { texture: shadowMap, layer: light._shadowLayer, depthClearValue: 1 },
      renderView,
      execute: ({ resolveTexture }) => {
        // Resolved here rather than at declaration: the physical texture behind
        // the handle is only known once the graph has allocated.
        light._shadowMap = resolveTexture(shadowMap);

        this.drawMeshes({
          renderers,
          renderView,
          entitiesInView: entities,
          shadowMappingLight: light,
          transparent: false,
        });
      },
    });
  },

  renderSpotLightShadowMap(
    lightEntity: Entity,
    entities: Entity[],
    renderers: RendererSystem[],
    scope: string,
    shadowMap: ResourceHandle,
  ) {
    const light: any = lightEntity.spotLight || lightEntity.areaLight;

    this.computeLightProperties(
      lightEntity,
      light,
      shadowParticipants(entities),
    );

    const kind = lightEntity.areaLight ? "area" : "spot";

    mat4.perspectiveZO(
      light._projectionMatrix,
      light.angle ? 2 * light.angle : Math.PI / 2,
      1,
      light._near,
      light._far,
    );

    const renderView = {
      camera: {
        viewMatrix: light._viewMatrix,
        projectionMatrix: light._projectionMatrix,
      },
      viewport: [0, 0, light.shadowMapSize, light.shadowMapSize],
    };

    frameGraph.addPass({
      name: `${kind}LightShadowMap${lightEntity.id}${scope}`,
      color: [],
      depth: { texture: shadowMap, layer: light._shadowLayer, depthClearValue: 1 },
      renderView,
      execute: ({ resolveTexture }) => {
        light._shadowMap = resolveTexture(shadowMap);

        this.drawMeshes({
          renderers,
          renderView,
          entitiesInView: entities,
          shadowMappingLight: light,
          transparent: false,
        });
      },
    });
  },

  renderPointLightShadowMap(
    lightEntity: Entity,
    entities: Entity[],
    renderers: RendererSystem[],
    scope: string,
    shadowMap: ResourceHandle,
  ) {
    const light: any = lightEntity.pointLight;

    this.computePointLightProperties(
      lightEntity,
      light,
      shadowParticipants(entities),
    );

    const lightPosition = lightEntity._transform!.worldPosition;
    // Projection (90° cube face, per-light near/far to match the shader) is
    // identical across faces and reused; the per-face view must be a distinct
    // allocation because the render graph defers passes and reads each at endFrame.
    const projectionMatrix = mat4.create();

    for (let i = 0; i < 6; i++) {
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
        viewport: [0, 0, light.shadowMapSize, light.shadowMapSize],
      };

      frameGraph.addPass({
        name: `pointLightShadowMap${lightEntity.id}Face${i}${scope}`,
        color: [],
        // One cube face per pass: six independent write chains into one
        // texture. Layers are flat, so the light's cube occupies six of them.
        depth: {
          texture: shadowMap,
          layer: light._shadowLayer * 6 + i,
          depthClearValue: 1,
        },
        renderView,
        execute: ({ resolveTexture }) => {
          light._shadowCubemap = resolveTexture(shadowMap);
          light._projectionMatrix = projectionMatrix;
          light._viewMatrix = renderView.camera.viewMatrix;

          this.drawMeshes({
            renderers,
            renderView,
            entitiesInView: entities,
            shadowMappingLight: light,
            transparent: false,
          });
        },
      });
    }
  },
});
