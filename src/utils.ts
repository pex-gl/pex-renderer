import { aabb } from "pex-geom";
import { avec4, mat2x3, mat3, mat4, quat, vec3, vec4 } from "pex-math";

import type { Mat3, Mat4, Vec3 } from "pex-math";
import type { GpuContext } from "./types.js";

const NAMESPACE = "pex-renderer";

const TEMP_VEC3 = vec3.create();
const TEMP_VEC4 = vec4.create();
const TEMP_QUAT = quat.create();
const TEMP_MAT4 = mat4.create();
const TEMP_MAT3 = mat3.create();
const TEMP_AABB = aabb.create();
const TEMP_MAT2X3 = mat2x3.create();
const Y_UP = Object.freeze([0, 1, 0]);
const TEMP_BOUNDS_POINTS = Array.from({ length: 8 }, () => vec3.create());
// Six planes of (nx, ny, nz, d). Callers that keep a frustum around own their
// own array; this is for one-shot tests.
const TEMP_FRUSTUM = new Float32Array(24);

// prettier-ignore
const quad = {
  positions:  Float32Array.of(
    -1, -1,
    1, -1,
    1, 1,
    -1, 1,
  ),
  uvs: Uint16Array.of(
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ),
  cells: Uint16Array.of(
    0, 1, 2,
    2, 3, 0
  ),
};

// prettier-ignore
const fullscreenTriangle = {
  positions: Float32Array.of(
    -1, -1,
    3, -1,
    -1, 3,
  ),
};

const CUBEMAP_PROJECTION_MATRIX = Object.freeze(
  mat4.perspectiveZO(mat4.create(), Math.PI / 2, 1, 0.1, 100),
);

// prettier-ignore
const CUBEMAP_SIDES = [
  { eye: [0, 0, 0], target: [1, 0, 0], up: [0, -1, 0], color: [1, 0, 0, 1], projectionMatrix: CUBEMAP_PROJECTION_MATRIX },
  { eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0], color: [0.5, 0, 0, 1], projectionMatrix: CUBEMAP_PROJECTION_MATRIX },
  { eye: [0, 0, 0], target: [0, 1, 0], up: [0, 0, 1], color: [0, 1, 0, 1], projectionMatrix: CUBEMAP_PROJECTION_MATRIX },
  { eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1], color: [0, 0.5, 0, 1], projectionMatrix: CUBEMAP_PROJECTION_MATRIX },
  { eye: [0, 0, 0], target: [0, 0, 1], up: [0, -1, 0], color: [0, 0, 1, 1], projectionMatrix: CUBEMAP_PROJECTION_MATRIX },
  { eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0], color: [0, 0, 0.5, 1], projectionMatrix: CUBEMAP_PROJECTION_MATRIX },
];

// View + projection for rendering into cube face `face` from `position`. `face`
// is 0..5 in CUBEMAP_SIDES order (+X, -X, +Y, -Y, +Z, -Z), matching WebGPU cube
// array-layer order.
//
// The projection Y is flipped: WebGPU's top-left texture origin is opposite the
// depth-cube sampler's top-down t axis, and a cube is addressed by direction so
// it can't be corrected at sample time the way a 2D map is (v = 0.5 - ndc.y*0.5).
// This is a pure t flip — s stays correct, unlike negating the view up vectors.
// It reverses winding, so cube passes must disable culling.
//
// WebGPU has no negative-viewport equivalent (unlike Vulkan), so this lives here
// rather than in the GPU wrapper. Shared by all render-to-cube paths.
const getCubeFaceCamera = (
  face: number,
  position: Vec3,
  near: number,
  far: number,
  viewMatrix: Mat4 = mat4.create(),
  projectionMatrix: Mat4 = mat4.create(),
) => {
  const { target, up } = CUBEMAP_SIDES[face]!;

  mat4.lookAt(
    viewMatrix,
    position,
    vec3.add(vec3.set(TEMP_VEC3, target), position),
    up,
  );

  mat4.perspectiveZO(projectionMatrix, Math.PI / 2, 1, near, far);
  projectionMatrix[5]! *= -1;

  return { viewMatrix, projectionMatrix };
};

const getDefaultViewport = (ctx: GpuContext) => [0, 0, ctx.width, ctx.height];

