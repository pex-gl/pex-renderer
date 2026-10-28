import { mat4 } from "pex-math";
import { lens, projection } from "cameras";
import halton from "halton";
import {
  NAMESPACE,
  computeFrustumPlanes,
  getDefaultViewport,
} from "../utils.js";

import type { FrustumBounds } from "cameras";
import type {
  CameraComponentOptions,
  Entity,
  SystemOptions,
  SystemUpdateOptions,
  Viewport,
} from "../types.js";

/**
 * A camera after the component has applied its defaults. The math below reads
 * these fields directly rather than re-checking each one.
 */
type ResolvedCamera = CameraComponentOptions &
  Required<
    Pick<
      CameraComponentOptions,
      | "projection"
      | "near"
      | "far"
      | "aspect"
      | "zoom"
      | "fov"
      | "size"
      | "fStop"
      | "shutterSpeed"
      | "iso"
      | "sensorSize"
      | "sensorFit"
      | "projectionMatrix"
      | "viewMatrix"
      | "inverseViewMatrix"
      | "frustum"
    >
  >;

const resolvedCamera = (entity: Entity) => entity.camera as ResolvedCamera;

// WebGPU clip space. Jitter is not part of the projection but a shader uniform,
// so `projectionMatrix` stays unjittered for view position reconstruction.
const DEPTH = { depthRange: "zero-to-one", reversedZ: false } as const;
const TEMP_BOUNDS: FrustumBounds = [0, 0, 0, 0];

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
 *
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
  camera._exposure = lens.exposureFromEV100(
    lens.ev100(camera.fStop, camera.shutterSpeed, camera.iso) -
      (camera.exposureCompensation ?? 0),
  );
}

/**
 * Aspect, field of view and the sensor height and focal length depth of field
 * reads, after `sensorFit` and zoom.
 *
 * A view renders a part of a larger frame, so the lens frames the whole of it.
 */
function updateCameraLens(camera: ResolvedCamera, viewport: Viewport) {
  const [width, height] = camera.view?.totalSize ?? [viewport[2], viewport[3]];
  camera.aspect = width / height;

  camera._sensorHeight = lens.fittedSensorHeight(
    camera.sensorSize,
    camera.aspect,
    camera.sensorFit,
  );
  if (camera.focalLength !== undefined) {
    camera.fov = lens.fovFromFocalLength(
      camera.focalLength,
      camera._sensorHeight,
    );
  }
  camera._focalLength =
    lens.focalLengthFromFov(camera.fov, camera._sensorHeight) * camera.zoom;
}

function updateCameraProjection(camera: ResolvedCamera) {
  const orthographic = camera.projection === "orthographic";

  const bounds = orthographic
    ? camera.bounds
      ? projection.zoomBounds(TEMP_BOUNDS, camera.bounds, camera.zoom)
      : projection.orthographicBounds(
          TEMP_BOUNDS,
          camera.size,
          camera.aspect,
          camera.zoom,
        )
    : projection.perspectiveBounds(
        TEMP_BOUNDS,
        camera.fov,
        camera.aspect,
        camera.near,
        camera.zoom,
      );
  if (camera.view) projection.applyViewOffset(bounds, camera.view);

  (orthographic ? projection.orthographic : projection.frustum)(
    camera.projectionMatrix,
    bounds,
    camera.near,
    camera.far,
    DEPTH,
  );

  // Unprojects depth whatever the projection, zoom or view offset.
  mat4.invert(
    mat4.set(
      (camera._inverseProjectionMatrix ??= mat4.create()),
      camera.projectionMatrix,
    ),
  );
}

/** World transform, so a camera parented to another entity follows it. */
function updateCameraView(camera: ResolvedCamera, entity: Entity) {
  mat4.set(camera.inverseViewMatrix, entity._transform!.modelMatrix);
  mat4.set(camera.viewMatrix, camera.inverseViewMatrix);
  mat4.invert(camera.viewMatrix);
}

/**
 * Camera system
 *
 * Adds:
 *
 * - "aspect", "projectionMatrix", "viewMatrix", "inverseViewMatrix" and
 *   "frustum" to camera components
 * - "_sensorHeight", "_focalLength", "_inverseProjectionMatrix",
 *   "_viewProjectionMatrix",
 *   "_inverseViewProjectionMatrix", "_previousViewProjectionMatrix",
 *   "_jitter", "_temporalReset" and "_exposure" to camera components
 */
export default ({ ctx }: SystemOptions) => ({
  type: "camera-system",
  debug: false,
  updateCameraLens,
  updateCameraProjection,
  updateCameraView,
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
    if (cameraEntity._transform) {
      return true;
    } else {
      console.warn(
        NAMESPACE,
        this.type,
        `camera entity missing transform. Add a transformSystem.update(entities).`,
      );
    }
  },
  update(entities: Entity[], { frameIndex = 0 }: SystemUpdateOptions = {}) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;

      if (entity.camera) {
        if (!this.checkCamera(null, entity)) continue;
        const camera = resolvedCamera(entity);
        const viewport = camera.viewport || getDefaultViewport(ctx);

        updateCameraLens(camera, viewport);
        updateCameraProjection(camera);
        updateCameraView(camera, entity);
        if (camera.culling) computeFrustum(camera);
        updateCameraExposure(camera);
        // Exactly one frame, and cleared whether or not anything reads it.
        // Resolved first: the view-projection pair is derived from it.
        camera._temporalReset = temporalResets.delete(entity);
        updateCameraViewProjection(camera);
        updateCameraJitter(entity, frameIndex, viewport);
      }
    }
  },
});
