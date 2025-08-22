import { t as toString$1 } from './vec3-iMfOIZBS.js';
import { c as set3 } from './avec3-D3IP9wAY.js';

/**
 * Creates a new bounding box.
 * @returns {import("./types.js").aabb}
 */ function create() {
    // [min, max]
    return [
        [
            Infinity,
            Infinity,
            Infinity
        ],
        [
            -Infinity,
            -Infinity,
            -Infinity
        ]
    ];
}
/**
 * Reset a bounding box.
 * @param {import("./types.js").aabb} a
 * @returns {import("./types.js").rect}
 */ function empty(a) {
    a[0][0] = Infinity;
    a[0][1] = Infinity;
    a[0][2] = Infinity;
    a[1][0] = -Infinity;
    a[1][1] = -Infinity;
    a[1][2] = -Infinity;
    return a;
}
/**
 * Copies a bounding box.
 * @param {import("./types.js").aabb} a
 * @returns {import("./types.js").aabb}
 */ function copy(a) {
    return [
        a[0].slice(),
        a[1].slice()
    ];
}
/**
 * Sets a bounding box to another.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").aabb} b
 * @returns {import("./types.js").aabb}
 */ function set(a, b) {
    a[0][0] = b[0][0];
    a[0][1] = b[0][1];
    a[0][2] = b[0][2];
    a[1][0] = b[1][0];
    a[1][1] = b[1][1];
    a[1][2] = b[1][2];
    return a;
}
/**
 * Checks if a bounding box is empty.
 * @param {import("./types.js").aabb} a
 * @returns {boolean}
 */ function isEmpty(a) {
    return a[0][0] > a[1][0] || a[0][1] > a[1][1] || a[0][2] > a[1][2];
}
/**
 * Updates a bounding box from a list of points.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").vec3[] | import("./types.js").TypedArray} points
 * @returns {import("./types.js").aabb}
 */ function fromPoints(a, points) {
    empty(a);
    const isFlatArray = !points[0]?.length;
    const l = points.length / (isFlatArray ? 3 : 1);
    for(let i = 0; i < l; i++){
        if (isFlatArray) {
            includePoint(a, points, i * 3);
        } else {
            includePoint(a, points[i]);
        }
    }
    return a;
}
/**
 * Returns a list of 8 points from a bounding box.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").vec3[]} [points]
 * @returns {import("./types.js").vec3[]}
 */ function getCorners(a, points = Array.from({
    length: 8
}, ()=>[])) {
    set3(points[0], 0, a[0][0], a[0][1], a[0][2]);
    set3(points[1], 0, a[1][0], a[0][1], a[0][2]);
    set3(points[2], 0, a[1][0], a[0][1], a[1][2]);
    set3(points[3], 0, a[0][0], a[0][1], a[1][2]);
    set3(points[4], 0, a[0][0], a[1][1], a[0][2]);
    set3(points[5], 0, a[1][0], a[1][1], a[0][2]);
    set3(points[6], 0, a[1][0], a[1][1], a[1][2]);
    set3(points[7], 0, a[0][0], a[1][1], a[1][2]);
    return points;
}
/**
 * Returns the center of a bounding box.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").vec3} out
 * @returns {import("./types.js").vec3}
 */ function center(a, out = [
    0,
    0,
    0
]) {
    out[0] = (a[0][0] + a[1][0]) / 2;
    out[1] = (a[0][1] + a[1][1]) / 2;
    out[2] = (a[0][2] + a[1][2]) / 2;
    return out;
}
/**
 * Returns the size of a bounding box.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").vec3} out
 * @returns {import("./types.js").vec3}
 */ function size(a, out = [
    0,
    0,
    0
]) {
    out[0] = Math.abs(a[1][0] - a[0][0]);
    out[1] = Math.abs(a[1][1] - a[0][1]);
    out[2] = Math.abs(a[1][2] - a[0][2]);
    return out;
}
/**
 * Checks if a point is inside a bounding box.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").vec3} p
 * @returns {boolean}
 */ function containsPoint(a, [x, y, z]) {
    return x >= a[0][0] && x <= a[1][0] && y >= a[0][1] && y <= a[1][1] && z >= a[0][2] && z <= a[1][2];
}
/**
 * Includes a bounding box in another.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").aabb} b
 * @returns {import("./types.js").aabb}
 */ function includeAABB(a, b) {
    if (isEmpty(a)) {
        set(a, b);
    } else if (isEmpty(b)) ; else {
        a[0][0] = Math.min(a[0][0], b[0][0]);
        a[0][1] = Math.min(a[0][1], b[0][1]);
        a[0][2] = Math.min(a[0][2], b[0][2]);
        a[1][0] = Math.max(a[1][0], b[1][0]);
        a[1][1] = Math.max(a[1][1], b[1][1]);
        a[1][2] = Math.max(a[1][2], b[1][2]);
    }
    return a;
}
/**
 * Includes a point in a bounding box.
 * @param {import("./types.js").aabb} a
 * @param {import("./types.js").vec3} p
 * @param {number} [i=0] offset in the point array
 * @returns {import("./types.js").vec3}
 */ function includePoint(a, p, i = 0) {
    a[0][0] = Math.min(a[0][0], p[i + 0]);
    a[0][1] = Math.min(a[0][1], p[i + 1]);
    a[0][2] = Math.min(a[0][2], p[i + 2]);
    a[1][0] = Math.max(a[1][0], p[i + 0]);
    a[1][1] = Math.max(a[1][1], p[i + 1]);
    a[1][2] = Math.max(a[1][2], p[i + 2]);
    return a;
}
/**
 * Prints a bounding box to a string.
 * @param {import("./types.js").aabb} a
 * @param {number} [precision=4]
 * @returns {string}
 */ function toString(a, precision = 4) {
    // prettier-ignore
    return `[${toString$1(a[0], precision)}, ${toString$1(a[1], precision)}]`;
}

var aabb = /*#__PURE__*/Object.freeze({
  __proto__: null,
  center: center,
  containsPoint: containsPoint,
  copy: copy,
  create: create,
  empty: empty,
  fromPoints: fromPoints,
  getCorners: getCorners,
  includeAABB: includeAABB,
  includePoint: includePoint,
  isEmpty: isEmpty,
  set: set,
  size: size,
  toString: toString
});

export { create as a, aabb as b, center as c, fromPoints as f, size as s };
