import { mat4, vec3, quat, utils } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";
import halton from "halton";
import {
  NAMESPACE,
  TEMP_MAT4,
  computeFrustumPlanes,
  ev100,
  exposureFromEV100,
  getDefaultViewport,
} from "../utils.js";

import type { Vec2, Vec3 } from "pex-math";
import type {
  CameraComponentOptions,
  CameraView,
  Entity,
  EntityId,
  SystemOptions,
  SystemUpdateOptions,
  TransformCache,
} from "../types.js";

/**
 * A camera after the component has applied its defaults. The math below reads
 * these fields directly rather than re-checking each one; the projection-
 * specific groups (`fov`, or the six orthographic bounds) are guaranteed by
 * whichever branch of the component ran.
 */
type ResolvedCamera = CameraComponentOptions &
  Required<
    Pick<
      CameraComponentOptions,
      | "projection"
      | "near"
      | "far"
      | "aspect"
      | "fov"
      | "left"
      | "right"
      | "top"
      | "bottom"
      | "zoom"
      | "fStop"
      | "shutterSpeed"
      | "iso"
      | "focalLength"
      | "sensorSize"
      | "sensorFit"
      | "projectionMatrix"
      | "viewMatrix"
      | "inverseViewMatrix"
      | "frustum"
    >
  > & { view?: Required<CameraView> };

/** The camera system's per-entity focal length / field of view bookkeeping. */
interface CameraCache {
  camera: ResolvedCamera;
  fov?: number;
  focalLength?: number;
}

/** What pex-cam's orbiter writes back through the proxy camera's `set`. */
interface OrbiterCameraSet {
  target?: Vec3;
  position?: Vec3;
  zoom?: number;
}

const resolvedCamera = (entity: Entity) => entity.camera as ResolvedCamera;

function computeFrustum(camera: ResolvedCamera) {
  computeFrustumPlanes(
    camera.frustum,
    camera.projectionMatrix,
    camera.viewMatrix,
  );
}

/**
 * Halton(2, 3), centred on the pixel — the standard temporal antialiasing
 * sequence. Two coprime bases give a set that stays evenly spread at any prefix
 * length, where random offsets clump and leave the pixel unevenly covered over
 * the handful of frames a moving camera gets before its history is rejected.
 *
 * The first point of the sequence is dropped: it is (0, 0) in every base, which
 * centres to the pixel's corner rather than anywhere useful.
 */
const JITTER_SAMPLE_COUNT = 8;
const JITTER_SAMPLES = halton(JITTER_SAMPLE_COUNT + 1, [2, 3])
  .slice(1)
  .map(([x, y]) => [x! - 0.5, y! - 0.5]);
const NO_JITTER = [0, 0];

/**
 * SMAA T2x's two sample positions, in pixels with y up: the reference's
 * @SUBSAMPLE_INDICES table. The smaa effect tells which one a frame used from
 * the jitter's sign, and picks the matching subsample indices.
 */
const SMAA_T2X_JITTER_SAMPLES = [
  [0.25, -0.25],
  [-0.25, 0.25],
];

/**
 * Cameras asked to drop their temporal history, consumed by the next update.
 *
 * Held here rather than on the component so `_temporalReset` can mean one thing
 * — "this frame does not continue the last" — and be read by any number of
 * consumers without one of them clearing it out from under the others.
 */
const temporalResets = new WeakSet<object>();

/**
 * This frame's sub-pixel offset, or zero when nothing accumulates one — an
 * offset left behind after the effect is switched off would sit the image
 * permanently off-centre. Temporal antialiasing supersedes SMAA T2x, so its
 * sequence wins when both are on.
 */
function updateCameraJitter(
  entity: Entity,
  frameIndex: number,
  viewport: number[],
) {
  const jitter = (entity.camera!._jitter ??= [0, 0]);
  const postProcessing = entity.postProcessing;
  const sample = postProcessing?.taa
    ? JITTER_SAMPLES[frameIndex % JITTER_SAMPLE_COUNT]!
    : postProcessing?.smaa?.mode === "t2x"
      ? SMAA_T2X_JITTER_SAMPLES[frameIndex % 2]!
      : NO_JITTER;

  // Half a pixel expressed in NDC, where one pixel spans 2 / viewportSize.
  jitter[0] = (2 * sample[0]!) / viewport[2]!;
  jitter[1] = (2 * sample[1]!) / viewport[3]!;
}

