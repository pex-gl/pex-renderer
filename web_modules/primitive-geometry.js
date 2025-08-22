/** @module utils */ /**
 * Two times PI.
 * @constant {number}
 */ const TAU = Math.PI * 2;
/**
 * Two times PI.
 * @constant {number}
 */ const HALF_PI = Math.PI / 2;
/**
 * Square root of 2.
 * @constant {number}
 */ const SQRT2 = Math.sqrt(2);
/**
 * Normalize a vector 3.
 * @param {number[]} v Vector 3 array
 * @returns {number[]} Normalized vector
 */ function normalize(v) {
    const l = 1 / (Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1);
    v[0] *= l;
    v[1] *= l;
    v[2] *= l;
    return v;
}
/**
 * Ensure first argument passed to the primitive functions is an object
 * @param {...*} args
 */ function checkArguments(args) {
    const argumentType = typeof args[0];
    if (argumentType !== "object" && argumentType !== "undefined") {
        console.error("First argument must be an object.");
    }
}
/**
 * @private
 */ let TYPED_ARRAY_TYPE;
/**
 * Enforce a typed array constructor for cells
 * @param {(Class<Uint8Array>|Class<Uint16Array>|Class<Uint32Array>)} type
 */ function setTypedArrayType(type) {
    TYPED_ARRAY_TYPE = type;
}
/**
 * Select cells typed array from a size determined by amount of vertices.
 *
 * @param {number} size The max value expected
 * @returns {(Uint8Array|Uint16Array|Uint32Array)}
 * @see [MDN TypedArray objects]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray#typedarray_objects}
 */ const getCellsTypedArray = (size)=>TYPED_ARRAY_TYPE || (size <= 255 ? Uint8Array : size <= 65535 ? Uint16Array : Uint32Array);
/**
 * @private
 */ const TMP = [
    0,
    0,
    0
];
/**
 * @private
 */ const PLANE_DIRECTIONS = {
    z: [
        0,
        1,
        2,
        1,
        -1,
        1
    ],
    "-z": [
        0,
        1,
        2,
        -1,
        -1,
        -1
    ],
    "-x": [
        2,
        1,
        0,
        1,
        -1,
        -1
    ],
    x: [
        2,
        1,
        0,
        -1,
        -1,
        1
    ],
    y: [
        0,
        2,
        1,
        1,
        1,
        1
    ],
    "-y": [
        0,
        2,
        1,
        1,
        -1,
        -1
    ]
};
/**
 * @private
 */ function computePlane(geometry, indices, su, sv, nu, nv, direction = "z", pw = 0, quads = false, uvScale = [
    1,
    1
], uvOffset = [
    0,
    0
], center = [
    0,
    0,
    0
], ccw = true) {
    const { positions, normals, uvs, cells } = geometry;
    const [u, v, w, flipU, flipV, normal] = PLANE_DIRECTIONS[direction];
    const vertexOffset = indices.vertex;
    for(let j = 0; j <= nv; j++){
        for(let i = 0; i <= nu; i++){
            positions[indices.vertex * 3 + u] = (-su / 2 + i * su / nu) * flipU + center[u];
            positions[indices.vertex * 3 + v] = (-sv / 2 + j * sv / nv) * flipV + center[v];
            positions[indices.vertex * 3 + w] = pw + center[w];
            normals[indices.vertex * 3 + w] = normal;
            uvs[indices.vertex * 2] = i / nu * uvScale[0] + uvOffset[0];
            uvs[indices.vertex * 2 + 1] = (1 - j / nv) * uvScale[1] + uvOffset[1];
            indices.vertex++;
            if (j < nv && i < nu) {
                const n = vertexOffset + j * (nu + 1) + i;
                if (quads) {
                    const o = vertexOffset + (j + 1) * (nu + 1) + i;
                    cells[indices.cell] = n;
                    cells[indices.cell + 1] = o;
                    cells[indices.cell + 2] = o + 1;
                    cells[indices.cell + 3] = n + 1;
                } else {
                    cells[indices.cell] = n;
                    cells[indices.cell + (ccw ? 1 : 2)] = n + nu + 1;
                    cells[indices.cell + (ccw ? 2 : 1)] = n + nu + 2;
                    cells[indices.cell + 3] = n;
                    cells[indices.cell + (ccw ? 4 : 5)] = n + nu + 2;
                    cells[indices.cell + (ccw ? 5 : 4)] = n + 1;
                }
                indices.cell += quads ? 4 : 6;
            }
        }
    }
    return geometry;
}

var utils = /*#__PURE__*/Object.freeze({
  __proto__: null,
  HALF_PI: HALF_PI,
  PLANE_DIRECTIONS: PLANE_DIRECTIONS,
  SQRT2: SQRT2,
  TAU: TAU,
  TMP: TMP,
  checkArguments: checkArguments,
  computePlane: computePlane,
  getCellsTypedArray: getCellsTypedArray,
  normalize: normalize,
  setTypedArrayType: setTypedArrayType
});

/**
 * @typedef {object} BoxOptions
 * @property {number} [sx=1]
 * @property {number} [sy=sx]
 * @property {number} [sz=sx]
 */ /**
 * @alias module:box
 * @param {BoxOptions} [options={}]
 * @returns {import("../types.js").BasicSimplicialComplex}
 */ function box({ sx = 1, sy = sx, sz = sx } = {}) {
    checkArguments(arguments);
    const x = sx / 2;
    const y = sy / 2;
    const z = sz / 2;
    return {
        // prettier-ignore
        positions: Float32Array.of(-x, y, z, -x, -y, z, x, -y, z, x, y, z, // -z
        x, y, -z, x, -y, -z, -x, -y, -z, -x, y, -z),
        // prettier-ignore
        cells: Uint8Array.of(0, 1, 2, 3, 3, 2, 5, 4, 4, 5, 6, 7, 7, 6, 1, 0, 7, 0, 3, 4, 1, 6, 5, 2)
    };
}

/**
 * @typedef {object} CircleOptions
 * @property {number} [radius=0.5]
 * @property {number} [segments=32]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {boolean} [closed=false]
 */ /**
 * @alias module:circle
 * @param {CircleOptions} [options={}]
 * @returns {import("../types.js").BasicSimplicialComplex}
 */ function circle({ radius = 0.5, segments = 32, theta = TAU, thetaOffset = 0, closed = false } = {}) {
    checkArguments(arguments);
    const positions = new Float32Array(segments * 3);
    const cells = new (getCellsTypedArray(segments))((segments - (closed ? 0 : 1)) * 2);
    for(let i = 0; i < segments; i++){
        const t = i / segments * theta + thetaOffset;
        positions[i * 3] = radius * Math.cos(t);
        positions[i * 3 + 1] = radius * Math.sin(t);
        if (i > 0) {
            cells[(i - 1) * 2] = i - 1;
            cells[(i - 1) * 2 + 1] = i;
        }
    }
    if (closed) {
        cells[(segments - 1) * 2] = segments - 1;
        cells[(segments - 1) * 2 + 1] = 0;
    }
    return {
        positions,
        cells
    };
}

