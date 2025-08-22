/** @module vec3 */ /**
 * Returns a new vec3 at 0, 0, 0.
 * @returns {import("./types.js").vec3}
 */ function create() {
    return [
        0,
        0,
        0
    ];
}
/**
 * Returns a copy of a vector.
 * @param {import("./types.js").vec3} a
 * @returns {import("./types.js").vec3}
 */ function copy(a) {
    return a.slice();
}
/**
 * Sets a vector to another vector.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {import("./types.js").vec3}
 */ function set(a, b) {
    a[0] = b[0];
    a[1] = b[1];
    a[2] = b[2];
    return a;
}
/**
 * Compares two vectors.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {boolean}
 */ function equals(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
/**
 * Adds a vector to another.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {import("./types.js").vec3}
 */ function add(a, b) {
    a[0] += b[0];
    a[1] += b[1];
    a[2] += b[2];
    return a;
}
/**
 * Subtracts a vector from another.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {import("./types.js").vec3}
 */ function sub(a, b) {
    a[0] -= b[0];
    a[1] -= b[1];
    a[2] -= b[2];
    return a;
}
/**
 * Scales a vector by a number.
 * @param {import("./types.js").vec3} a
 * @param {number} s
 * @returns {import("./types.js").vec3}
 */ function scale(a, s) {
    a[0] *= s;
    a[1] *= s;
    a[2] *= s;
    return a;
}
/**
 * Adds two vectors after scaling the second one.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @param {number} s
 * @returns {import("./types.js").vec3}
 */ function addScaled(a, b, s) {
    a[0] += b[0] * s;
    a[1] += b[1] * s;
    a[2] += b[2] * s;
    return a;
}
/**
 * Multiplies a vector by a matrix.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").mat4} m
 * @returns {import("./types.js").vec3}
 */ function multMat4(a, m) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    a[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    a[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    a[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return a;
}
/**
 * Multiplies a vector by a quaternion.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").quat} q
 * @returns {import("./types.js").vec3}
 */ function multQuat(a, q) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    const qx = q[0];
    const qy = q[1];
    const qz = q[2];
    const qw = q[3];
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    a[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    a[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    a[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return a;
}
/**
 * Calculates the dot product of two vectors.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {number}
 */ function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/**
 * Calculates the cross product of two vectors.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {import("./types.js").vec3}
 */ function cross(a, b) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    const vx = b[0];
    const vy = b[1];
    const vz = b[2];
    a[0] = y * vz - vy * z;
    a[1] = z * vx - vz * x;
    a[2] = x * vy - vx * y;
    return a;
}
/**
 * Calculates the length of a vector.
 * @param {import("./types.js").vec3} a
 * @returns {number}
 */ function length(a) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    return Math.sqrt(x * x + y * y + z * z);
}
/**
 * Calculates the squared length of a vector.
 * @param {import("./types.js").vec3} a
 * @returns {number}
 */ function lengthSq(a) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    return x * x + y * y + z * z;
}
/**
 * Normalises a vector.
 * @param {import("./types.js").vec3} a
 * @returns {import("./types.js").vec3}
 */ function normalize(a) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    let l = Math.sqrt(x * x + y * y + z * z);
    l = 1 / (l || 1);
    a[0] *= l;
    a[1] *= l;
    a[2] *= l;
    return a;
}
/**
 * Calculates the distance between two vectors.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {number}
 */ function distance(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
/**
 * Calculates the squared distance between two vectors.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @returns {number}
 */ function distanceSq(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return dx * dx + dy * dy + dz * dz;
}
/**
 * Limits a vector to a length.
 * @param {import("./types.js").vec3} a
 * @param {number} len
 * @returns {import("./types.js").vec3}
 */ function limit(a, len) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    const dsq = x * x + y * y + z * z;
    const lsq = len * len;
    if (lsq > 0 && dsq > lsq) {
        const nd = len / Math.sqrt(dsq);
        a[0] *= nd;
        a[1] *= nd;
        a[2] *= nd;
    }
    return a;
}
/**
 * Linearly interpolates between two vectors.
 * @param {import("./types.js").vec3} a
 * @param {import("./types.js").vec3} b
 * @param {number} t
 * @returns {import("./types.js").vec3}
 */ function lerp(a, b, t) {
    const x = a[0];
    const y = a[1];
    const z = a[2];
    a[0] = x + (b[0] - x) * t;
    a[1] = y + (b[1] - y) * t;
    a[2] = z + (b[2] - z) * t;
    return a;
}
/**
 * Prints a vector to a string.
 * @param {import("./types.js").vec3} a
 * @param {number} [precision=4]
 * @returns {string}
 */ function toString(a, precision = 4) {
    const scale = 10 ** precision;
    // prettier-ignore
    return `[${Math.floor(a[0] * scale) / scale}, ${Math.floor(a[1] * scale) / scale}, ${Math.floor(a[2] * scale) / scale}]`;
}

var vec3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  add: add,
  addScaled: addScaled,
  copy: copy,
  create: create,
  cross: cross,
  distance: distance,
  distanceSq: distanceSq,
  dot: dot,
  equals: equals,
  length: length,
  lengthSq: lengthSq,
  lerp: lerp,
  limit: limit,
  multMat4: multMat4,
  multQuat: multQuat,
  normalize: normalize,
  scale: scale,
  set: set,
  sub: sub,
  toString: toString
});

export { sub as a, scale as b, add as c, create as d, dot as e, cross as f, copy as g, distance as h, length as l, multMat4 as m, normalize as n, set as s, toString as t, vec3 as v };