/**
 * The unjittered view-projection, its inverse, and the one from last frame —
 * what anything reprojecting between frames needs, derived here because this is
 * the only place that knows when the view and projection matrices are final.
 *
 * Maintained for every camera rather than only when something reads it: it is
 * two multiplies and an inverse, and the alternative is the camera system
 * knowing which effects are switched on. Assumes one update per rendered frame,
 * which is the same assumption `deltaTime` already makes.
 */
function updateCameraViewProjection(camera: ResolvedCamera) {
  const previous = (camera._previousViewProjectionMatrix ??= mat4.create());
  const viewProjection = (camera._viewProjectionMatrix ??= mat4.create());
  const inverse = (camera._inverseViewProjectionMatrix ??= mat4.create());

  // Captured before this frame's overwrites it. A temporal resolve holds a
  // reference to the previous matrix through to execute, so it may only be
  // rewritten on the next frame, never again within this one.
  mat4.set(previous, viewProjection);

  mat4.set(viewProjection, camera.projectionMatrix);
  mat4.mult(viewProjection, camera.viewMatrix);

  // A frame with nothing behind it — the first, or the one after a cut — has no
  // previous view worth the name, and the identity mat4.create() left behind is
  // not one. Seeding from the matrix just computed makes every motion vector
  // that frame read zero, which is the honest answer: nothing is known to have
  // moved, as opposed to everything having moved from the origin.
  if (!camera._hasPreviousViewProjectionMatrix || camera._temporalReset) {
    camera._hasPreviousViewProjectionMatrix = true;
    mat4.set(previous, viewProjection);
  }

  mat4.set(inverse, viewProjection);
  mat4.invert(inverse);
}

/**
 * Scene luminance (cd/m²) to a sensor-referred value, pre-multiplied into
 * everything that writes scene colour rather than applied downstream: the
 * colour target is half float and physical lighting overruns it, and every
 * threshold after this point — bloom, lens flare, depth of field — is a number
 * about the exposed image.
 *
 * Compensation offsets the metered EV rather than scaling the result — the same
 * number either way, and the sign follows the photographic convention: positive
 * opens up, one stop per unit.
 */
function updateCameraExposure(camera: ResolvedCamera) {
  camera._exposure = exposureFromEV100(
    ev100(camera.fStop, camera.shutterSpeed, camera.iso) -
      (camera.exposureCompensation ?? 0),
  );
}