/**
 * @typedef {object} QuadOptions
 * @property {number} [scale=0.5]
 */ /**
 * @alias module:quad
 * @param {QuadOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function quad({ scale = 0.5 } = {}) {
    checkArguments(arguments);
    return {
        // prettier-ignore
        positions: Float32Array.of(-scale, -scale, 0, scale, -scale, 0, scale, scale, 0, -scale, scale, 0),
        // prettier-ignore
        normals: Int8Array.of(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1),
        // prettier-ignore
        uvs: Uint8Array.of(0, 0, 1, 0, 1, 1, 0, 1),
        // prettier-ignore
        cells: getCellsTypedArray(12).of(0, 1, 2, 2, 3, 0)
    };
}

/**
 * @typedef {object} PlaneOptions
 * @property {number} [sx=1]
 * @property {number} [sy=sx]
 * @property {number} [nx=1]
 * @property {number} [ny=nx]
 * @property {PlaneDirection} [direction="z"]
 * @property {boolean} [quads=false]
 */ /**
 * @typedef {"x" | "-x" | "y" | "-y" | "z" | "-z"} PlaneDirection
 */ /**
 * @alias module:plane
 * @param {PlaneOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function plane({ sx = 1, sy = sx, nx = 1, ny = nx, direction = "z", quads = false } = {}) {
    checkArguments(arguments);
    const size = (nx + 1) * (ny + 1);
    return computePlane({
        positions: new Float32Array(size * 3),
        normals: new Float32Array(size * 3),
        uvs: new Float32Array(size * 2),
        cells: new (getCellsTypedArray(size))(nx * ny * (quads ? 4 : 6))
    }, {
        vertex: 0,
        cell: 0
    }, sx, sy, nx, ny, direction, 0, quads);
}

/**
 * @typedef {object} RoundedCubeOptions
 * @property {number} [sx=1]
 * @property {number} [sy=sx]
 * @property {number} [nx=1]
 * @property {number} [ny=nx]
 * @property {number} [radius=sx * 0.25]
 * @property {number} [roundSegments=8]
 * @property {number} [edgeSegments=1]
 */ /**
 * @alias module:roundedRectangle
 * @param {RoundedCubeOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function roundedRectangle({ sx = 1, sy = sx, nx = 1, ny = nx, radius = sx * 0.25, roundSegments = 8, edgeSegments = 1 } = {}) {
    checkArguments(arguments);
    const size = (nx + 1) * (ny + 1) + (roundSegments + 1) * (roundSegments + 1) * 4 + (roundSegments + 1) * (edgeSegments + 1) * 4;
    const geometry = {
        positions: new Float32Array(size * 3),
        normals: new Float32Array(size * 3),
        uvs: new Float32Array(size * 2),
        cells: new (getCellsTypedArray(size))((nx * ny + roundSegments * roundSegments * 4 + roundSegments * edgeSegments * 4) * 6)
    };
    const r2 = radius * 2;
    const widthX = sx - r2;
    const widthY = sy - r2;
    const faceSX = widthX / sx;
    const faceSY = widthY / sy;
    const radiusSX = radius / sx;
    const radiusSY = radius / sy;
    const indices = {
        vertex: 0,
        cell: 0
    };
    const uvOffsetCorner = (su, sv)=>[
            [
                radius / (su + r2),
                0
            ],
            [
                1 - radius / (su + r2),
                0
            ],
            [
                1,
                1 - radius / (sv + r2)
            ],
            [
                0,
                1 - radius / (sv + r2)
            ]
        ];
    const uvOffsetStart = (_, sv)=>[
            0,
            radius / (sv + r2)
        ];
    const uvOffsetEnd = (su, sv)=>[
            1 - radius / (su + r2),
            radius / (sv + r2)
        ];
    const [su, sv, nu, nv, direction, pw, uvScale, uvOffset, center] = [
        widthX,
        widthY,
        nx,
        ny,
        "z",
        0,
        [
            faceSX,
            faceSY
        ],
        [
            radiusSX,
            radiusSY
        ],
        (x, y)=>[
                x,
                y,
                0
            ]
    ];
    // Plane face
    computePlane(geometry, indices, su, sv, nu, nv, direction, pw, false, uvScale, uvOffset);
    // Corner order: ccw uv-like order and L/B (0) R/T (2)
    // 0,1 -- 1,1
    //  |  --  |
    // 0,0 -- 1,0
    for(let i = 0; i < 4; i++){
        const ceil = Math.ceil(i / 2) % 2;
        const floor = Math.floor(i / 2) % 2;
        const x = (ceil === 0 ? -1 : 1) * (su + radius) * 0.5;
        const y = (floor === 0 ? -1 : 1) * (sv + radius) * 0.5;
        // Flip for quad seams to be radial
        const flip = i % 2 === 0;
        // Corners
        computePlane(geometry, indices, radius, radius, roundSegments, roundSegments, flip ? "-z" : "z", pw, false, [
            (flip ? -1 : 1) * (radius / (su + r2)),
            radius / (sv + r2)
        ], uvOffsetCorner(su, sv)[i], center(x, y), !flip);
        // Edges
        if (i === 0 || i === 2) {
            // Left / Right
            computePlane(geometry, indices, radius, sv, roundSegments, edgeSegments, direction, pw, false, [
                uvOffset[0],
                uvScale[1]
            ], ceil === 0 ? uvOffsetStart(su, sv) : uvOffsetEnd(su, sv), center(x, 0));
            // Bottom/Top
            computePlane(geometry, indices, su, radius, edgeSegments, roundSegments, direction, pw, false, [
                uvScale[0],
                uvOffset[1]
            ], floor === 0 ? [
                ...uvOffsetStart(sv, su)
            ].reverse() : [
                ...uvOffsetEnd(sv, su)
            ].reverse(), center(0, y));
        }
    }
    const rx = widthX * 0.5;
    const ry = widthY * 0.5;
    for(let i = 0; i < geometry.positions.length; i += 3){
        const position = [
            geometry.positions[i],
            geometry.positions[i + 1],
            geometry.positions[i + 2]
        ];
        TMP[0] = position[0];
        TMP[1] = position[1];
        TMP[2] = position[2];
        let needsRounding = false;
        if (position[0] < -rx) {
            if (position[1] < -ry) {
                position[0] = -rx;
                position[1] = -ry;
                needsRounding = true;
            } else if (position[1] > ry) {
                position[0] = -rx;
                position[1] = ry;
                needsRounding = true;
            }
        } else if (position[0] > rx) {
            if (position[1] < -ry) {
                position[0] = rx;
                position[1] = -ry;
                needsRounding = true;
            } else if (position[1] > ry) {
                position[0] = rx;
                position[1] = ry;
                needsRounding = true;
            }
        }
        TMP[0] -= position[0];
        TMP[1] -= position[1];
        geometry.normals[i + 2] = 1;
        if (needsRounding) {
            const x = Math.sqrt(TMP[0] ** 2 + TMP[1] ** 2) / Math.max(Math.abs(TMP[0]), Math.abs(TMP[1]));
            geometry.positions[i] = position[0] + TMP[0] / x;
            geometry.positions[i + 1] = position[1] + TMP[1] / x;
        }
    }
    return geometry;
}

/**
 * @typedef {object} StadiumOptions
 * @property {number} [sx=1]
 * @property {number} [sy=sx]
 * @property {number} [nx=1]
 * @property {number} [ny=nx]
 * @property {number} [roundSegments=8]
 * @property {number} [edgeSegments=1]
 */ /**
 * @alias module:stadium
 * @param {StadiumOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function stadium({ sx = 1, sy = 0.5, nx, ny, roundSegments, edgeSegments } = {}) {
    checkArguments(arguments);
    return roundedRectangle({
        sx,
        sy,
        nx,
        ny,
        radius: Math.min(sx, sy) * 0.5,
        roundSegments,
        edgeSegments
    });
}

const safeSqrt = (x)=>Math.sqrt(Math.max(x, 0));
const safeDivide = (x, y)=>x / (y + Number.EPSILON);
const isNegligeable = (x)=>Math.abs(x) < Number.EPSILON * 2;
const remapRectangular = (x, radius)=>(x / radius + 1) / 2;
const remap = (x)=>(x + 1) / 2; // From [-1, 1] to [0, 1]
function rectangular({ uvs, index, x, y, radius, sx = 1, sy = 1 }) {
    uvs[index] = remapRectangular(x, radius * sx);
    uvs[index + 1] = remapRectangular(y, radius * sy);
}
function polar({ uvs, index, radiusRatio, thetaRatio }) {
    uvs[index] = radiusRatio;
    uvs[index + 1] = thetaRatio;
}
// Basic
function radial({ uvs, index, u, v, radius }) {
    const x = safeDivide(Math.sqrt(u ** 2 + v ** 2), Math.max(Math.abs(u), Math.abs(v)));
    uvs[index] = remap(x * u);
    uvs[index + 1] = remap(x * v);
}
const FOUR_OVER_PI = 4 / Math.PI;
function concentric({ uvs, index, u, v, radius }) {
    const u2 = u ** 2;
    const v2 = v ** 2;
    const x = Math.sqrt(u2 + v2);
    if (u2 > v2) {
        uvs[index] = remap(x * Math.sign(u));
        uvs[index + 1] = remap(x * (FOUR_OVER_PI * Math.atan(safeDivide(v, Math.abs(u)))));
    } else {
        uvs[index] = remap(x * (FOUR_OVER_PI * Math.atan(safeDivide(u, Math.abs(v)))));
        uvs[index + 1] = remap(x * Math.sign(v));
    }
}
function lamé({ uvs, index, u, v, radius }) {
    const u2 = u ** 2;
    const v2 = v ** 2;
    uvs[index] = remap(Math.sign(u) * Math.abs(u) ** (1 - u2 - v2));
    uvs[index + 1] = remap(Math.sign(v) * Math.abs(v) ** (1 - u2 - v2));
}
function elliptical({ uvs, index, u, v, radius }) {
    const t = u ** 2 - v ** 2;
    const pu1 = 0.5 * safeSqrt(2 + t + 2 * SQRT2 * u);
    const pu2 = 0.5 * safeSqrt(2 + t - 2 * SQRT2 * u);
    const pv1 = 0.5 * safeSqrt(2 - t + 2 * SQRT2 * v);
    const pv2 = 0.5 * safeSqrt(2 - t - 2 * SQRT2 * v);
    uvs[index] = remap(pu1 - pu2);
    uvs[index + 1] = remap(pv1 - pv2);
}
// Radial, all variations of FG squircular:
function fixFGSingularities(uvs, index, u, v, radius) {
    if (isNegligeable(u) || isNegligeable(v)) {
        uvs[index] = remap(u);
        uvs[index + 1] = remap(v);
    } else {
        return true;
    }
}
function fgSquircular({ uvs, index, u, v, radius }) {
    const ok = fixFGSingularities(uvs, index, u, v);
    if (ok) {
        const u2 = u ** 2;
        const v2 = v ** 2;
        const sign = Math.sign(u * v);
        const uv2Sum = u2 + v2;
        const sqrtUV = Math.sqrt(uv2Sum - safeSqrt(uv2Sum * (uv2Sum - 4 * u2 * v2)));
        uvs[index] = remap(sign / (v * SQRT2) * sqrtUV);
        uvs[index + 1] = remap(sign / (u * SQRT2) * sqrtUV);
    }
}
function twoSquircular({ uvs, index, u, v, radius }) {
    const ok = fixFGSingularities(uvs, index, u, v);
    if (ok) {
        const sign = Math.sign(u * v);
        const sqrtUV = Math.sqrt(1 - safeSqrt(1 - 4 * u ** 2 * v ** 2));
        uvs[index] = remap(sign / (v * SQRT2) * sqrtUV);
        uvs[index + 1] = remap(sign / (u * SQRT2) * sqrtUV);
    }
}
function threeSquircular({ uvs, index, u, v, radius }) {
    const ok = fixFGSingularities(uvs, index, u, v);
    if (ok) {
        const u2 = u ** 2;
        const v2 = v ** 2;
        const sign = Math.sign(u * v);
        const sqrtUV = Math.sqrt((1 - safeSqrt(1 - 4 * u ** 4 * v2 - 4 * u2 * v ** 4)) / (2 * (u2 + v2)));
        uvs[index] = remap(sign / v * sqrtUV);
        uvs[index + 1] = remap(sign / u * sqrtUV);
    }
}
function cornerificTapered2({ uvs, index, u, v, radius }) {
    const ok = fixFGSingularities(uvs, index, u, v);
    if (ok) {
        const u2 = u ** 2;
        const v2 = v ** 2;
        const sign = Math.sign(u * v);
        const uv2Sum = u2 + v2;
        const sqrtUV = Math.sqrt((uv2Sum - Math.sqrt(uv2Sum * (uv2Sum - 4 * u2 * v2 * (2 - u2 - v2)))) / (2 * (2 - u2 - v2)));
        uvs[index] = remap(sign / v * sqrtUV);
        uvs[index + 1] = remap(sign / u * sqrtUV);
    }
}
function tapered4({ uvs, index, u, v, radius }) {
    const ok = fixFGSingularities(uvs, index, u, v);
    if (ok) {
        const u2 = u ** 2;
        const v2 = v ** 2;
        const sign = Math.sign(u * v);
        const uv2Sum = u2 + v2;
        const divider = 3 - u ** 4 - 2 * u2 * v2 - v ** 4;
        const sqrtUV = Math.sqrt((uv2Sum - safeSqrt(uv2Sum * (uv2Sum - 2 * u2 * v2 * divider))) / divider);
        uvs[index] = remap(sign / v * sqrtUV);
        uvs[index + 1] = remap(sign / u * sqrtUV);
    }
}
// Non-axial
const FOURTH_SQRT2 = 2 ** (1 / 4);
function nonAxial2Pinch({ uvs, index, u, v, radius }) {
    const u2 = u ** 2;
    const v2 = v ** 2;
    const sign = Math.sign(u * v);
    const uv2Sum = u2 + v2;
    const sqrtUV = (uv2Sum - 2 * u2 * v2 - safeSqrt((uv2Sum - 4 * u2 * v2) * uv2Sum)) ** (1 / 4);
    if (isNegligeable(v)) {
        uvs[index] = remap(Math.sign(u) * Math.sqrt(Math.abs(u)));
        uvs[index + 1] = remap(safeDivide(sign, u * FOURTH_SQRT2) * sqrtUV);
    } else {
        uvs[index] = remap(safeDivide(sign, v * FOURTH_SQRT2) * sqrtUV);
        uvs[index + 1] = remap(isNegligeable(u) ? Math.sign(v) * Math.sqrt(Math.abs(v)) : safeDivide(sign, u * FOURTH_SQRT2) * sqrtUV);
    }
}
function nonAxialHalfPinch({ uvs, index, u, v, radius }) {
    const u2 = u ** 2;
    const v2 = v ** 2;
    const sign = Math.sign(u * v);
    const uv2Sum = u2 + v2;
    const sqrtUV = Math.sqrt(safeDivide(1 - safeSqrt(1 - 4 * u2 * v2 * uv2Sum ** 2), 2 * uv2Sum));
    if (isNegligeable(v)) {
        uvs[index] = remap(Math.sign(u) * u2);
        uvs[index + 1] = remap(safeDivide(sign, u) * sqrtUV);
    } else {
        uvs[index] = remap(safeDivide(sign, v) * sqrtUV);
        uvs[index + 1] = remap(isNegligeable(u) ? Math.sign(v) * v2 : safeDivide(sign, u) * sqrtUV);
    }
}
// Variations of elliptical
function squelched({ uvs, index, u, v, radius, t }) {
    uvs[index] = [
        HALF_PI,
        TAU - HALF_PI
    ].includes(t) ? 0.5 : remap(u / Math.sqrt(1 - v ** 2));
    uvs[index + 1] = [
        0,
        TAU,
        Math.PI
    ].includes(t) ? 0.5 : remap(v / Math.sqrt(1 - u ** 2));
}
function squelchedVertical({ uvs, index, u, v, radius, t }) {
    uvs[index] = remap(u);
    uvs[index + 1] = [
        0,
        TAU,
        Math.PI
    ].includes(t) ? 0.5 : remap(v / Math.sqrt(1 - u ** 2));
}
function squelchedHorizontal({ uvs, index, u, v, radius, t }) {
    uvs[index] = [
        HALF_PI,
        TAU - HALF_PI
    ].includes(t) ? 0.5 : remap(u / Math.sqrt(1 - v ** 2));
    uvs[index + 1] = remap(v);
}

var mappings = /*#__PURE__*/Object.freeze({
  __proto__: null,
  concentric: concentric,
  cornerificTapered2: cornerificTapered2,
  elliptical: elliptical,
  fgSquircular: fgSquircular,
  lamé: lamé,
  nonAxial2Pinch: nonAxial2Pinch,
  nonAxialHalfPinch: nonAxialHalfPinch,
  polar: polar,
  radial: radial,
  rectangular: rectangular,
  squelched: squelched,
  squelchedHorizontal: squelchedHorizontal,
  squelchedVertical: squelchedVertical,
  tapered4: tapered4,
  threeSquircular: threeSquircular,
  twoSquircular: twoSquircular
});

