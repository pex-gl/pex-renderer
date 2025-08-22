import { d as create } from './vec3-iMfOIZBS.js';

const TEMP_VEC3 = create();
/**
 * Sets a vector components.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */ function set3(a, i, x, y, z) {
    a[i * 3] = x;
    a[i * 3 + 1] = y;
    a[i * 3 + 2] = z;
}
/**
 * Sets a vector to another vector.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 */ function set(a, i, b, j) {
    a[i * 3] = b[j * 3];
    a[i * 3 + 1] = b[j * 3 + 1];
    a[i * 3 + 2] = b[j * 3 + 2];
}
/**
 * Compares two vectors.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 * @returns {boolean}
 */ function equals(a, i, b, j) {
    return a[i * 3] === b[j * 3] && a[i * 3 + 1] === b[j * 3 + 1] && a[i * 3 + 2] === b[j * 3 + 2];
}
/**
 * Adds a vector to another.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 */ function add(a, i, b, j) {
    a[i * 3] += b[j * 3];
    a[i * 3 + 1] += b[j * 3 + 1];
    a[i * 3 + 2] += b[j * 3 + 2];
}
/**
 * Subtracts a vector from another.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 */ function sub(a, i, b, j) {
    a[i * 3] -= b[j * 3];
    a[i * 3 + 1] -= b[j * 3 + 1];
    a[i * 3 + 2] -= b[j * 3 + 2];
}
/**
 * Scales a vector by a number.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {number} s
 */ function scale(a, i, s) {
    a[i * 3] *= s;
    a[i * 3 + 1] *= s;
    a[i * 3 + 2] *= s;
}
/**
 * Adds two vectors after scaling the second one.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 * @param {number} s
 */ function addScaled(a, i, b, j, s) {
    a[i * 3] += b[j * 3] * s;
    a[i * 3 + 1] += b[j * 3 + 1] * s;
    a[i * 3 + 2] += b[j * 3 + 2] * s;
}
/**
 * Multiplies a vector by a matrix.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").amat4} m
 * @param {number} j
 */ function multMat4(a, i, m, j) {
    const x = a[i * 3];
    const y = a[i * 3 + 1];
    const z = a[i * 3 + 2];
    a[i * 3] = m[j * 16] * x + m[j * 16 + 4] * y + m[j * 16 + 8] * z + m[j * 16 + 12];
    a[i * 3 + 1] = m[j * 16 + 1] * x + m[j * 16 + 5] * y + m[j * 16 + 9] * z + m[j * 16 + 13];
    a[i * 3 + 2] = m[j * 16 + 2] * x + m[j * 16 + 6] * y + m[j * 16 + 10] * z + m[j * 16 + 14];
}
/**
 * Multiplies a vector by a quaternion.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").aquat} q
 * @param {number} j
 */ function multQuat(a, i, q, j) {
    const x = a[i * 3];
    const y = a[i * 3 + 1];
    const z = a[i * 3 + 2];
    const qx = q[j * 4];
    const qy = q[j * 4 + 1];
    const qz = q[j * 4 + 2];
    const qw = q[j * 4 + 3];
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    a[i * 3] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    a[i * 3 + 1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    a[i * 3 + 2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
}
/**
 * Calculates the dot product of two vectors.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 * @returns {number}
 */ function dot(a, i, b, j) {
    return a[i * 3] * b[j * 3] + a[i * 3 + 1] * b[j * 3 + 1] + a[i * 3 + 2] * b[j * 3 + 2];
}
/**
 * Calculates the cross product of two vectors.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 */ function cross(a, i, b, j) {
    const x = a[i * 3];
    const y = a[i * 3 + 1];
    const z = a[i * 3 + 2];
    const vx = b[j * 3];
    const vy = b[j * 3 + 1];
    const vz = b[j * 3 + 2];
    a[i * 3] = y * vz - vy * z;
    a[i * 3 + 1] = z * vx - vz * x;
    a[i * 3 + 2] = x * vy - vx * y;
}
/**
 * Calculates the length of a vector.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @returns {number}
 */ function length(a, i) {
    const x = a[i * 3];
    const y = a[i * 3 + 1];
    const z = a[i * 3 + 2];
    return Math.sqrt(x * x + y * y + z * z);
}
/**
 * Calculates the squared length of a vector.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @returns {number}
 */ function lengthSq(a, i) {
    const x = a[i * 3];
    const y = a[i * 3 + 1];
    const z = a[i * 3 + 2];
    return x * x + y * y + z * z;
}
/**
 * Normalises a vector.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 */ function normalize(a, i) {
    const lenSq = a[i * 3] * a[i * 3] + a[i * 3 + 1] * a[i * 3 + 1] + a[i * 3 + 2] * a[i * 3 + 2];
    if (lenSq > 0) {
        const len = Math.sqrt(lenSq);
        a[i * 3] /= len;
        a[i * 3 + 1] /= len;
        a[i * 3 + 2] /= len;
    }
}
/**
 * Calculates the distance between two vectors.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 * @returns {number}
 */ function distance(a, i, b, j) {
    const dx = b[j * 3] - a[i * 3];
    const dy = b[j * 3 + 1] - a[i * 3 + 1];
    const dz = b[j * 3 + 2] - a[i * 3 + 2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
/**
 * Calculates the squared distance between two vectors.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 * @returns {number}
 */ function distanceSq(a, i, b, j) {
    const dx = b[j * 3] - a[i * 3];
    const dy = b[j * 3 + 1] - a[i * 3 + 1];
    const dz = b[j * 3 + 2] - a[i * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
}
/**
 * Limits a vector to a length.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {number} len
 */ function limit(a, i, len) {
    const x = a[i * 3];
    const y = a[i * 3 + 1];
    const z = a[i * 3 + 2];
    const dsq = x * x + y * y + z * z;
    const lsq = len * len;
    if (lsq > 0 && dsq > lsq) {
        const nd = len / Math.sqrt(dsq);
        a[i * 3] *= nd;
        a[i * 3 + 1] *= nd;
        a[i * 3 + 2] *= nd;
    }
}
/**
 * Linearly interpolates between two vectors.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {import("./types.js").avec3} b
 * @param {number} j
 * @param {number} t
 */ function lerp(a, i, b, j, t) {
    const x = a[i * 3];
    const y = a[i * 3 + 1];
    const z = a[i * 3 + 2];
    a[i * 3] = x + (b[j * 3] - x) * t;
    a[i * 3 + 1] = y + (b[j * 3 + 1] - y) * t;
    a[i * 3 + 2] = z + (b[j * 3 + 2] - z) * t;
}
/**
 * Executes a function once for each array element.
 * @param {import("./types.js").avec3} a
 * @param {import("./types.js").iterativeCallback} callbackFn
 */ function forEach(a, callbackFn) {
    for(let i = 0; i < a.length / 3; i++){
        TEMP_VEC3[0] = a[i * 3];
        TEMP_VEC3[1] = a[i * 3 + 1];
        TEMP_VEC3[2] = a[i * 3 + 2];
        callbackFn(TEMP_VEC3, i, a);
        a[i * 3] = TEMP_VEC3[0];
        a[i * 3 + 1] = TEMP_VEC3[1];
        a[i * 3 + 2] = TEMP_VEC3[2];
    }
}
/**
 * Creates a new array populated with the results of calling a provided function on every element in the calling array.
 * @param {import("./types.js").avec3} a
 * @param {import("./types.js").iterativeCallback} callbackFn
 * @returns {import("./types.js").avec3}
 */ function map(a, callbackFn) {
    const b = new a.constructor(a.length);
    const element = new a.constructor(3);
    for(let i = 0; i < a.length / 3; i++){
        element[0] = a[i * 3];
        element[1] = a[i * 3 + 1];
        element[2] = a[i * 3 + 2];
        const returnValue = callbackFn(element, i, a);
        b[i * 3] = returnValue[0];
        b[i * 3 + 1] = returnValue[1];
        b[i * 3 + 2] = returnValue[2];
    }
    return b;
}
/**
 * Prints a vector to a string.
 * @param {import("./types.js").avec3} a
 * @param {number} i
 * @param {number} [precision=4]
 * @returns {string}
 */ function toString(a, i, precision = 4) {
    const scale = 10 ** precision;
    // prettier-ignore
    return `[${Math.floor(a[i * 3] * scale) / scale}, ${Math.floor(a[i * 3 + 1] * scale) / scale}, ${Math.floor(a[i * 3 + 2] * scale) / scale}]`;
}

var avec3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  add: add,
  addScaled: addScaled,
  cross: cross,
  distance: distance,
  distanceSq: distanceSq,
  dot: dot,
  equals: equals,
  forEach: forEach,
  length: length,
  lengthSq: lengthSq,
  lerp: lerp,
  limit: limit,
  map: map,
  multMat4: multMat4,
  multQuat: multQuat,
  normalize: normalize,
  scale: scale,
  set: set,
  set3: set3,
  sub: sub,
  toString: toString
});

export { scale as a, add as b, set3 as c, avec3 as d, sub as s };