// TODO: projectionMatrix should only be recomputed if parameters changed
function updateCameraProjection(
  camera: ResolvedCamera,
  transform: TransformCache,
) {
  // pex-math vectors are `number[]`, so their components read as optional.
  const view = camera.view as
    | { totalSize: [number, number]; size: [number, number]; offset: Vec2 }
    | undefined;

  if (camera.projection === "orthographic") {
    const dx = (camera.right - camera.left) / (2 / camera.zoom);
    const dy = (camera.top - camera.bottom) / (2 / camera.zoom);
    const cx = (camera.right + camera.left) / 2;
    const cy = (camera.top + camera.bottom) / 2;

    let left = cx - dx;
    let right = cx + dx;
    let top = cy + dy;
    let bottom = cy - dy;

    if (view) {
      const [viewWidth, viewHeight] = view.size;
      const [totalWidth, totalHeight] = view.totalSize;
      const zoomW = 1 / camera.zoom / (viewWidth / totalWidth);
      const zoomH = 1 / camera.zoom / (viewHeight / totalHeight);
      const scaleW = (camera.right - camera.left) / viewWidth;
      const scaleH = (camera.top - camera.bottom) / viewHeight;

      left += scaleW * (view.offset[0]! / zoomW);
      right = left + scaleW * (viewWidth / zoomW);
      top -= scaleH * (view.offset[1]! / zoomH);
      bottom = top - scaleH * (viewHeight / zoomH);
    }

    mat4.orthoZO(
      camera.projectionMatrix,
      left,
      right,
      bottom,
      top,
      camera.near,
      camera.far,
    );
  } else {
    if (view) {
      const [viewWidth, viewHeight] = view.size;
      const [totalWidth, totalHeight] = view.totalSize;
      const [offsetX, offsetY] = view.offset as [number, number];
      const aspectRatio = totalWidth / totalHeight;

      const top = Math.tan(camera.fov * 0.5) * camera.near;
      const bottom = -top;
      const left = aspectRatio * bottom;
      const right = aspectRatio * top;
      const width = Math.abs(right - left);
      const height = Math.abs(top - bottom);
      const widthNormalized = width / totalWidth;
      const heightNormalized = height / totalHeight;

      const l = left + offsetX * widthNormalized;
      const r = left + (offsetX + viewWidth) * widthNormalized;
      const b = top - (offsetY + viewHeight) * heightNormalized;
      const t = top - offsetY * heightNormalized;

      mat4.frustumZO(
        camera.projectionMatrix,
        l,
        r,
        b,
        t,
        camera.near,
        camera.far,
      );
    } else {
      mat4.perspectiveZO(
        camera.projectionMatrix,
        camera.fov,
        camera.aspect,
        camera.near,
        camera.far,
      );
    }
  }

  mat4.set(camera.inverseViewMatrix, transform.modelMatrix);
  //look at matrix is opposite of camera modelMatrix transform
  mat4.set(camera.viewMatrix, transform.modelMatrix);
  mat4.invert(camera.viewMatrix);

  if (camera.culling) computeFrustum(camera);
}

/**
 * Camera system
 *
 * Adds:
 *
 * - "_orbiter" to orbiter components
 * - "_viewProjectionMatrix", "_inverseViewProjectionMatrix",
 *   "_previousViewProjectionMatrix", "_jitter", "_temporalReset" and
 *   "_exposure" to camera components
 */
