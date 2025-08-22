/** @module vec2 */ /**
 * Returns a new vec2 at 0, 0.
 * @returns {import("./types.js").vec2}
 */ function create() {
    return [
        0,
        0
    ];
}
/**
 * Returns a copy of a vector.
 * @param {import("./types.js").vec2} a
 * @returns {import("./types.js").vec2}
 */ function copy(a) {
    return a.slice();
}
/**
 * Sets a vector to another vector.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @returns {import("./types.js").vec2}
 */ function set(a, b) {
    a[0] = b[0];
    a[1] = b[1];
    return a;
}
/**
 * Compares two vectors.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @returns {boolean}
 */ function equals(a, b) {
    return a[0] === b[0] && a[1] === b[1];
}
/**
 * Add a vector to another.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @returns {import("./types.js").vec2}
 */ function add(a, b) {
    a[0] += b[0];
    a[1] += b[1];
    return a;
}
/**
 * Subtracts a vector from another.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @returns {import("./types.js").vec2}
 */ function sub(a, b) {
    a[0] -= b[0];
    a[1] -= b[1];
    return a;
}
/**
 * Scales a vector by a number.
 * @param {import("./types.js").vec2} a
 * @param {number} s
 * @returns {import("./types.js").vec2}
 */ function scale(a, s) {
    a[0] *= s;
    a[1] *= s;
    return a;
}
/**
 * Adds two vectors after scaling the second one.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @param {number} s
 * @returns {import("./types.js").vec2}
 */ function addScaled(a, b, s) {
    a[0] += b[0] * s;
    a[1] += b[1] * s;
    return a;
}
/**
 * Calculates the dot product of two vectors.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @returns {number}
 */ function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
}
/**
 * Calculates the length of a vector.
 * @param {import("./types.js").vec2} a
 * @returns {number}
 */ function length(a) {
    const x = a[0];
    const y = a[1];
    return Math.sqrt(x * x + y * y);
}
/**
 * Calculates the squared length of a vector.
 * @param {import("./types.js").vec2} a
 * @returns {number}
 */ function lengthSq(a) {
    const x = a[0];
    const y = a[1];
    return x * x + y * y;
}
/**
 * Normalises a vector.
 * @param {import("./types.js").vec2} a
 * @returns {import("./types.js").vec2}
 */ function normalize(a) {
    const x = a[0];
    const y = a[1];
    let l = Math.sqrt(x * x + y * y);
    l = 1 / (l || 1);
    a[0] *= l;
    a[1] *= l;
    return a;
}
/**
 * Calculates the distance between two vectors.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @returns {number}
 */ function distance(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return Math.sqrt(dx * dx + dy * dy);
}
/**
 * Calculates the squared distance between two vectors.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @returns {number}
 */ function distanceSq(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return dx * dx + dy * dy;
}
/**
 * Limits a vector to a length.
 * @param {import("./types.js").vec2} a
 * @param {number} len
 * @returns {import("./types.js").vec2}
 */ function limit(a, len) {
    const x = a[0];
    const y = a[1];
    const dsq = x * x + y * y;
    const lsq = len * len;
    if (lsq > 0 && dsq > lsq) {
        const nd = len / Math.sqrt(dsq);
        a[0] *= nd;
        a[1] *= nd;
    }
    return a;
}
/**
 * Linearly interpolates between two vectors.
 * @param {import("./types.js").vec2} a
 * @param {import("./types.js").vec2} b
 * @param {number} t
 * @returns {import("./types.js").vec2}
 */ function lerp(a, b, t) {
    const x = a[0];
    const y = a[1];
    a[0] = x + (b[0] - x) * t;
    a[1] = y + (b[1] - y) * t;
    return a;
}
/**
 * Prints a vector to a string.
 * @param {import("./types.js").vec2} a
 * @param {number} [precision=4]
 * @returns {string}
 */ function toString(a, precision = 4) {
    const scale = 10 ** precision;
    // prettier-ignore
    return `[${Math.floor(a[0] * scale) / scale}, ${Math.floor(a[1] * scale) / scale}]`;
}

var vec2 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  add: add,
  addScaled: addScaled,
  copy: copy,
  create: create,
  distance: distance,
  distanceSq: distanceSq,
  dot: dot,
  equals: equals,
  length: length,
  lengthSq: lengthSq,
  lerp: lerp,
  limit: limit,
  normalize: normalize,
  scale: scale,
  set: set,
  sub: sub,
  toString: toString
});

export { create as c, distance as d, toString as t, vec2 as v };
