//TODO: MARCIN: I would break this down into separate files utils/program-cache.js, utils/temp-data.js etc

import { aabb } from "pex-geom";
import { mat2x3, mat4, quat, vec3, vec4 } from "pex-math";

const NAMESPACE = "pex-renderer";

const TEMP_VEC3 = vec3.create();
const TEMP_VEC4 = vec4.create();
const TEMP_QUAT = quat.create();
const TEMP_MAT4 = mat4.create();
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
}

const CUBEMAP_PROJECTION_MATRIX = Object.freeze(
  mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 100),
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

const getDefaultViewport = (ctx) => [
  0,
  0,
  ctx.gl.drawingBufferWidth,
  ctx.gl.drawingBufferHeight,
];

const getFileExtension = (path) => {
  return (path?.match(/[^\\/]\.([^.\\/]+)$/) || [null]).pop();
};

const getDirname = (path) => {
  var code = path.charCodeAt(0);
  var hasRoot = code === 47;
  var end = -1;
  let matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
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

export {
  NAMESPACE,
  TEMP_VEC3,
  TEMP_VEC4,
  TEMP_QUAT,
  TEMP_MAT4,
  TEMP_AABB,
  TEMP_MAT2X3,
  Y_UP,
  TEMP_BOUNDS_POINTS,
  quad,
  fullscreenTriangle,
  CUBEMAP_PROJECTION_MATRIX,
  CUBEMAP_SIDES,
  getDefaultViewport,
  getFileExtension,
  getDirname,
};