export default ({ ctx }: SystemOptions) => ({
  type: "camera-system",
  cache: {} as Record<EntityId, CameraCache>,
  debug: false,
  updateCameraProjection,
  updateCameraViewProjection,
  updateCameraJitter,
  updateCameraExposure,
  computeFrustum,
  /**
   * Declare that this camera's next frame does not continue from the last, so
   * anything accumulating across frames throws its history away rather than
   * blending it.
   *
   * What it is for: a cut. Reprojection assumes the previous frame looked at
   * roughly the same thing — it finds where a surface _was_ and reads the
   * colour accumulated there. Teleport the camera and that assumption is gone:
   * the previous view-projection describes somewhere else entirely, so every
   * pixel reads history belonging to an unrelated image. Most of it is caught
   * anyway (the reprojection lands off-screen, or the value is clipped against
   * the neighbourhood), which is why a cut shows as a brief flash rather than a
   * lasting smear — but the frames that survive both tests are wrong, and there
   * is no way to tell from inside the resolve.
   *
   * Explicit rather than inferred from how far the camera moved: that test is
   * wrong in both directions, since a fast pan is not a cut and a slow teleport
   * is. Call it wherever the camera is repositioned — a scene load, a jump to a
   * bookmarked view, switching between cameras that share a target.
   */
  resetTemporal(cameraEntity: Entity) {
    temporalResets.add(cameraEntity);
  },
  checkCamera(_: unknown, cameraEntity: Entity) {
    if (cameraEntity.transform) {
      return true;
    } else {
      console.warn(
        NAMESPACE,
        this.type,
        `camera entity missing transform. Add a transformSystem.update(entities).`,
      );
    }
  },
  updateCameraFoV(entity: Entity) {
    const camera = resolvedCamera(entity);
    const cached = this.cache[entity.id]!;

    const [sensorWidth, sensorHeightDefault] = camera.sensorSize as [
      number,
      number,
    ];
    let sensorHeight = sensorHeightDefault;
    const sensorAspectRatio = sensorWidth / sensorHeight;
    if (camera.aspect > sensorAspectRatio) {
      if (camera.sensorFit === "horizontal" || camera.sensorFit === "fill") {
        sensorHeight = sensorWidth / camera.aspect;
      }
    } else {
      if (
        camera.sensorFit === "horizontal" ||
        camera.sensorFit === "overscan"
      ) {
        sensorHeight = sensorWidth / camera.aspect;
      }
    }
    camera.actualSensorHeight = sensorHeight;

    if (cached.fov !== camera.fov) {
      camera.focalLength = sensorHeight / 2 / Math.tan(camera.fov / 2);
      cached.fov = camera.fov;
      cached.focalLength = camera.focalLength;
    } else if (cached.focalLength !== camera.focalLength) {
      camera.fov = 2 * Math.atan(sensorHeight / 2 / camera.focalLength);
      cached.fov = camera.fov;
      cached.focalLength = camera.focalLength;
    }
  },
  updateCameraEntity(entity: Entity) {
    const orbiter = entity.orbiter;
    const camera = resolvedCamera(entity);
    const transform = entity.transform!;

    // Add to cache and reset cache if camera component is different
    if (this.cache[entity.id]?.camera !== camera) {
      this.cache[entity.id] = { camera };
    }
    this.updateCameraFoV(entity);

    if (orbiter) {
      if (orbiter._orbiter) {
        if (camera.dirty) {
          camera.dirty = false;

          updateCameraProjection(camera, entity._transform!);
        }

        let newPosition = null;
        let newTarget = null;

        // check if camera moved without _orbiter intervention
        if (
          vec3.distance(orbiter._orbiter.camera.position, transform.position!) >
          utils.EPSILON
        ) {
          newPosition = [...transform.position!];
        }

        //check if camera rotated without orbiter intervention
        if (
          vec3.distance(
            orbiter._orbiter.camera.rotationCache,
            transform.rotation!,
          ) > utils.EPSILON
        ) {
          // console.log("sync with camera rotation");
          newTarget = [0, 0, -orbiter._orbiter.distance];
          const useInvMatrix = false;
          if (useInvMatrix) {
            vec3.multMat4(newTarget, camera.inverseViewMatrix); //this is out of date?
          } else {
            vec3.multQuat(newTarget, transform.rotation!);
            vec3.add(newTarget, transform.position!);
          }
        }

        // check if camera orbiter moved without _orbiter intervention
        if (
          vec3.distance(orbiter.target!, orbiter._orbiter.camera.target) >
          utils.EPSILON
        ) {
          newTarget = orbiter.target!;
          // console.log("sync with orbiter target");
        }

        if (newPosition || newTarget) {
          const opts: { position?: Vec3; target?: Vec3 } = {};
          if (newPosition) {
            opts.position = [...newPosition];
          }
          if (newTarget) {
            opts.target = [...newTarget];
          }
          orbiter._orbiter.camera.set(opts);
          orbiter._orbiter.set({
            camera: orbiter._orbiter.camera,
          });
        } else {
          // added cached properties to know if distance,lon,lat changed externally
          // and if they haven't give a chance to _orbiter.updateCamera() to update them
          // comparing orbiter.distance to orbiter._orbiter.distance would always overwrite orbiter
          if (orbiter.distance !== orbiter._orbiter.distanceCache) {
            orbiter._orbiter.distanceCache = orbiter.distance;
            orbiter._orbiter.set({ distance: orbiter.distance });
          }
          if (orbiter.lon !== orbiter._orbiter.lonCache) {
            orbiter._orbiter.lonCache = orbiter.lon;
            orbiter._orbiter.set({ lon: orbiter.lon });
          }
          if (orbiter.lat !== orbiter._orbiter.latCache) {
            orbiter._orbiter.latCache = orbiter.lat;
            orbiter._orbiter.set({ lat: orbiter.lat });
          }
        }

        orbiter._orbiter.updateCamera();

        mat4.identity(camera.inverseViewMatrix);
        mat4.translate(camera.inverseViewMatrix, transform.position!);
        mat4.mult(
          camera.inverseViewMatrix,
          mat4.fromQuat(TEMP_MAT4, transform.rotation!),
        );
        mat4.set(camera.viewMatrix, camera.inverseViewMatrix);
        mat4.invert(camera.viewMatrix);
      } else {
        updateCameraProjection(camera, entity._transform!);

        // pex-cam drives this stand-in for its own camera class, so it carries
        // only what the orbiter reads and writes back through `set`.
        const proxyCamera = {
          viewMatrix: camera.viewMatrix,
          inverseViewMatrix: camera.inverseViewMatrix,
          // pex-cam's orbiter reads the inverse-view matrix under this name when panning
          invViewMatrix: camera.inverseViewMatrix,
          position: [...transform.position!],
          rotationCache: [...transform.rotation!],
          target: [...orbiter.target!],
          up: [0, 1, 0],
          zoom: camera.zoom,
          getViewRay: (
            x: number,
            y: number,
            windowWidth: number,
            windowHeight: number,
          ) => {
            let nx = (2 * x) / windowWidth - 1;
            let ny = 1 - (2 * y) / windowHeight;
            const hNear = 2 * Math.tan(camera.fov / 2) * camera.near;
            const wNear = hNear * camera.aspect;
            nx *= wNear * 0.5;
            ny *= hNear * 0.5; // [origin, direction]

            return [[0, 0, 0], vec3.normalize([nx, ny, -camera.near])];
          },
          set({ target, position, zoom }: OrbiterCameraSet) {
            if (zoom) {
              camera.zoom = zoom;
              return;
            }

            if (target) {
              vec3.set(orbiter._orbiter.camera.target, target);
              vec3.set(orbiter.target!, target);
            }

            if (position) {
              vec3.set(orbiter._orbiter.camera.position, position);
              vec3.set(transform.position!, position);
            }

            mat4.lookAt(
              TEMP_MAT4,
              orbiter._orbiter.camera.position,
              orbiter._orbiter.camera.target,
              orbiter._orbiter.camera.up,
            );
            mat4.invert(TEMP_MAT4);
            quat.fromMat4(transform.rotation!, TEMP_MAT4);
            quat.set(
              orbiter._orbiter.camera.rotationCache,
              transform.rotation!,
            );

            orbiter.lat = orbiter._orbiter.lat;
            orbiter.lon = orbiter._orbiter.lon;
            orbiter.distance = orbiter._orbiter.distance;
            // TODO: need to check lat/lon/dist change?
            transform.dirty = true;
            camera.dirty = true;
          },
        };
        orbiter._orbiter = createOrbiter({
          element: orbiter.element || document.body, //TODO: element used to default to ctx.gl.canvas
          autoUpdate: false,
          camera: proxyCamera,
          position: proxyCamera.position,
          maxDistance: camera.far * 0.9,
        } as unknown as Parameters<typeof createOrbiter>[0]);
        orbiter._orbiter.updateCamera();
        orbiter.distance = orbiter._orbiter.distance;
        orbiter.lat = orbiter._orbiter.lat;
        orbiter.lon = orbiter._orbiter.lon;
        orbiter._orbiter.distanceCache = orbiter._orbiter.distance;
        orbiter._orbiter.latCache = orbiter._orbiter.lat;
        orbiter._orbiter.lonCache = orbiter._orbiter.lon;
      }
    } else {
      // Camera manually updated or animation
      if (camera.dirty) {
        camera.dirty = false;

        updateCameraProjection(camera, entity._transform!);
      }
    }
  },
  update(entities: Entity[], { frameIndex = 0 }: SystemUpdateOptions = {}) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;

      if (entity.camera) {
        if (!this.checkCamera(null, entity)) continue;
        const camera = resolvedCamera(entity);
        this.updateCameraEntity(entity);
        updateCameraExposure(camera);
        // Exactly one frame, and cleared whether or not anything reads it.
        // Resolved first: the view-projection pair is derived from it.
        camera._temporalReset = temporalResets.delete(entity);
        // After updateCameraEntity, not inside: every branch of it leaves the
        // view and projection matrices final, and only some recompute one.
        updateCameraViewProjection(camera);
        updateCameraJitter(
          entity,
          frameIndex,
          entity.camera.viewport || getDefaultViewport(ctx),
        );
      }
    }
  },
});
