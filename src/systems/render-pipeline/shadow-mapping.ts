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
  LightShadow,
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

/**
 * Separator-prefixed scope, for the bucket labels and pass names that have to
 * stay unique across layers. The scope itself is the camera layer verbatim, and
 * that is what shadows are keyed by — the dot is punctuation for a composed
 * name, not part of the identity.
 */
const nameSuffix = (scope: string) => (scope ? `.${scope}` : "");

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
 * Adds `_shadows` to every light it sees: one {@link LightShadow} per
 * declaration scope, holding the fitted frustum, the bucket slot the shader
 * samples, and — once the graph has allocated — the map itself.
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
    } else if (light._viewMatrix) {
      return true;
    } else {
      console.warn(
        NAMESPACE,
        `"${this.type}" light component missing matrices. Add a lightSystem.update(entities).`,
      );
    }
  },
  /**
   * This scope's shadow for a light, created on first use and reused after —
   * the fields are rewritten every frame, so a fresh object per frame would be
   * an allocation per light per scope for nothing.
   */
  getLightShadow(light: any, scope: string): LightShadow {
    light._shadows ??= new Map<string, LightShadow>();
    let shadow: LightShadow | undefined = light._shadows.get(scope);
    if (!shadow) {
      shadow = {
        cubemap: false,
        bucket: 0,
        layer: 0,
        near: 0,
        far: 0,
        radiusUV: [0, 0],
        projectionMatrix: mat4.create() as any,
        texture: undefined,
      };
      light._shadows.set(scope, shadow);
    }
    return shadow;
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
    const fov = lightEntity.spotLight ? 2 * light.outerConeAngle : Math.PI / 2;
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
    shadow: LightShadow,
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

      shadow.near = Math.max(MIN_NEAR, near);
      shadow.far = Math.max(shadow.near + MIN_NEAR, far);
    } else {
      // An orthographic light has no apex, so its transform position carries no
      // meaning and "in front" is not a constraint: the box has to span every
      // participant along the light axis or casters on the far side of that
      // position get clipped out of the map. Negative near is legal here.
      shadow.near =
        light._sceneBboxInLightSpace[1][2] === -Infinity
          ? MIN_NEAR
          : -light._sceneBboxInLightSpace[1][2];
      shadow.far = Math.max(
        shadow.near + MIN_NEAR,
        -light._sceneBboxInLightSpace[0][2],
      );
    }

    // Light radius as a UV fraction of the shadow map, measured at the plane the
    // projection defines so PCSS penumbra scaling is geometrically correct:
    // - orthographic (directional): the frustum has a constant cross-section.
    // - perspective (spot/area): the frustum width at the near plane, 2·near·tan(halfFov).
    if (lightEntity.directionalLight) {
      const size: any = aabb.size(light._sceneBboxInLightSpace, TEMP_VEC3);
      shadow.radiusUV[0] = light.bulbRadius / size[0];
      shadow.radiusUV[1] = light.bulbRadius / size[1];
    } else {
      const halfFov = lightEntity.spotLight ? light.outerConeAngle : Math.PI / 4;
      const nearPlaneSize = 2 * shadow.near * Math.tan(halfFov);
      const scale: any = lightEntity.areaLight
        ? lightEntity.transform!.scale
        : null;
      shadow.radiusUV[0] =
        (light.bulbRadius * (scale ? scale[0] : 1)) / nearPlaneSize;
      shadow.radiusUV[1] =
        (light.bulbRadius * (scale ? scale[1] : 1)) / nearPlaneSize;
    }
  },
  /** Radial near/far for a point light's cube projection, fitted to the scene. */
  computePointLightProperties(
    lightEntity: Entity,
    light: any,
    participants: Entity[],
    shadow: LightShadow,
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

    shadow.near = Math.max(
      MIN_NEAR,
      closestDistance(light._sceneBbox, lightPosition),
    );
    shadow.far = Math.max(shadow.near + MIN_NEAR, far);
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
   * outside the graph (`LightShadow.texture`), so a debug view could never be
   * sure which frame's map it holds, and pex-gpu keys bind groups by texture,
   * so every material sampling it would get a fresh bind group every frame.
   */
  createShadowMapBucket(
    size: number,
    count: number,
    cubemap: boolean,
    scope: string,
  ): ResourceHandle {
    return frameGraph.createTexture({
      label: `shadowMaps${cubemap ? "Cube" : "2D"}.${size}${nameSuffix(scope)}`,
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
   * that changes the caster set. `entities` is the view's list, not the
   * engine's: casting from geometry the view never draws would put shadows in
   * it from nothing visible, and would fit the frustum to bounds off screen.
   *
   * A light without a `layer` is in every view, so it is declared once per
   * scope — which is why each declaration produces a {@link LightShadow} keyed
   * by that scope rather than a set of fields on the component.
   */
  declareShadowMaps(
    entities: Entity[],
    renderers: RendererSystem[],
    layer: string | undefined,
  ): { shadowMaps: ResourceHandle[] } {
    const key = `shadowMaps.${layer ?? ""}`;
    const memoized = frameGraph.blackboard.get(key);
    if (memoized) return memoized as any;

    const scope = layer ?? "";

    // Cleared per scope, and for every light rather than only the casters: a
    // shadow left over from a frame where the light did cast would name a
    // texture the pool has since recycled or, once a bucket's caster count
    // changes, destroyed. Declaration all happens before execution, so the
    // passes below still get to fill in the lights that do cast.
    for (let i = 0; i < entities.length; i++) {
      for (const kind of LIGHT_KINDS) {
        const light: any = entities[i]![kind];
        if (light) this.getLightShadow(light, scope).texture = undefined;
      }
    }

    const shadowMaps: ResourceHandle[] = [];
    const result = { shadowMaps };
    frameGraph.blackboard.set(key, result);

    const shadowCastingEntities = entities.filter(
      (entity) => entity.geometry && entity.material?.castShadows,
    );
    if (!shadowCastingEntities.length) return result;

    // Every caster is collected before any texture is allocated: lights sharing
    // a size share one array, so the whole set has to be known to size it.
    const casters: {
      entity: Entity;
      light: any;
      kind: LightKind;
      shadow: LightShadow;
    }[] = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      for (const kind of LIGHT_KINDS) {
        const light: any = entity[kind];
        if (light?.castShadows && this.checkLight(light, entity)) {
          const shadow = this.getLightShadow(light, scope);
          shadow.cubemap = kind === "pointLight";
          casters.push({ entity, light, kind, shadow });
        }
      }
    }
    if (!casters.length) return result;

    // Bucket index is the binding the shader samples; layer is the slot within
    // it. Both are read back off the shadow by the renderer.
    const buckets = new Map<
      string,
      { index: number; count: number; size: number; cubemap: boolean }
    >();
    for (const { light, shadow } of casters) {
      const key = bucketKey(shadow.cubemap, light.shadowMapSize);
      let bucket = buckets.get(key);
      if (!bucket) {
        // Indices are per kind: the shader dispatches over 2D and cube bindings
        // separately.
        let index = 0;
        for (const other of buckets.values()) {
          if (other.cubemap === shadow.cubemap) index++;
        }
        bucket = {
          index,
          count: 0,
          size: light.shadowMapSize,
          cubemap: shadow.cubemap,
        };
        buckets.set(key, bucket);
      }
      shadow.bucket = bucket.index;
      shadow.layer = bucket.count;
      bucket.count++;
    }

    const bucketMaps = new Map<string, ResourceHandle>();
    for (const [key, { size, count, cubemap }] of buckets) {
      const handle = this.createShadowMapBucket(size, count, cubemap, scope);
      bucketMaps.set(key, handle);
      shadowMaps.push(handle);
    }

    for (const { entity, light, kind, shadow } of casters) {
      this.renderShadowMap(
        kind,
        entity,
        entities,
        renderers,
        scope,
        bucketMaps.get(bucketKey(shadow.cubemap, light.shadowMapSize))!,
        shadow,
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
    shadow: LightShadow,
  ) {
    const light: any = lightEntity[kind];
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
        name: `${name}${nameSuffix(scope)}`,
        color: [],
        depth: { texture: shadowMap, layer, depthClearValue: 1 },
        renderView,
        execute: ({ resolveTexture }) => {
          // Resolved here rather than at declaration: the physical texture
          // behind the handle is only known once the graph has allocated.
          shadow.texture = resolveTexture(shadowMap);

          this.drawMeshes({
            renderers,
            renderView,
            entitiesInView: entities,
            shadowMappingLight: light,
            lightShadow: shadow,
            transparent: false,
          });
        },
      });
    };

    if (shadow.cubemap) {
      this.computePointLightProperties(
        lightEntity,
        light,
        participants,
        shadow,
      );

      // The 90° face projection is the same for all six and is shared; each
      // view matrix must be its own allocation, since execute reads it back
      // long after this loop has moved on. Neither is kept on the shadow: a cube
      // is sampled by direction, so shading needs only `far` to normalize the
      // radial distance against.
      const projectionMatrix = mat4.create();
      for (let face = 0; face < 6; face++) {
        const { viewMatrix } = getCubeFaceCamera(
          face,
          lightEntity._transform!.worldPosition,
          shadow.near,
          shadow.far,
          mat4.create(),
          projectionMatrix,
        );
        // Layers are flat, so one cube occupies six of them, and each face is
        // an independent write chain into the same texture.
        shadowPass(
          `pointLightShadowMap${lightEntity.id}Face${face}`,
          shadow.layer * 6 + face,
          { projectionMatrix, viewMatrix },
        );
      }
      return;
    }

    this.computeLightProperties(lightEntity, light, participants, shadow);

    if (kind === "directionalLight") {
      const bbox = light._sceneBboxInLightSpace;
      mat4.orthoZO(
        shadow.projectionMatrix,
        bbox[0][0],
        bbox[1][0],
        bbox[0][1],
        bbox[1][1],
        shadow.near,
        shadow.far,
      );
    } else {
      // An area light has no angle of its own: it shadows through the same 90°
      // cone the fit assumed.
      mat4.perspectiveZO(
        shadow.projectionMatrix,
        light.outerConeAngle ? 2 * light.outerConeAngle : Math.PI / 2,
        1,
        shadow.near,
        shadow.far,
      );
    }

    shadowPass(`${kind}ShadowMap${lightEntity.id}`, shadow.layer, {
      viewMatrix: light._viewMatrix,
      projectionMatrix: shadow.projectionMatrix,
    });
  },
});
