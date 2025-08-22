export { b as aabb } from './_chunks/aabb-CipEXYbk.js';
import { s as set, a as sub, n as normalize, e as dot, t as toString$1, d as create$1 } from './_chunks/vec3-iMfOIZBS.js';
export { r as ray } from './_chunks/ray-BWOyc5m_.js';
export { r as rect } from './_chunks/rect-Dy6qG5eq.js';
import './_chunks/avec3-D3IP9wAY.js';
import './_chunks/vec2-CAYY_f5d.js';

/**
 * Enum for different side values
 * @readonly
 * @enum {number}
 */ const Side = Object.freeze({
    OnPlane: 0,
    Same: -1,
    Opposite: 1
});
const TEMP_0 = create$1();
/**
 * Creates a new plane
 * @returns {import("./types.js").plane}
 */ function create() {
    return [
        [
            0,
            0,
            0
        ],
        [
            0,
            1,
            0
        ]
    ];
}
/**
 * Returns on which side a point is.
 * @param {import("./types.js").plane} plane
 * @param {import("./types.js").vec3} point
 * @returns {number}
 */ function side([planePoint, planeNormal], point) {
    set(TEMP_0, planePoint);
    sub(TEMP_0, point);
    normalize(TEMP_0);
    const dot$1 = dot(TEMP_0, planeNormal);
    if (dot$1 > 0) return Side.Opposite;
    if (dot$1 < 0) return Side.Same;
    return Side.OnPlane;
}
/**
 * Prints a plane to a string.
 * @param {import("./types.js").plane} a
 * @param {number} [precision=4]
 * @returns {string}
 */ function toString(a, precision = 4) {
    // prettier-ignore
    return `[${toString$1(a[0], precision)}, ${toString$1(a[1], precision)}]`;
}

var plane = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Side: Side,
  create: create,
  side: side,
  toString: toString
});

export { plane };