/**
 * @typedef {object} EllipseOptions
 * @property {number} [sx=1]
 * @property {number} [sy=0.5]
 * @property {number} [radius=0.5]
 * @property {number} [segments=32]
 * @property {number} [innerSegments=16]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {boolean} [mergeCentroid=true]
 * @property {Function} [mapping=mappings.elliptical]
 */ /**
 * @alias module:ellipse
 * @param {EllipseOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function ellipse({ sx = 1, sy = 0.5, radius = 0.5, segments = 32, innerSegments = 16, theta = TAU, thetaOffset = 0, innerRadius = 0, mergeCentroid = true, mapping = elliptical, equation = ({ rx, ry, cosTheta, sinTheta })=>[
        rx * cosTheta,
        ry * sinTheta
    ] } = {}) {
    checkArguments(arguments);
    const size = mergeCentroid ? 1 + (segments + 1) + (innerSegments - 1) * (segments + 1) : (segments + 1) * (innerSegments + 1);
    const positions = new Float32Array(size * 3);
    const normals = new Float32Array(size * 3);
    const uvs = new Float32Array(size * 2);
    const cells = new (getCellsTypedArray(size))(mergeCentroid ? segments * 3 + (innerSegments - 1) * segments * 6 : size * 6);
    if (mergeCentroid) {
        normals[2] = 1;
        uvs[0] = 0.5;
        uvs[1] = 0.5;
    }
    let vertexIndex = mergeCentroid ? 1 : 0;
    let cellIndex = 0;
    for(let j = vertexIndex; j <= innerSegments; j++){
        const radiusRatio = j / innerSegments;
        const r = innerRadius + (radius - innerRadius) * radiusRatio;
        for(let i = 0; i <= segments; i++, vertexIndex++){
            const thetaRatio = i / segments;
            const t = thetaOffset + thetaRatio * theta;
            const cosTheta = Math.cos(t);
            const sinTheta = Math.sin(t);
            const [x, y] = equation({
                rx: sx * r,
                ry: sy * r,
                cosTheta,
                sinTheta,
                s: radiusRatio,
                t
            });
            positions[vertexIndex * 3] = x;
            positions[vertexIndex * 3 + 1] = y;
            normals[vertexIndex * 3 + 2] = 1;
            mapping({
                uvs,
                index: vertexIndex * 2,
                u: radiusRatio * cosTheta,
                v: radiusRatio * sinTheta,
                radius,
                radiusRatio,
                thetaRatio,
                t,
                // For rectangular
                x,
                y,
                sx,
                sy
            });
            if (i < segments) {
                if (mergeCentroid && j === 1) {
                    cells[cellIndex] = i + 1;
                    cells[cellIndex + 1] = i + 2;
                    cellIndex += 3;
                } else {
                    let a;
                    if (mergeCentroid) {
                        a = 1 + (j - 2) * (segments + 1) + i;
                    } else if (j < innerSegments) {
                        a = j * (segments + 1) + i;
                    }
                    if (a !== undefined) {
                        const b = a + segments + 1;
                        const c = a + segments + 2;
                        const d = a + 1;
                        cells[cellIndex] = a;
                        cells[cellIndex + 1] = b;
                        cells[cellIndex + 2] = d;
                        cells[cellIndex + 3] = b;
                        cells[cellIndex + 4] = c;
                        cells[cellIndex + 5] = d;
                        cellIndex += 6;
                    }
                }
            }
        }
    }
    return {
        positions,
        normals,
        uvs,
        cells
    };
}

/**
 * @typedef {object} DiscOptions
 * @property {number} [radius=0.5]
 * @property {number} [segments=32]
 * @property {number} [innerSegments=16]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {boolean} [mergeCentroid=true]
 * @property {Function} [mapping=mappings.concentric]
 */ /**
 * @alias module:disc
 * @param {DiscOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function disc({ radius = 0.5, segments = 32, innerSegments = 16, theta = TAU, thetaOffset = 0, mergeCentroid = true, mapping = concentric } = {}) {
    checkArguments(arguments);
    return ellipse({
        sx: 1,
        sy: 1,
        radius,
        segments,
        innerSegments,
        theta,
        thetaOffset,
        mergeCentroid,
        mapping
    });
}

/**
 * @typedef {object} SuperellipseOptions
 * @property {number} [sx=1]
 * @property {number} [sy=0.5]
 * @property {number} [radius=0.5]
 * @property {number} [segments=32]
 * @property {number} [innerSegments=16]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {boolean} [mergeCentroid=true]
 * @property {Function} [mapping=mappings.lamé]
 * @property {number} [m=2]
 * @property {number} [n=m]
 */ /**
 * Lamé curve
 * See elliptical-mapping example for a few special cases
 * @see [Wolfram MathWorld – Superellipse]{@link https://mathworld.wolfram.com/Superellipse.html}
 * @see [Wikipedia – Superellipse]{@link https://en.wikipedia.org/wiki/Superellipse}
 * @alias module:superellipse
 * @param {SuperellipseOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function superellipse({ sx = 1, sy = 0.5, radius = 0.5, segments = 32, innerSegments = 16, theta = TAU, thetaOffset = 0, mergeCentroid = true, mapping = lamé, m = 2, n = m } = {}) {
    checkArguments(arguments);
    return ellipse({
        sx,
        sy,
        radius,
        segments,
        innerSegments,
        theta,
        thetaOffset,
        mergeCentroid,
        mapping,
        equation: ({ rx, ry, cosTheta, sinTheta })=>[
                rx * Math.abs(cosTheta) ** (2 / m) * Math.sign(cosTheta),
                ry * Math.abs(sinTheta) ** (2 / n) * Math.sign(sinTheta)
            ]
    });
}

/**
 * @typedef {object} SquircleOptions
 * @property {number} [sx=1]
 * @property {number} [sy=1]
 * @property {number} [radius=0.5]
 * @property {number} [segments=128]
 * @property {number} [innerSegments=16]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {boolean} [mergeCentroid=true]
 * @property {Function} [mapping=mappings.fgSquircular]
 * @property {number} [squareness=0.95] Squareness (0 < s <= 1)
 */ /**
 * Fernández-Guasti squircle
 * @see [Squircular Calculations – Chamberlain Fong]{@link https://arxiv.org/vc/arxiv/papers/1604/1604.02174v1.pdf}
 *
 * @alias module:squircle
 * @param {SquircleOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function squircle({ sx = 1, sy = 1, radius = 0.5, segments = 128, innerSegments = 16, theta = TAU, thetaOffset = 0, mergeCentroid = true, mapping = fgSquircular, squareness = 0.95 } = {}) {
    checkArguments(arguments);
    return ellipse({
        sx,
        sy,
        radius,
        segments,
        innerSegments,
        theta,
        thetaOffset,
        mergeCentroid,
        mapping,
        equation: ({ rx, ry, cosTheta, sinTheta, t })=>{
            // Fix singularities
            // https://codereview.stackexchange.com/questions/233496/handling-singularities-in-squircle-parametric-equations
            if (t === 0 || t === TAU) {
                return [
                    rx,
                    0
                ];
            } else if (t === HALF_PI) {
                return [
                    0,
                    ry
                ];
            } else if (t === Math.PI) {
                return [
                    -rx,
                    0
                ];
            } else if (t === TAU - HALF_PI) {
                return [
                    0,
                    -ry
                ];
            } else {
                const sqrt = Math.sqrt(1 - Math.sqrt(1 - squareness ** 2 * Math.sin(2 * t) ** 2));
                return [
                    rx * Math.sign(cosTheta) / (squareness * SQRT2 * Math.abs(sinTheta)) * sqrt,
                    ry * Math.sign(sinTheta) / (squareness * SQRT2 * Math.abs(cosTheta)) * sqrt
                ];
            }
        }
    });
}

/**
 * @typedef {object} AnnulusOptions
 * @property {number} [sx=1]
 * @property {number} [sy=1]
 * @property {number} [radius=0.5]
 * @property {number} [segments=32]
 * @property {number} [innerSegments=16]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {number} [innerRadius=radius * 0.5]
 * @property {Function} [mapping=mappings.concentric]
 */ /**
 * @alias module:annulus
 * @param {AnnulusOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function annulus({ sx = 1, sy = 1, radius = 0.5, segments = 32, innerSegments = 16, theta = TAU, thetaOffset = 0, innerRadius = radius * 0.5, mapping = concentric } = {}) {
    checkArguments(arguments);
    return ellipse({
        sx,
        sy,
        radius,
        segments,
        innerSegments,
        theta,
        thetaOffset,
        innerRadius,
        mergeCentroid: false,
        mapping
    });
}

/**
 * @typedef {object} ReuleuxOptions
 * @property {number} [radius=0.5]
 * @property {number} [segments=32]
 * @property {number} [innerSegments=16]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {boolean} [mergeCentroid=true]
 * @property {Function} [mapping=mappings.concentric]
 * @property {number} [n=3]
 */ /**
 * @see [Parametric equations for regular and Reuleaux polygons]{@link https://tpfto.wordpress.com/2011/09/15/parametric-equations-for-regular-and-reuleaux-polygons/}
 *
 * @alias module:reuleux
 * @param {ReuleuxOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function reuleux({ radius = 0.5, segments = 32, innerSegments = 16, theta = TAU, thetaOffset = 0, mergeCentroid = true, mapping = concentric, n = 3 } = {}) {
    checkArguments(arguments);
    const cosN = 2 * Math.cos(Math.PI / (2 * n));
    const PIoverN = Math.PI / n;
    return ellipse({
        sx: 1,
        sy: 1,
        radius,
        segments,
        innerSegments,
        theta,
        thetaOffset,
        mergeCentroid,
        mapping,
        equation: ({ rx, ry, t })=>[
                rx * (cosN * Math.cos(0.5 * (t + PIoverN * (2 * Math.floor(n * t / TAU) + 1))) - Math.cos(PIoverN * (2 * Math.floor(n * t / TAU) + 1))),
                ry * (cosN * Math.sin(0.5 * (t + PIoverN * (2 * Math.floor(n * t / TAU) + 1))) - Math.sin(PIoverN * (2 * Math.floor(n * t / TAU) + 1)))
            ]
    });
}

/**
 * @typedef {object} CubeOptions
 * @property {number} [sx=1]
 * @property {number} [sy=sx]
 * @property {number} [sz=sx]
 * @property {number} [nx=1]
 * @property {number} [ny=nx]
 * @property {number} [nz=nx]
 */ /**
 * @alias module:cube
 * @param {CubeOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function cube({ sx = 1, sy = sx, sz = sx, nx = 1, ny = nx, nz = nx } = {}) {
    checkArguments(arguments);
    const size = (nx + 1) * (ny + 1) * 2 + (nx + 1) * (nz + 1) * 2 + (nz + 1) * (ny + 1) * 2;
    const geometry = {
        positions: new Float32Array(size * 3),
        normals: new Float32Array(size * 3),
        uvs: new Float32Array(size * 2),
        cells: new (getCellsTypedArray(size))((nx * ny * 2 + nx * nz * 2 + nz * ny * 2) * 6)
    };
    const halfSX = sx * 0.5;
    const halfSY = sy * 0.5;
    const halfSZ = sz * 0.5;
    const indices = {
        vertex: 0,
        cell: 0
    };
    computePlane(geometry, indices, sx, sy, nx, ny, "z", halfSZ);
    computePlane(geometry, indices, sx, sy, nx, ny, "-z", -halfSZ);
    computePlane(geometry, indices, sz, sy, nz, ny, "-x", -halfSX);
    computePlane(geometry, indices, sz, sy, nz, ny, "x", halfSX);
    computePlane(geometry, indices, sx, sz, nx, nz, "y", halfSY);
    computePlane(geometry, indices, sx, sz, nx, nz, "-y", -halfSY);
    return geometry;
}

/**
 * @typedef {object} RoundedCubeOptions
 * @property {number} [sx=1]
 * @property {number} [sy=sx]
 * @property {number} [sz=sx]
 * @property {number} [nx=1]
 * @property {number} [ny=nx]
 * @property {number} [nz=nx]
 * @property {number} [radius=sx * 0.25]
 * @property {number} [roundSegments=8]
 * @property {number} [edgeSegments=1]
 */ /**
 * @alias module:roundedCube
 * @param {RoundedCubeOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function roundedCube({ sx = 1, sy = sx, sz = sx, nx = 1, ny = nx, nz = nx, radius = sx * 0.25, roundSegments = 8, edgeSegments = 1 } = {}) {
    checkArguments(arguments);
    const size = (nx + 1) * (ny + 1) * 2 + (nx + 1) * (nz + 1) * 2 + (nz + 1) * (ny + 1) * 2 + (roundSegments + 1) * (roundSegments + 1) * 24 + (roundSegments + 1) * (edgeSegments + 1) * 24;
    const geometry = {
        positions: new Float32Array(size * 3),
        normals: new Float32Array(size * 3),
        uvs: new Float32Array(size * 2),
        cells: new (getCellsTypedArray(size))((nx * ny * 2 + nx * nz * 2 + nz * ny * 2 + roundSegments * roundSegments * 24 + roundSegments * edgeSegments * 24) * 6)
    };
    const halfSX = sx * 0.5;
    const halfSY = sy * 0.5;
    const halfSZ = sz * 0.5;
    const r2 = radius * 2;
    const widthX = sx - r2;
    const widthY = sy - r2;
    const widthZ = sz - r2;
    const faceSX = widthX / sx;
    const faceSY = widthY / sy;
    const faceSZ = widthZ / sz;
    const radiusSX = radius / sx;
    const radiusSY = radius / sy;
    const radiusSZ = radius / sz;
    const indices = {
        vertex: 0,
        cell: 0
    };
    const PLANES = [
        [
            widthX,
            widthY,
            nx,
            ny,
            "z",
            halfSZ,
            [
                faceSX,
                faceSY
            ],
            [
                radiusSX,
                radiusSY
            ],
            (x, y)=>[
                    x,
                    y,
                    0
                ]
        ],
        [
            widthX,
            widthY,
            nx,
            ny,
            "-z",
            -halfSZ,
            [
                faceSX,
                faceSY
            ],
            [
                radiusSX,
                radiusSY
            ],
            (x, y)=>[
                    -x,
                    y,
                    0
                ]
        ],
        [
            widthZ,
            widthY,
            nz,
            ny,
            "-x",
            -halfSX,
            [
                faceSZ,
                faceSY
            ],
            [
                radiusSZ,
                radiusSY
            ],
            (x, y)=>[
                    0,
                    y,
                    x
                ]
        ],
        [
            widthZ,
            widthY,
            nz,
            ny,
            "x",
            halfSX,
            [
                faceSZ,
                faceSY
            ],
            [
                radiusSZ,
                radiusSY
            ],
            (x, y)=>[
                    0,
                    y,
                    -x
                ]
        ],
        [
            widthX,
            widthZ,
            nx,
            nz,
            "y",
            halfSY,
            [
                faceSX,
                faceSZ
            ],
            [
                radiusSX,
                radiusSZ
            ],
            (x, y)=>[
                    x,
                    0,
                    -y
                ]
        ],
        [
            widthX,
            widthZ,
            nx,
            nz,
            "-y",
            -halfSY,
            [
                faceSX,
                faceSZ
            ],
            [
                radiusSX,
                radiusSZ
            ],
            (x, y)=>[
                    x,
                    0,
                    y
                ]
        ]
    ];
    const uvOffsetCorner = (su, sv)=>[
            [
                0,
                0
            ],
            [
                1 - radius / (su + r2),
                0
            ],
            [
                1 - radius / (su + r2),
                1 - radius / (sv + r2)
            ],
            [
                0,
                1 - radius / (sv + r2)
            ]
        ];
    const uvOffsetStart = (_, sv)=>[
            0,
            radius / (sv + r2)
        ];
    const uvOffsetEnd = (su, sv)=>[
            1 - radius / (su + r2),
            radius / (sv + r2)
        ];
    for(let j = 0; j < PLANES.length; j++){
        const [su, sv, nu, nv, direction, pw, uvScale, uvOffset, center] = PLANES[j];
        // Cube faces
        computePlane(geometry, indices, su, sv, nu, nv, direction, pw, false, uvScale, uvOffset);
        // Corner order: ccw uv-like order and L/B (0) R/T (2)
        // 0,1 -- 1,1
        //  |  --  |
        // 0,0 -- 1,0
        for(let i = 0; i < 4; i++){
            const ceil = Math.ceil(i / 2) % 2;
            const floor = Math.floor(i / 2) % 2;
            const x = (ceil === 0 ? -1 : 1) * (su + radius) * 0.5;
            const y = (floor === 0 ? -1 : 1) * (sv + radius) * 0.5;
            // Corners
            computePlane(geometry, indices, radius, radius, roundSegments, roundSegments, direction, pw, false, [
                radius / (su + r2),
                radius / (sv + r2)
            ], uvOffsetCorner(su, sv)[i], center(x, y));
            // Edges
            if (i === 0 || i === 2) {
                // Left / Right
                computePlane(geometry, indices, radius, sv, roundSegments, edgeSegments, direction, pw, false, [
                    uvOffset[0],
                    uvScale[1]
                ], ceil === 0 ? uvOffsetStart(su, sv) : uvOffsetEnd(su, sv), center(x, 0));
                // Bottom/Top
                computePlane(geometry, indices, su, radius, edgeSegments, roundSegments, direction, pw, false, [
                    uvScale[0],
                    uvOffset[1]
                ], floor === 0 ? [
                    ...uvOffsetStart(sv, su)
                ].reverse() : [
                    ...uvOffsetEnd(sv, su)
                ].reverse(), center(0, y));
            }
        }
    }
    const rx = widthX * 0.5;
    const ry = widthY * 0.5;
    const rz = widthZ * 0.5;
    for(let i = 0; i < geometry.positions.length; i += 3){
        const position = [
            geometry.positions[i],
            geometry.positions[i + 1],
            geometry.positions[i + 2]
        ];
        TMP[0] = position[0];
        TMP[1] = position[1];
        TMP[2] = position[2];
        if (position[0] < -rx) {
            position[0] = -rx;
        } else if (position[0] > rx) {
            position[0] = rx;
        }
        if (position[1] < -ry) {
            position[1] = -ry;
        } else if (position[1] > ry) {
            position[1] = ry;
        }
        if (position[2] < -rz) {
            position[2] = -rz;
        } else if (position[2] > rz) {
            position[2] = rz;
        }
        TMP[0] -= position[0];
        TMP[1] -= position[1];
        TMP[2] -= position[2];
        normalize(TMP);
        geometry.normals[i] = TMP[0];
        geometry.normals[i + 1] = TMP[1];
        geometry.normals[i + 2] = TMP[2];
        geometry.positions[i] = position[0] + radius * TMP[0];
        geometry.positions[i + 1] = position[1] + radius * TMP[1];
        geometry.positions[i + 2] = position[2] + radius * TMP[2];
    }
    return geometry;
}

/**
 * @typedef {object} EllipsoidOptions
 * @property {number} [radius=0.5]
 * @property {number} [nx=32]
 * @property {number} [ny=16]
 * @property {number} [rx=1]
 * @property {number} [ry=0.5]
 * @property {number} [rz=ry]
 * @property {number} [theta=Math.PI]
 * @property {number} [thetaOffset=0]
 * @property {number} [phi=TAU]
 * @property {number} [phiOffset=0]
 */ /**
 * Default to an oblate spheroid.
 * @alias module:ellipsoid
 * @param {EllipsoidOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function ellipsoid({ radius = 1, nx = 32, ny = 16, rx = 0.5, ry = 0.25, rz = ry, theta = Math.PI, thetaOffset = 0, phi = TAU, phiOffset = 0 } = {}) {
    checkArguments(arguments);
    const size = (ny + 1) * (nx + 1);
    const positions = new Float32Array(size * 3);
    const normals = new Float32Array(size * 3);
    const uvs = new Float32Array(size * 2);
    const cells = new (getCellsTypedArray(size))(ny * nx * 6);
    let vertexIndex = 0;
    let cellIndex = 0;
    for(let y = 0; y <= ny; y++){
        const v = y / ny;
        const t = v * theta + thetaOffset;
        const cosTheta = Math.cos(t);
        const sinTheta = Math.sin(t);
        for(let x = 0; x <= nx; x++){
            const u = x / nx;
            const p = u * phi + phiOffset;
            const cosPhi = Math.cos(p);
            const sinPhi = Math.sin(p);
            TMP[0] = -rx * cosPhi * sinTheta;
            TMP[1] = -ry * cosTheta;
            TMP[2] = rz * sinPhi * sinTheta;
            positions[vertexIndex * 3] = radius * TMP[0];
            positions[vertexIndex * 3 + 1] = radius * TMP[1];
            positions[vertexIndex * 3 + 2] = radius * TMP[2];
            normalize(TMP);
            normals[vertexIndex * 3] = TMP[0];
            normals[vertexIndex * 3 + 1] = TMP[1];
            normals[vertexIndex * 3 + 2] = TMP[2];
            uvs[vertexIndex * 2] = u;
            uvs[vertexIndex * 2 + 1] = v;
            vertexIndex++;
        }
        if (y > 0) {
            for(let i = vertexIndex - 2 * (nx + 1); i + nx + 2 < vertexIndex; i++){
                const a = i;
                const b = i + 1;
                const c = i + nx + 1;
                const d = i + nx + 2;
                cells[cellIndex] = a;
                cells[cellIndex + 1] = b;
                cells[cellIndex + 2] = c;
                cells[cellIndex + 3] = c;
                cells[cellIndex + 4] = b;
                cells[cellIndex + 5] = d;
                cellIndex += 6;
            }
        }
    }
    return {
        positions,
        normals,
        uvs,
        cells
    };
}

/**
 * @typedef {object} SphereOptions
 * @property {number} [radius=0.5]
 * @property {number} [nx=32]
 * @property {number} [ny=16]
 * @property {number} [theta=Math.PI]
 * @property {number} [thetaOffset=0]
 * @property {number} [phi=TAU]
 * @property {number} [phiOffset=0]
 */ /**
 * @alias module:sphere
 * @param {SphereOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function sphere({ radius = 0.5, nx = 32, ny = 16, theta, thetaOffset, phi, phiOffset } = {}) {
    checkArguments(arguments);
    return ellipsoid({
        radius,
        nx,
        ny,
        theta,
        thetaOffset,
        phi,
        phiOffset,
        rx: 1,
        ry: 1
    });
}

const f = 0.5 + Math.sqrt(5) / 2;
/**
 * @typedef {object} IcosphereOptions
 * @property {number} [radius=0.5]
 * @property {number} [subdivisions=2]
 */ /**
 * @alias module:icosphere
 * @param {IcosphereOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function icosphere({ radius = 0.5, subdivisions = 2 } = {}) {
    checkArguments(arguments);
    if (subdivisions > 10) throw new Error("Max subdivisions is 10.");
    const T = Math.pow(4, subdivisions);
    const numVertices = 10 * T + 2;
    const numDuplicates = subdivisions === 0 ? 3 : Math.pow(2, subdivisions) * 3 + 9;
    const size = numVertices + numDuplicates;
    const positions = new Float32Array(size * 3);
    const uvs = new Float32Array(size * 2);
    // prettier-ignore
    positions.set(Float32Array.of(-1, f, 0, 1, f, 0, -1, -f, 0, 1, -f, 0, 0, -1, f, 0, 1, f, 0, -1, -f, 0, 1, -f, f, 0, -1, f, 0, 1, -f, 0, -1, -f, 0, 1));
    // prettier-ignore
    let cells = Uint16Array.of(0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 11, 10, 2, 5, 11, 4, 1, 5, 9, 7, 1, 8, 10, 7, 6, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 9, 8, 1, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7);
    let vertexIndex = 12;
    const midCache = subdivisions ? {} : null;
    function addMidPoint(a, b) {
        // Cantor's pairing function
        const key = Math.floor((a + b) * (a + b + 1) / 2 + Math.min(a, b));
        const i = midCache[key];
        if (i !== undefined) {
            delete midCache[key];
            return i;
        }
        midCache[key] = vertexIndex;
        positions[3 * vertexIndex + 0] = (positions[3 * a + 0] + positions[3 * b + 0]) * 0.5;
        positions[3 * vertexIndex + 1] = (positions[3 * a + 1] + positions[3 * b + 1]) * 0.5;
        positions[3 * vertexIndex + 2] = (positions[3 * a + 2] + positions[3 * b + 2]) * 0.5;
        return vertexIndex++;
    }
    let cellsPrev = cells;
    const IndexArray = subdivisions > 5 ? Uint32Array : getCellsTypedArray(size);
    // Subdivide
    for(let i = 0; i < subdivisions; i++){
        const prevLen = cellsPrev.length;
        cells = new IndexArray(prevLen * 4);
        for(let k = 0; k < prevLen; k += 3){
            const v1 = cellsPrev[k + 0];
            const v2 = cellsPrev[k + 1];
            const v3 = cellsPrev[k + 2];
            const a = addMidPoint(v1, v2);
            const b = addMidPoint(v2, v3);
            const c = addMidPoint(v3, v1);
            cells[k * 4 + 0] = v1;
            cells[k * 4 + 1] = a;
            cells[k * 4 + 2] = c;
            cells[k * 4 + 3] = v2;
            cells[k * 4 + 4] = b;
            cells[k * 4 + 5] = a;
            cells[k * 4 + 6] = v3;
            cells[k * 4 + 7] = c;
            cells[k * 4 + 8] = b;
            cells[k * 4 + 9] = a;
            cells[k * 4 + 10] = b;
            cells[k * 4 + 11] = c;
        }
        cellsPrev = cells;
    }
    // Normalize
    for(let i = 0; i < numVertices * 3; i += 3){
        const v1 = positions[i + 0];
        const v2 = positions[i + 1];
        const v3 = positions[i + 2];
        const m = 1 / Math.sqrt(v1 * v1 + v2 * v2 + v3 * v3);
        positions[i + 0] *= m;
        positions[i + 1] *= m;
        positions[i + 2] *= m;
    }
    for(let i = 0; i < numVertices; i++){
        uvs[2 * i + 0] = -Math.atan2(positions[3 * i + 2], positions[3 * i]) / TAU + 0.5;
        uvs[2 * i + 1] = Math.asin(positions[3 * i + 1]) / Math.PI + 0.5;
    }
    const duplicates = {};
    function addDuplicate(i, uvx, uvy, cached) {
        if (cached) {
            const dupe = duplicates[i];
            if (dupe !== undefined) return dupe;
        }
        positions[3 * vertexIndex + 0] = positions[3 * i + 0];
        positions[3 * vertexIndex + 1] = positions[3 * i + 1];
        positions[3 * vertexIndex + 2] = positions[3 * i + 2];
        uvs[2 * vertexIndex + 0] = uvx;
        uvs[2 * vertexIndex + 1] = uvy;
        if (cached) duplicates[i] = vertexIndex;
        return vertexIndex++;
    }
    for(let i = 0; i < cells.length; i += 3){
        const a = cells[i + 0];
        const b = cells[i + 1];
        const c = cells[i + 2];
        let ax = uvs[2 * a];
        let bx = uvs[2 * b];
        let cx = uvs[2 * c];
        const ay = uvs[2 * a + 1];
        const by = uvs[2 * b + 1];
        const cy = uvs[2 * c + 1];
        if (ax - bx >= 0.5 && ay !== 1) bx += 1;
        if (bx - cx > 0.5) cx += 1;
        if (ax < 0.5 && cx - ax > 0.5 || ax === 1 && cy === 0) ax += 1;
        if (bx < 0.5 && ax - bx > 0.5) bx += 1;
        // Poles
        const isPoleA = ay === 0 || ay === 1;
        const isPoleB = by === 0 || by === 1;
        const isPoleC = cy === 0 || cy === 1;
        if (isPoleA) {
            ax = (bx + cx) * 0.5;
            if (ay === 1 - bx) {
                uvs[2 * a] = ax;
            } else {
                cells[i + 0] = addDuplicate(a, ax, ay, false);
            }
        } else if (isPoleB) {
            bx = (ax + cx) * 0.5;
            if (by === ax) {
                uvs[2 * b] = bx;
            } else {
                cells[i + 1] = addDuplicate(b, bx, by, false);
            }
        } else if (isPoleC) {
            cx = (ax + bx) * 0.5;
            if (cy === ax) {
                uvs[2 * c] = cx;
            } else {
                cells[i + 2] = addDuplicate(c, cx, cy, false);
            }
        }
        // Seam zipper
        if (ax !== uvs[2 * a] && !isPoleA) {
            cells[i + 0] = addDuplicate(a, ax, ay, true);
        }
        if (bx !== uvs[2 * b] && !isPoleB) {
            cells[i + 1] = addDuplicate(b, bx, by, true);
        }
        if (cx !== uvs[2 * c] && !isPoleC) {
            cells[i + 2] = addDuplicate(c, cx, cy, true);
        }
    }
    return {
        positions: positions.map((v)=>v * radius),
        normals: positions,
        uvs,
        cells
    };
}

/**
 * @typedef {object} CylinderOptions
 * @property {number} [height=1]
 * @property {number} [radius=0.25]
 * @property {number} [nx=16]
 * @property {number} [ny=1]
 * @property {number} [radiusApex=radius]
 * @property {number} [capSegments=1]
 * @property {boolean} [capApex=true]
 * @property {boolean} [capBase=true]
 * @property {number} [phi=TAU]
 */ /**
 * @alias module:cylinder
 * @param {CylinderOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function cylinder({ height = 1, radius = 0.25, nx = 16, ny = 1, radiusApex = radius, capSegments = 1, capApex = true, capBase = true, capBaseSegments = capSegments, phi = TAU } = {}) {
    checkArguments(arguments);
    let capCount = 0;
    if (capApex) capCount += capSegments;
    if (capBase) capCount += capBaseSegments;
    const segments = nx + 1;
    const slices = ny + 1;
    const size = segments * slices + segments * 2 * capCount;
    const positions = new Float32Array(size * 3);
    const normals = new Float32Array(size * 3);
    const uvs = new Float32Array(size * 2);
    const cells = new (getCellsTypedArray(size))((nx * ny + nx * capCount) * 6);
    let vertexIndex = 0;
    let cellIndex = 0;
    const halfHeight = height / 2;
    const segmentIncrement = 1 / (segments - 1);
    const ringIncrement = 1 / (slices - 1);
    for(let i = 0; i < segments; i++){
        const u = i * segmentIncrement;
        for(let j = 0; j < slices; j++){
            const v = j * ringIncrement;
            const p = u * phi;
            const cosPhi = -Math.cos(p);
            const sinPhi = Math.sin(p);
            const r = radius * (1 - v) + radiusApex * v;
            positions[vertexIndex * 3] = r * cosPhi;
            positions[vertexIndex * 3 + 1] = height * v - halfHeight;
            positions[vertexIndex * 3 + 2] = r * sinPhi;
            TMP[0] = height * cosPhi;
            TMP[1] = radius - radiusApex;
            TMP[2] = height * sinPhi;
            normalize(TMP);
            normals[vertexIndex * 3] = TMP[0];
            normals[vertexIndex * 3 + 1] = TMP[1];
            normals[vertexIndex * 3 + 2] = TMP[2];
            uvs[vertexIndex * 2] = u;
            uvs[vertexIndex * 2 + 1] = v;
            vertexIndex++;
        }
    }
    for(let j = 0; j < slices - 1; j++){
        for(let i = 0; i < segments - 1; i++){
            cells[cellIndex + 0] = (i + 0) * slices + (j + 0);
            cells[cellIndex + 1] = (i + 1) * slices + (j + 0);
            cells[cellIndex + 2] = (i + 1) * slices + (j + 1);
            cells[cellIndex + 3] = (i + 0) * slices + (j + 0);
            cells[cellIndex + 4] = (i + 1) * slices + (j + 1);
            cells[cellIndex + 5] = (i + 0) * slices + (j + 1);
            cellIndex += 6;
        }
    }
    function computeCap(flip, height, radius, capSegments) {
        const index = vertexIndex;
        const segmentIncrement = 1 / (segments - 1);
        for(let r = 0; r < capSegments; r++){
            for(let i = 0; i < segments; i++){
                const p = i * segmentIncrement * phi;
                const cosPhi = -Math.cos(p);
                const sinPhi = Math.sin(p);
                // inner point
                positions[vertexIndex * 3] = radius * cosPhi * r / capSegments;
                positions[vertexIndex * 3 + 1] = height;
                positions[vertexIndex * 3 + 2] = radius * sinPhi * r / capSegments;
                normals[vertexIndex * 3 + 1] = -flip;
                uvs[vertexIndex * 2] = 0.5 * cosPhi * r / capSegments + 0.5;
                uvs[vertexIndex * 2 + 1] = 0.5 * sinPhi * r / capSegments + 0.5;
                vertexIndex++;
                // outer point
                positions[vertexIndex * 3] = radius * cosPhi * (r + 1) / capSegments;
                positions[vertexIndex * 3 + 1] = height;
                positions[vertexIndex * 3 + 2] = radius * sinPhi * (r + 1) / capSegments;
                normals[vertexIndex * 3 + 1] = -flip;
                uvs[vertexIndex * 2] = 0.5 * (cosPhi * (r + 1)) / capSegments + 0.5;
                uvs[vertexIndex * 2 + 1] = 0.5 * (sinPhi * (r + 1)) / capSegments + 0.5;
                vertexIndex++;
            }
        }
        for(let r = 0; r < capSegments; r++){
            for(let i = 0; i < segments - 1; i++){
                const n = index + r * segments * 2 + i * 2;
                const a = n + 0;
                const b = n + 1;
                const c = n + 2;
                const d = n + 3;
                if (flip === 1) {
                    cells[cellIndex] = a;
                    cells[cellIndex + 1] = c;
                    cells[cellIndex + 2] = d;
                    cells[cellIndex + 3] = a;
                    cells[cellIndex + 4] = d;
                    cells[cellIndex + 5] = b;
                } else {
                    cells[cellIndex + 0] = a;
                    cells[cellIndex + 1] = d;
                    cells[cellIndex + 2] = c;
                    cells[cellIndex + 3] = a;
                    cells[cellIndex + 4] = b;
                    cells[cellIndex + 5] = d;
                }
                cellIndex += 6;
            }
        }
    }
    if (capBase) computeCap(1, -halfHeight, radius, capBaseSegments);
    if (capApex) computeCap(-1, halfHeight, radiusApex, capSegments);
    return {
        positions,
        normals,
        uvs,
        cells
    };
}

/**
 * @typedef {object} ConeOptions
 * @property {number} [height=1]
 * @property {number} [radius=0.25]
 * @property {number} [nx=16]
 * @property {number} [ny=1]
 * @property {number} [capSegments=1]
 * @property {boolean} [capBase=true]
 * @property {number} [phi=TAU]
 */ /**
 * @alias module:cone
 * @param {ConeOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function cone({ height, radius, nx, ny, capSegments, capBase, phi } = {}) {
    checkArguments(arguments);
    return cylinder({
        height,
        radius,
        nx,
        ny,
        capSegments,
        capBase,
        phi,
        radiusApex: 0,
        capApex: false
    });
}

/**
 * @typedef {object} CapsuleOptions
 * @property {number} [height=0.5]
 * @property {number} [radius=0.25]
 * @property {number} [nx=16]
 * @property {number} [ny=1]
 * @property {number} [roundSegments=32]
 * @property {number} [phi=TAU]
 */ /**
 * @alias module:capsule
 * @param {CapsuleOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function capsule({ height = 0.5, radius = 0.25, nx = 16, ny = 1, roundSegments = 16, phi = TAU } = {}) {
    checkArguments(arguments);
    const ringsBody = ny + 1;
    const ringsCap = roundSegments * 2;
    const ringsTotal = ringsCap + ringsBody;
    const size = ringsTotal * nx;
    const positions = new Float32Array(size * 3);
    const normals = new Float32Array(size * 3);
    const uvs = new Float32Array(size * 2);
    const cells = new (getCellsTypedArray(size))((ringsTotal - 1) * (nx - 1) * 6);
    let vertexIndex = 0;
    let cellIndex = 0;
    const segmentIncrement = 1 / (nx - 1);
    const ringIncrement = 1 / (ringsCap - 1);
    const bodyIncrement = 1 / (ringsBody - 1);
    function computeRing(r, y, dy) {
        for(let s = 0; s < nx; s++, vertexIndex++){
            const x = -Math.cos(s * segmentIncrement * phi) * r;
            const z = Math.sin(s * segmentIncrement * phi) * r;
            const py = radius * y + height * dy;
            positions[vertexIndex * 3] = radius * x;
            positions[vertexIndex * 3 + 1] = py;
            positions[vertexIndex * 3 + 2] = radius * z;
            normals[vertexIndex * 3] = x;
            normals[vertexIndex * 3 + 1] = y;
            normals[vertexIndex * 3 + 2] = z;
            uvs[vertexIndex * 2] = s * segmentIncrement;
            uvs[vertexIndex * 2 + 1] = 1 - (0.5 - py / (2 * radius + height));
        }
    }
    for(let r = 0; r < roundSegments; r++){
        computeRing(Math.sin(Math.PI * r * ringIncrement), Math.sin(Math.PI * (r * ringIncrement - 0.5)), -0.5);
    }
    for(let r = 0; r < ringsBody; r++){
        computeRing(1, 0, r * bodyIncrement - 0.5);
    }
    for(let r = roundSegments; r < ringsCap; r++){
        computeRing(Math.sin(Math.PI * r * ringIncrement), Math.sin(Math.PI * (r * ringIncrement - 0.5)), 0.5);
    }
    for(let r = 0; r < ringsTotal - 1; r++){
        for(let s = 0; s < nx - 1; s++){
            const a = r * nx;
            const b = (r + 1) * nx;
            const s1 = s + 1;
            cells[cellIndex] = a + s;
            cells[cellIndex + 1] = a + s1;
            cells[cellIndex + 2] = b + s1;
            cells[cellIndex + 3] = a + s;
            cells[cellIndex + 4] = b + s1;
            cells[cellIndex + 5] = b + s;
            cellIndex += 6;
        }
    }
    return {
        positions,
        normals,
        uvs,
        cells
    };
}

/**
 * @typedef {object} TorusOptions
 * @property {number} [radius=0.4]
 * @property {number} [segments=64]
 * @property {number} [minorRadius=0.1]
 * @property {number} [minorSegments=32]
 * @property {number} [theta=TAU]
 * @property {number} [thetaOffset=0]
 * @property {number} [phi=TAU]
 * @property {number} [phiOffset=0]
 */ /**
 * @alias module:torus
 * @param {TorusOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function torus({ radius = 0.4, segments = 64, minorRadius = 0.1, minorSegments = 32, theta = TAU, thetaOffset = 0, phi = TAU, phiOffset = 0 } = {}) {
    checkArguments(arguments);
    const size = (minorSegments + 1) * (segments + 1);
    const positions = new Float32Array(size * 3);
    const normals = new Float32Array(size * 3);
    const uvs = new Float32Array(size * 2);
    const cells = new (getCellsTypedArray(size))(minorSegments * segments * 6);
    let vertexIndex = 0;
    let cellIndex = 0;
    for(let j = 0; j <= minorSegments; j++){
        const v = j / minorSegments;
        for(let i = 0; i <= segments; i++, vertexIndex++){
            const u = i / segments;
            const p = u * phi + phiOffset;
            const cosPhi = -Math.cos(p);
            const sinPhi = Math.sin(p);
            const t = v * theta + thetaOffset;
            const cosTheta = -Math.cos(t);
            const sinTheta = Math.sin(t);
            TMP[0] = (radius + minorRadius * cosTheta) * cosPhi;
            TMP[1] = (radius + minorRadius * cosTheta) * sinPhi;
            TMP[2] = minorRadius * sinTheta;
            positions[vertexIndex * 3] = TMP[0];
            positions[vertexIndex * 3 + 1] = TMP[1];
            positions[vertexIndex * 3 + 2] = TMP[2];
            TMP[0] -= radius * cosPhi;
            TMP[1] -= radius * sinPhi;
            normalize(TMP);
            normals[vertexIndex * 3] = TMP[0];
            normals[vertexIndex * 3 + 1] = TMP[1];
            normals[vertexIndex * 3 + 2] = TMP[2];
            uvs[vertexIndex * 2] = u;
            uvs[vertexIndex * 2 + 1] = v;
            if (j > 0 && i > 0) {
                const a = (segments + 1) * j + i - 1;
                const b = (segments + 1) * (j - 1) + i - 1;
                const c = (segments + 1) * (j - 1) + i;
                const d = (segments + 1) * j + i;
                cells[cellIndex] = a;
                cells[cellIndex + 1] = b;
                cells[cellIndex + 2] = d;
                cells[cellIndex + 3] = b;
                cells[cellIndex + 4] = c;
                cells[cellIndex + 5] = d;
                cellIndex += 6;
            }
        }
    }
    return {
        positions,
        normals,
        uvs,
        cells
    };
}

/**
 * @typedef {object} TetrahedronOptions
 * @property {number} [radius=0.5]
 */ /**
 * @alias module:tetrahedron
 * @param {TetrahedronOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function tetrahedron({ radius = 0.5 } = {}) {
    checkArguments(arguments);
    return cylinder({
        height: radius * 1.5,
        radius,
        nx: 3,
        ny: 1,
        radiusApex: 0,
        capSegments: 0,
        capApex: false,
        capBaseSegments: 1
    });
}

/**
 * @typedef {object} IcosahedronOptions
 * @property {number} [radius=0.5]
 */ /**
 * @alias module:icosahedron
 * @param {IcosahedronOptions} [options={}]
 * @returns {import("../types.js").SimplicialComplex}
 */ function icosahedron({ radius } = {}) {
    checkArguments(arguments);
    return icosphere({
        subdivisions: 0,
        radius
    });
}

export { annulus, box, capsule, circle, cone, cube, cylinder, disc, ellipse, ellipsoid, icosahedron, icosphere, mappings, plane, quad, reuleux, roundedCube, roundedRectangle, sphere, squircle, stadium, superellipse, tetrahedron, torus, utils };
