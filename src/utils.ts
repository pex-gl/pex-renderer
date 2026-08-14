import { aabb } from "pex-geom";
import { mat2x3, mat3, mat4, quat, vec3, vec4 } from "pex-math";

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

// Environment maps (equirect skybox, prefiltered specular cubemap, SH
// coefficients) are baked in the probe/skybox entity's unrotated local
// space, so sampling them with a world-space direction after the entity is
// rotated by R needs the inverse: R⁻¹ = Rᵀ for a pure rotation matrix. Shared
// by systems/reflection-probe.ts (IBL) and systems/renderer/skybox.ts
// (background) so both read the same entity transform the same way.
const getEnvironmentRotation = (out: Mat3, modelMatrix: Mat4 | undefined) =>
  modelMatrix ? mat3.transpose(mat3.fromMat4(out, modelMatrix)) : undefined;

export {
  NAMESPACE,
  TEMP_VEC3,
  TEMP_VEC4,
  TEMP_QUAT,
  TEMP_MAT4,
  TEMP_MAT3,
  TEMP_AABB,
  TEMP_MAT2X3,
  Y_UP,
  TEMP_BOUNDS_POINTS,
  quad,
  fullscreenTriangle,
  CUBEMAP_PROJECTION_MATRIX,
  CUBEMAP_SIDES,
  getCubeFaceCamera,
  getDefaultViewport,
  getFileExtension,
  getDirname,
  isObject,
  getEnvironmentRotation,
};
