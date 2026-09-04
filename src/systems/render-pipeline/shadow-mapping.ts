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

/** Light components that can cast, in the order buckets index them. */
export const LIGHT_KINDS = [
  "directionalLight",
  "pointLight",
  "spotLight",
  "areaLight",
] as const;
export type LightKind = (typeof LIGHT_KINDS)[number];

/** Lights sharing a dimensionality and a size share one array texture. */
const bucketKey = (cubemap: boolean, size: number) =>
  `${cubemap ? "cube" : "2d"}.${size}`;

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
 * Shadow mapping methods, composed into the render-pipeline-system.
 *
 * Adds `_near`, `_far`, `_radiusUV` and `_sceneBboxInLightSpace` to every
 * casting light, plus the `_shadowBucket`/`_shadowLayer` pair naming where in
 * the bucketed array its map lives, and `_shadowMap`/`_shadowCubemap` once the
 * graph has allocated one.
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
      // An infinite range needs a finite far plane to build a frustum from.
      Number.isFinite(light.range) && light.range > 0
        ? light.range
        : FAR_ENOUGH,
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

    // Light radius as a UV fraction of the shadow map, measured at the plane the
    // projection defines so PCSS penumbra scaling is geometrically correct:
    // - orthographic (directional): the frustum has a constant cross-section.
    // - perspective (spot/area): the frustum width at the near plane, 2·near·tan(halfFov).
    if (lightEntity.directionalLight) {
      const size: any = aabb.size(light._sceneBboxInLightSpace, TEMP_VEC3);
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
  /** Radial near/far for a point light's cube projection, fitted to the scene. */
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
    const points: any = aabb.getCorners(light._sceneBbox, TEMP_BOUNDS_POINTS);
    let far = MIN_NEAR;
    for (let i = 0; i < points.length; i++) {
      far = Math.max(far, vec3.distance(lightPosition, points[i]));
    }
    if (light.range > 0) far = Math.min(far, light.range);

    light._near = Math.max(
      MIN_NEAR,
      closestDistance(light._sceneBbox, lightPosition),
    );
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
        for (const kind of LIGHT_KINDS) {
          const light: any = entities[i]![kind];
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
    const casters: {
      entity: Entity;
      light: any;
      kind: LightKind;
      cubemap: boolean;
    }[] = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      for (const kind of LIGHT_KINDS) {
        const light: any = entity[kind];
        if (light?.castShadows && this.checkLight(light, entity)) {
          shadowCastingLights.push(light);
          casters.push({ entity, light, kind, cubemap: kind === "pointLight" });
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
    for (const { light, cubemap } of casters) {
      const key = bucketKey(cubemap, light.shadowMapSize);
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

    for (const { entity, light, kind, cubemap } of casters) {
      this.renderShadowMap(
        kind,
        entity,
        entities,
        renderers,
        scope,
        bucketMaps.get(bucketKey(cubemap, light.shadowMapSize))!,
      );
    }

    return result;
  },

  /**
   * One light's shadow map, into the layer of the bucket it was assigned.
   *
   * A point light is six passes over six layers, one per cube face, and gets
   * its near/far radially; every other kind is a single pass whose projection
   * is the one the shader will sample back.
   */
  renderShadowMap(
    kind: LightKind,
    lightEntity: Entity,
    entities: Entity[],
    renderers: RendererSystem[],
    scope: string,
    shadowMap: ResourceHandle,
  ) {
    const light: any = lightEntity[kind];
    const cubemap = kind === "pointLight";
    const participants = shadowParticipants(entities);

    const shadowPass = (
      name: string,
      layer: number,
      camera: { viewMatrix: any; projectionMatrix: any },
    ) => {
      const renderView = {
        camera,
        viewport: [0, 0, light.shadowMapSize, light.shadowMapSize],
      };

      frameGraph.addPass({
        name: `${name}${scope}`,
        color: [],
        depth: { texture: shadowMap, layer, depthClearValue: 1 },
        renderView,
        execute: ({ resolveTexture }) => {
          // Resolved here rather than at declaration: the physical texture
          // behind the handle is only known once the graph has allocated.
          const texture = resolveTexture(shadowMap);
          if (cubemap) {
            light._shadowCubemap = texture;
            // The renderer reads the face this pass drew off the component.
            light._projectionMatrix = camera.projectionMatrix;
            light._viewMatrix = camera.viewMatrix;
          } else {
            light._shadowMap = texture;
          }

          this.drawMeshes({
            renderers,
            renderView,
            entitiesInView: entities,
            shadowMappingLight: light,
            transparent: false,
          });
        },
      });
    };

    if (cubemap) {
      this.computePointLightProperties(lightEntity, light, participants);

      // The 90° face projection is the same for all six and is shared; each
      // view matrix must be its own allocation, since execute reads it back
      // long after this loop has moved on.
      const projectionMatrix = mat4.create();
      for (let face = 0; face < 6; face++) {
        const { viewMatrix } = getCubeFaceCamera(
          face,
          lightEntity._transform!.worldPosition,
          light._near,
          light._far,
          mat4.create(),
          projectionMatrix,
        );
        // Layers are flat, so one cube occupies six of them, and each face is
        // an independent write chain into the same texture.
        shadowPass(
          `pointLightShadowMap${lightEntity.id}Face${face}`,
          light._shadowLayer * 6 + face,
          { projectionMatrix, viewMatrix },
        );
      }
      return;
    }

    this.computeLightProperties(lightEntity, light, participants);

    if (kind === "directionalLight") {
      const bbox = light._sceneBboxInLightSpace;
      mat4.orthoZO(
        light._projectionMatrix,
        bbox[0][0],
        bbox[1][0],
        bbox[0][1],
        bbox[1][1],
        light._near,
        light._far,
      );
    } else {
      // An area light has no angle of its own: it shadows through the same 90°
      // cone the fit assumed.
      mat4.perspectiveZO(
        light._projectionMatrix,
        light.angle ? 2 * light.angle : Math.PI / 2,
        1,
        light._near,
        light._far,
      );
    }

    shadowPass(`${kind}ShadowMap${lightEntity.id}`, light._shadowLayer, {
      viewMatrix: light._viewMatrix,
      projectionMatrix: light._projectionMatrix,
    });
  },
});
