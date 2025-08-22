import { t as toString$1 } from './vec2-CAYY_f5d.js';

/**
 * Creates a new rectangle.
 * @returns {import("./types.js").rect}
 */ function create() {
    return [
        [
            Infinity,
            Infinity
        ],
        [
            -Infinity,
            -Infinity
        ]
    ];
}
/**
 * Reset a rectangle.
 * @param {import("./types.js").rect} a
 * @returns {import("./types.js").rect}
 */ function empty(a) {
    a[0][0] = a[0][1] = Infinity;
    a[1][0] = a[1][1] = -Infinity;
    return a;
}
/**
 * Copies a rectangle.
 * @param {import("./types.js").rect} a
 * @returns {import("./types.js").rect}
 */ function copy(a) {
    return [
        a[0].slice(),
        a[1].slice()
    ];
}
/**
 * Sets a rectangle to another.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").rect} b
 * @returns {import("./types.js").rect}
 */ function set(a, b) {
    a[0][0] = b[0][0];
    a[0][1] = b[0][1];
    a[1][0] = b[1][0];
    a[1][1] = b[1][1];
    return a;
}
/**
 * Checks if a rectangle is empty.
 * @param {import("./types.js").rect} a
 * @returns {boolean}
 */ function isEmpty(a) {
    return a[0][0] > a[1][0] || a[0][1] > a[1][1];
}
/**
 * Updates a rectangle from a list of points.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2[] | import("./types.js").TypedArray} points
 * @returns {import("./types.js").rect}
 */ function fromPoints(a, points) {
    const isTypedArray = !Array.isArray(points);
    for(let i = 0; i < points.length / (isTypedArray ? 2 : 1); i++){
        includePoint(a, isTypedArray ? points.slice(i * 2) : points[i]);
    }
    return a;
}
/**
 * Returns a list of 4 points from a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2[]} points
 * @returns {import("./types.js").vec2[]}
 */ function getCorners(a, points = []) {
    points[0] = a[0].slice();
    points[1] = [
        a[0][1],
        a[1][0]
    ];
    points[2] = a[1].slice();
    points[3] = [
        a[1][0],
        a[0][1]
    ];
    return points;
}
/**
 * Scales a rectangle.
 * @param {import("./types.js").rect} a
 * @param {number} n
 * @returns {import("./types.js").rect}
 */ function scale(a, n) {
    a[0][0] *= n;
    a[0][1] *= n;
    a[1][0] *= n;
    a[1][1] *= n;
    return a;
}
/**
 * Sets the size of a rectangle using width and height.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} size
 * @returns {import("./types.js").rect}
 */ function setSize(a, size) {
    a[1][0] = a[0][0] + size[0];
    a[1][1] = a[0][1] + size[1];
    return a;
}
/**
 * Returns the size of a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} out
 * @returns {import("./types.js").vec2}
 */ function size(a, out = []) {
    out[0] = width(a);
    out[1] = height(a);
    return out;
}
/**
 * Returns the width of a rectangle.
 * @param {import("./types.js").rect} a
 * @returns {number}
 */ function width(a) {
    return a[1][0] - a[0][0];
}
/**
 * Returns the height of a rectangle.
 * @param {import("./types.js").rect} a
 * @returns {number}
 */ function height(a) {
    return a[1][1] - a[0][1];
}
/**
 * Returns the aspect ratio of a rectangle.
 * @param {import("./types.js").rect} a
 * @returns {number}
 */ function aspectRatio(a) {
    return width(a) / height(a);
}
/**
 * Sets the position of a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} p
 * @returns {import("./types.js").rect}
 */ function setPosition(a, [x, y]) {
    const w = width(a);
    const h = height(a);
    a[0][0] = x;
    a[0][1] = y;
    a[1][0] = x + w;
    a[1][1] = y + h;
    return a;
}
/**
 * Returns the center of a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} out
 * @returns {import("./types.js").rect}
 */ function center(a, out = []) {
    out[0] = a[0][0] + width(a) * 0.5;
    out[1] = a[0][1] + height(a) * 0.5;
    return out;
}
/**
 * Checks if a point is inside a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} p
 * @returns {boolean}
 */ function containsPoint(a, [x, y]) {
    return x >= a[0][0] && x <= a[1][0] && y >= a[0][1] && y <= a[1][1];
}
/**
 * Checks if a rectangle is inside another rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").rect} b
 * @returns {boolean}
 */ function containsRect(a, b) {
    return containsPoint(a, b[0]) && containsPoint(a, b[1]);
}
/**
 * Includes a point in a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} p
 * @returns {import("./types.js").rect}
 */ function includePoint(a, [x, y]) {
    const minx = a[0][0];
    const miny = a[0][1];
    const maxx = a[1][0];
    const maxy = a[1][1];
    a[0][0] = minx > x ? x : minx;
    a[0][1] = miny > y ? y : miny;
    a[1][0] = maxx < x ? x : maxx;
    a[1][1] = maxy < y ? y : maxy;
    return a;
}
/**
 * Includes a rectangle in another rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").rect} b
 * @returns {import("./types.js").rect}
 */ function includeRect(a, b) {
    includePoint(a, b[0]);
    includePoint(a, b[1]);
    return a;
}
/**
 * Maps a point into the dimensions of a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} p
 * @returns {import("./types.js").vec2}
 */ function mapPoint(a, p) {
    const minx = a[0][0];
    const miny = a[0][1];
    const maxx = a[1][0];
    const maxy = a[1][1];
    p[0] = Math.max(minx, Math.min(p[0], maxx)) - minx;
    p[1] = Math.max(miny, Math.min(p[1], maxy)) - miny;
    return p;
}
/**
 * Clamps a point into the dimensions of a rectangle.
 * @param {import("./types.js").rect} a
 * @param {import("./types.js").vec2} p
 * @returns {import("./types.js").vec2}
 */ function clampPoint(a, p) {
    const minx = a[0][0];
    const miny = a[0][1];
    const maxx = a[1][0];
    const maxy = a[1][1];
    p[0] = Math.max(minx, Math.min(p[0], maxx));
    p[1] = Math.max(miny, Math.min(p[1], maxy));
    return p;
}
/**
 * Prints a rect to a string.
 * @param {import("./types.js").rect} a
 * @param {number} [precision=4]
 * @returns {string}
 */ function toString(a, precision = 4) {
    // prettier-ignore
    return `[${toString$1(a[0], precision)}, ${toString$1(a[1], precision)}]`;
}

var rect = /*#__PURE__*/Object.freeze({
  __proto__: null,
  aspectRatio: aspectRatio,
  center: center,
  clampPoint: clampPoint,
  containsPoint: containsPoint,
  containsRect: containsRect,
  copy: copy,
  create: create,
  empty: empty,
  fromPoints: fromPoints,
  getCorners: getCorners,
  height: height,
  includePoint: includePoint,
  includeRect: includeRect,
  isEmpty: isEmpty,
  mapPoint: mapPoint,
  scale: scale,
  set: set,
  setPosition: setPosition,
  setSize: setSize,
  size: size,
  toString: toString,
  width: width
});

export { containsPoint as c, height as h, rect as r, width as w };