const getFileExtension = (path?: string) => {
  return (path?.match(/[^\\/]\.([^.\\/]+)$/) || [null]).pop();
};

const getDirname = (path: string) => {
  let code = path.charCodeAt(0);
  const hasRoot = code === 47;
  let end = -1;
  let matchedSlash = true;
  for (let i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? "/" : ".";
  if (hasRoot && end === 1) return "//";
  return path.slice(0, end);
};

const isObject = (obj: unknown) =>
  Object.prototype.toString.call(obj) === "[object Object]";

/** Maps each value of a plain object through `fn`, keeping the same keys. */
const mapValues = <T, R>(
  obj: Record<string, T>,
  fn: (value: T, key: string, index: number) => R,
): Record<string, R> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value], i): [string, R] => [
      key,
      fn(value, key, i),
    ]),
  );

/** Maps each key of a plain object through `fn`, keeping the same values. */
const mapKeys = <T>(
  obj: Record<string, T>,
  fn: (key: string, value: T, index: number) => string,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value], i): [string, T] => [
      fn(key, value, i),
      value,
    ]),
  );

// Environment maps (equirect skybox, prefiltered specular cubemap, SH
// coefficients) are baked in the probe/skybox entity's unrotated local
// space, so sampling them with a world-space direction after the entity is
// rotated by R needs the inverse: R⁻¹ = Rᵀ for a pure rotation matrix. Shared
// by systems/reflection-probe.ts (IBL) and systems/renderer/skybox.ts
// (background) so both read the same entity transform the same way.
const getEnvironmentRotation = (out: Mat3, modelMatrix: Mat4 | undefined) =>
  modelMatrix ? mat3.transpose(mat3.fromMat4(out, modelMatrix)) : undefined;

/**
 * Gribb/Hartmann plane extraction from a view-projection, normalized so plane
 * distances are metric. Order: -x, +x, +y, -y, far, near.
 */
const computeFrustumPlanes = (
  out: any,
  projectionMatrix: Mat4,
  viewMatrix: Mat4,
) => {
  mat4.set(TEMP_MAT4, projectionMatrix);
  mat4.mult(TEMP_MAT4, viewMatrix);
  const m: any = TEMP_MAT4;

  // The near plane is the only one that depends on the depth convention: WebGPU
  // clips 0 <= z (as D3D does), not -w <= z, so it is the third row alone rather
  // than w + z. Every projection here is a *ZO variant. Gribb/Hartmann 2001, §2.
  // prettier-ignore
  {
    avec4.set4(out, 0, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12])
    avec4.set4(out, 1, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12])
    avec4.set4(out, 2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13])
    avec4.set4(out, 3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13])
    avec4.set4(out, 4, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14])
    avec4.set4(out, 5, m[2], m[6], m[10], m[14])
  }

  for (let i = 0; i < 6; i++) {
    TEMP_VEC3[0] = out[i * 4]!;
    TEMP_VEC3[1] = out[i * 4 + 1]!;
    TEMP_VEC3[2] = out[i * 4 + 2]!;
    avec4.scale(out, i, 1 / vec3.length(TEMP_VEC3));
  }
  return out;
};

/** Conservative AABB test against a frustum: false only if fully outside. */
const isAABBInFrustum = (worldBounds: any, frustum: any) => {
  const v: any = TEMP_VEC4;
  for (let i = 0; i < 6; i++) {
    avec4.set(TEMP_VEC4 as any, 0, frustum, i);
    // Positive vertex: the corner furthest along the plane normal.
    TEMP_VEC3[0] = v[0] >= 0 ? worldBounds[1][0] : worldBounds[0][0];
    TEMP_VEC3[1] = v[1] >= 0 ? worldBounds[1][1] : worldBounds[0][1];
    TEMP_VEC3[2] = v[2] >= 0 ? worldBounds[1][2] : worldBounds[0][2];
    if (vec3.dot(TEMP_VEC4, TEMP_VEC3) + v[3] < 0) return false;
  }
  return true;
};

// Photometric conversions between the units lights are authored in and the
// units the shaders integrate. The shaders take what the rendering equation
// needs — `intensity * attenuation` is the illuminance reaching the surface —
// so punctual lights arrive as luminous intensity (cd) and area lights as the
// luminance (cd/m²) of their emitting surface. systems/light.ts applies these
// once per frame; nothing downstream sees lumens.
const FOUR_PI = 4 * Math.PI;
const TWO_PI = 2 * Math.PI;

/** Luminous power (lm) of an isotropic point source to luminous intensity (cd). */
const pointPowerToIntensity = (luminousPower: number): number =>
  luminousPower / FOUR_PI;

/** Luminous intensity (cd) of an isotropic point source to luminous power (lm). */
const pointIntensityToPower = (luminousIntensity: number): number =>
  luminousIntensity * FOUR_PI;

/**
 * Luminous power (lm) of a spot light to its axial luminous intensity (cd).
 *
 * `focused` couples the beam to the cone: the same power concentrated into a
 * narrower cone burns brighter, which is what a real fixture does and what
 * `KHR_lights_punctual` describes. Left off, power spreads over a hemisphere
 * (Φ = πI) and narrowing the cone only makes the pool smaller.
 *
 * `angle` is the outer cone half-angle, in radians.
 */
const spotPowerToIntensity = (
  luminousPower: number,
  angle: number,
  focused?: boolean,
): number =>
  focused
    ? luminousPower / (TWO_PI * (1 - Math.cos(angle)))
    : luminousPower / Math.PI;

/** Axial luminous intensity (cd) of a spot light to luminous power (lm). */
const spotIntensityToPower = (
  luminousIntensity: number,
  angle: number,
  focused?: boolean,
): number =>
  focused
    ? luminousIntensity * TWO_PI * (1 - Math.cos(angle))
    : luminousIntensity * Math.PI;

/**
 * Luminous power (lm) of a Lambertian emitter to its luminance (cd/m²), the
 * unit the linearly transformed cosines integrate against.
 *
 * `width` and `height` are the light's world-space extent — the transform's x
 * and y scale — so a disk is the ellipse they bound. A double-sided emitter
 * spreads the same power over both faces.
 */
const areaPowerToLuminance = (
  luminousPower: number,
  width: number,
  height: number,
  disk?: boolean,
  doubleSided?: boolean,
): number => {
  const area = disk ? (Math.PI * width * height) / 4 : width * height;
  return area > 0 ? luminousPower / (Math.PI * area * (doubleSided ? 2 : 1)) : 0;
};

/**
 * Exposure value at ISO 100 for a set of camera settings — the photographic
 * scale where each stop doubles the light reaching the sensor.
 *
 * `shutterSpeed` is in seconds (1/125, not 125).
 */
const ev100 = (fStop: number, shutterSpeed: number, iso: number): number =>
  Math.log2(((fStop * fStop) / shutterSpeed) * (100 / iso));

/**
 * Scale factor taking scene luminance (cd/m²) to a sensor-referred value.
 *
 * The 1.2 is the standard reflected-light meter calibration constant, so a
 * surface of 18% reflectance under an exposure metered for it lands at middle
 * grey rather than at 1.0.
 */
const exposureFromEV100 = (ev100: number): number => 1 / (1.2 * 2 ** ev100);

/**
 * Stable cache key for a set of shader defines — the feature set a shader
 * variant was generated from.
 *
 * Sorted because a Set iterates in insertion order: the same features gathered
 * in a different order must land on the same variant, or the cache grows a
 * duplicate entry and the shader is compiled twice. "|" separates because it
 * cannot appear in a define name.
 */
const definesKey = (defines: Iterable<string>) => [...defines].sort().join("|");

export {
  NAMESPACE,
  definesKey,
  TEMP_VEC3,
  TEMP_VEC4,
  TEMP_QUAT,
  TEMP_MAT4,
  TEMP_MAT3,
  TEMP_AABB,
  TEMP_MAT2X3,
  Y_UP,
  TEMP_BOUNDS_POINTS,
  TEMP_FRUSTUM,
  computeFrustumPlanes,
  isAABBInFrustum,
  quad,
  fullscreenTriangle,
  CUBEMAP_PROJECTION_MATRIX,
  CUBEMAP_SIDES,
  getCubeFaceCamera,
  getDefaultViewport,
  getFileExtension,
  getDirname,
  isObject,
  mapValues,
  mapKeys,
  getEnvironmentRotation,
  pointPowerToIntensity,
  pointIntensityToPower,
  spotPowerToIntensity,
  spotIntensityToPower,
  areaPowerToLuminance,
  ev100,
  exposureFromEV100,
};
