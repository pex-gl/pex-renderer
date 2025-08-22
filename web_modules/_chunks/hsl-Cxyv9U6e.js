const setAlpha = (color, a)=>{
    if (a !== undefined) color[3] = a;
    return color;
};
const floorArray = (color, precision = 5)=>{
    const p = 10 ** precision;
    color.forEach((n, i)=>color[i] = Math.floor((n + Number.EPSILON) * p) / p);
    return color;
};
const transformMat3 = (a, m)=>{
    const x = a[0];
    const y = a[1];
    const z = a[2];
    a[0] = x * m[0] + y * m[3] + z * m[6];
    a[1] = x * m[1] + y * m[4] + z * m[7];
    a[2] = x * m[2] + y * m[5] + z * m[8];
    return a;
};
const cubed3 = (lms)=>{
    lms[0] = lms[0] ** 3;
    lms[1] = lms[1] ** 3;
    lms[2] = lms[2] ** 3;
};
const cbrt3 = (lms)=>{
    lms[0] = Math.cbrt(lms[0]);
    lms[1] = Math.cbrt(lms[1]);
    lms[2] = Math.cbrt(lms[2]);
};
const TMP = [
    0,
    0,
    0
];
const TAU = 2 * Math.PI;
/**
 * Illuminant D65: x,y,z tristimulus values
 * @see {@link https://en.wikipedia.org/wiki/Standard_illuminant#White_points_of_standard_illuminants}
 */ const D65 = [
    0.3127 / 0.329,
    1,
    (1 - 0.3127 - 0.329) / 0.329
];
/**
 * Illuminant D50: x,y,z tristimulus values
 */ const D50 = [
    0.3457 / 0.3585,
    1,
    (1 - 0.3457 - 0.3585) / 0.3585
];
// Linear/sRGB
/**
 * Convert component from linear value
 * @param {number} c
 * @returns {number}
 */ const linearToSrgb = (c)=>c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
/**
 * Convert component to linear value
 * @param {number} c
 * @returns {number}
 */ const srgbToLinear = (c)=>c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
/**
 * Return a RGB representation from Linear values.
 * @param {number} lr
 * @param {number} lg
 * @param {number} lb
 * @param {Array} out
 * @returns {import("./color.js").color}
 */ const linearToRgb = (lr, lg, lb, out)=>{
    out[0] = linearToSrgb(lr);
    out[1] = linearToSrgb(lg);
    out[2] = linearToSrgb(lb);
    return out;
};
/**
 * Return a Linear representation from RGB values.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {Array} out
 * @returns {import("./linear.js").linear}
 */ const rgbToLinear = (r, g, b, out)=>{
    out[0] = srgbToLinear(r);
    out[1] = srgbToLinear(g);
    out[2] = srgbToLinear(b);
    return out;
};
// XYZ/Linear/P3
// https://github.com/hsluv/hsluv-javascript/blob/14b49e6cf9a9137916096b8487a5372626b57ba4/src/hsluv.ts#L8-L16
// prettier-ignore
const mXYZD65ToLinearsRGB = [
    3.240969941904521,
    -0.96924363628087,
    0.055630079696993,
    -1.537383177570093,
    1.87596750150772,
    -0.20397695888897,
    -0.498610760293,
    0.041555057407175,
    1.056971514242878
];
// https://github.com/hsluv/hsluv-javascript/blob/14b49e6cf9a9137916096b8487a5372626b57ba4/src/hsluv.ts#L152-L154
// prettier-ignore
const mLinearsRGBToXYZD65 = [
    0.41239079926595,
    0.21263900587151,
    0.019330818715591,
    0.35758433938387,
    0.71516867876775,
    0.11919477979462,
    0.18048078840183,
    0.072192315360733,
    0.95053215224966
];
// https://github.com/Evercoder/culori/tree/main/src/xyz50
// prettier-ignore
const mXYZD50ToLinearsRGB = [
    3.1341359569958707,
    -0.978795502912089,
    0.07195537988411677,
    -1.6173863321612538,
    1.916254567259524,
    -0.2289768264158322,
    -0.4906619460083532,
    0.03344273116131949,
    1.405386058324125
];
const mLinearsRGBToXYZD50 = [
    0.436065742824811,
    0.22249319175623702,
    0.013923904500943465,
    0.3851514688337912,
    0.7168870538238823,
    0.09708128566574634,
    0.14307845442264197,
    0.06061979053616537,
    0.7140993584005155
];
// http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
// https://drafts.csswg.org/css-color/#color-conversion-code
// prettier-ignore
const mLinearP3ToXYZD65 = [
    0.4865709486482162,
    0.2289745640697488,
    0,
    0.26566769316909306,
    0.6917385218365064,
    0.04511338185890264,
    0.1982172852343625,
    0.079286914093745,
    1.043944368900976
];
// prettier-ignore
const mXYZD65ToLinearP3 = [
    2.493496911941425,
    -0.8294889695615747,
    0.03584583024378447,
    -0.9313836179191239,
    1.7626640603183463,
    -0.07617238926804182,
    -0.40271078445071684,
    0.023624685841943577,
    0.9568845240076872
];
/**
 * Return a Linear representation from XYZ values with D65 illuminant.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Array} out
 * @returns {import("./linear.js").linear}
 */ const xyzD65ToLinear = (x, y, z, out)=>{
    fromValues(out, x, y, z);
    return transformMat3(out, mXYZD65ToLinearsRGB);
};
/**
 * Return a XYZ representation with D65 illuminant from Linear values.
 * @param {number} lr
 * @param {number} lg
 * @param {number} lb
 * @param {Array} out
 * @returns {import("./xyz.js").xyz}
 */ const linearToXyzD65 = (lr, lg, lb, out)=>{
    fromValues(out, lr, lg, lb);
    return transformMat3(out, mLinearsRGBToXYZD65);
};
/**
 * Return a Linear representation from XYZ values with D50 illuminant.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Array} out
 * @returns {import("./linear.js").linear}
 */ const xyzD50ToLinear = (x, y, z, out)=>{
    fromValues(out, x, y, z);
    return transformMat3(out, mXYZD50ToLinearsRGB);
};
/**
 * Return a XYZ representation with D50 illuminant from Linear values.
 * @param {number} lr
 * @param {number} lg
 * @param {number} lb
 * @param {Array} out
 * @returns {import("./xyz.js").xyz}
 */ const linearToXyzD50 = (lr, lg, lb, out)=>{
    fromValues(out, lr, lg, lb);
    return transformMat3(out, mLinearsRGBToXYZD50);
};
/**
 * Return a XYZ representation with D65 illuminant from Linear P3 values.
 * @param {number} lr
 * @param {number} lg
 * @param {number} lb
 * @param {Array} out
 * @returns {import("./xyz.js").xyz}
 */ const linearP3ToXyzD65 = (lr, lg, lb, out)=>{
    fromValues(out, lr, lg, lb);
    return transformMat3(out, mLinearP3ToXYZD65);
};
/**
 * Return a Linear P3 representation from XYZ values with D65 illuminant.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Array} out
 * @returns {Array} P3 Linear
 */ const xyzD65ToLinearP3 = (x, y, z, out)=>{
    fromValues(out, x, y, z);
    return transformMat3(out, mXYZD65ToLinearP3);
};
// Luv
// https://github.com/hsluv/hsluv-javascript/blob/main/src/hsluv.ts
const L_EPSILON = 1e-10;
const REF_U = 0.19783000664283;
const REF_V = 0.46831999493879;
const KAPPA = 9.032962962;
const EPSILON = 0.000088564516;
const yToL = (Y)=>Y <= EPSILON ? Y * KAPPA : 1.16 * Y ** (1 / 3) - 0.16;
const lToY = (L)=>L <= 0.08 ? L / KAPPA : ((L + 0.16) / 1.16) ** 3;
const xyzToLuv = (X, Y, Z, out)=>{
    const divider = X + 15 * Y + 3 * Z;
    let varU = 4 * X;
    let varV = 9 * Y;
    if (divider !== 0) {
        varU /= divider;
        varV /= divider;
    } else {
        varU = NaN;
        varV = NaN;
    }
    const L = yToL(Y);
    if (L === 0) {
        out[0] = out[1] = out[2] = 0;
        return out;
    }
    out[0] = L;
    out[1] = 13 * L * (varU - REF_U);
    out[2] = 13 * L * (varV - REF_V);
    return out;
};
const luvToXyz = (L, U, V, out)=>{
    if (L === 0) {
        out[0] = out[1] = out[2] = 0;
        return out;
    }
    const varU = U / (13 * L) + REF_U;
    const varV = V / (13 * L) + REF_V;
    const Y = lToY(L);
    const X = 0 - 9 * Y * varU / ((varU - 4) * varV - varU * varV);
    out[0] = X;
    out[1] = Y;
    out[2] = (9 * Y - 15 * varV * Y - varV * X) / (3 * varV);
    return out;
};
const luvToLch = (L, U, V, out)=>{
    const C = Math.sqrt(U * U + V * V);
    let H;
    if (C < L_EPSILON) {
        H = 0;
    } else {
        H = Math.atan2(V, U) / TAU;
        if (H < 0) H = 1 + H;
    }
    out[0] = L;
    out[1] = C;
    out[2] = H;
    return out;
};
const lchToLuv = (L, C, H, out)=>{
    const Hrad = H * TAU;
    out[0] = L;
    out[1] = Math.cos(Hrad) * C;
    out[2] = Math.sin(Hrad) * C;
    return out;
};
// HPLuv/HSLuv
const hpLuvOrHsluvToLch = (H, S, L, out, getChroma)=>{
    if (L > 1 - L_EPSILON) {
        out[0] = 1;
        out[1] = 0;
    } else if (L < L_EPSILON) {
        out[0] = out[1] = 0;
    } else {
        out[0] = L;
        out[1] = getChroma(L, H) * S;
    }
    out[2] = H;
    return out;
};
const lchToHpluvOrHsluv = (L, C, H, out, getChroma)=>{
    out[0] = H;
    if (L > 1 - L_EPSILON) {
        out[1] = 0;
        out[2] = 1;
    } else if (L < L_EPSILON) {
        out[1] = out[2] = 0;
    } else {
        out[1] = C / getChroma(L, H);
        out[2] = L;
    }
    return out;
};
// TODO: normalize
const getBounds = (L)=>{
    const result = [];
    const sub1 = (L + 16) ** 3 / 1560896;
    const sub2 = sub1 > EPSILON ? sub1 : L / KAPPA;
    let _g = 0;
    while(_g < 3){
        const c = _g++;
        const m1 = mXYZD65ToLinearsRGB[c];
        const m2 = mXYZD65ToLinearsRGB[c + 3];
        const m3 = mXYZD65ToLinearsRGB[c + 6];
        let _g1 = 0;
        while(_g1 < 2){
            const t = _g1++;
            const top1 = (284517 * m1 - 94839 * m3) * sub2;
            const top2 = (838422 * m3 + 769860 * m2 + 731718 * m1) * L * sub2 - 769860 * t * L;
            const bottom = (632260 * m3 - 126452 * m2) * sub2 + 126452 * t;
            result.push({
                slope: top1 / bottom,
                intercept: top2 / bottom
            });
        }
    }
    return result;
};
const distanceLineFromOrigin = ({ intercept, slope })=>Math.abs(intercept) / Math.sqrt(slope ** 2 + 1);
const maxSafeChromaForL = (L)=>{
    const bounds = getBounds(L * 100);
    let min = Infinity;
    let _g = 0;
    while(_g < bounds.length){
        const bound = bounds[_g];
        ++_g;
        const length = distanceLineFromOrigin(bound);
        min = Math.min(min, length);
    }
    return min / 100;
};
const lengthOfRayUntilIntersect = (theta, { intercept, slope })=>intercept / (Math.sin(theta) - slope * Math.cos(theta));
const maxChromaForLH = (L, H)=>{
    const hrad = H * TAU;
    const bounds = getBounds(L * 100);
    let min = Infinity;
    let _g = 0;
    while(_g < bounds.length){
        const bound = bounds[_g];
        ++_g;
        const length = lengthOfRayUntilIntersect(hrad, bound);
        if (length >= 0) min = Math.min(min, length);
    }
    return min / 100;
};
const hpluvToLch = (H, S, L, out)=>hpLuvOrHsluvToLch(H, S, L, out, maxSafeChromaForL);
const lchToHpluv = (L, C, H, out)=>lchToHpluvOrHsluv(L, C, H, out, maxSafeChromaForL);
const hsluvToLch = (H, S, L, out)=>hpLuvOrHsluvToLch(H, S, L, out, maxChromaForLH);
const lchToHsluv = (L, C, H, out)=>lchToHpluvOrHsluv(L, C, H, out, maxChromaForLH);
// Lch/Lab
// https://drafts.csswg.org/css-color/#lch-to-lab}
// https://drafts.csswg.org/css-color/#lab-to-lch}
/**
 * Return a Lab representation from LCH values.
 * @param {number} l
 * @param {number} c
 * @param {number} h
 * @param {Array} out
 * @returns {import("./lab.js").lab}
 */ const lchToLab = (l, c, h, out)=>{
    out[0] = l;
    out[1] = c * Math.cos(h * TAU);
    out[2] = c * Math.sin(h * TAU);
    // Range is [0, 150]
    out[1] *= 1.5;
    out[2] *= 1.5;
    return out;
};
/**
 * Return a Lch representation from Lab values.
 * @param {number} l
 * @param {number} a
 * @param {number} b
 * @param {Array} out
 * @returns {import("./lch.js").lch}
 */ const labToLch = (l, a, b, out)=>{
    out[0] = l;
    const ε = 250 / 100000 / 100; // Lab is -125, 125. TODO: range is different for Oklab
    // If is achromatic
    if (Math.abs(a) < ε && Math.abs(b) < ε) {
        out[1] = out[2] = 0;
    } else {
        const h = Math.atan2(b, a); // [-PI to PI]
        out[1] = Math.sqrt(a ** 2 + b ** 2);
        out[2] = (h >= 0 ? h : h + TAU) / TAU; // [0 to 1)
        // Range is [0, 150]
        out[1] /= 1.5;
    }
    return out;
};
// Lab/XYZ
// ε = 6^3 / 29^3 = 0.008856
// κ = 29^3 / 3^3 = 903.2962963
// 903.2962963 / 116 = 7.787037
const fromLabValueToXYZValue = (val, white)=>{
    const pow = val ** 3;
    return (pow > 0.008856 ? pow : (val - 16 / 116) / 7.787037) * white;
};
const fromXYZValueToLabValue = (val, white)=>{
    val /= white;
    return val > 0.008856 ? Math.cbrt(val) : 7.787037 * val + 16 / 116;
};
/**
 * Return a XYZ representation from Lab values with provided illuminant.
 * @param {number} l
 * @param {number} a
 * @param {number} b
 * @param {Array} out
 * @param {Array} illuminant
 * @returns {import("./xyz.js").xyz}
 */ const labToXyz = (l, a, b, out, illuminant)=>{
    const Y = (l + 0.16) / 1.16;
    out[0] = fromLabValueToXYZValue(a / 5 + Y, illuminant[0]);
    out[1] = fromLabValueToXYZValue(Y, illuminant[1]);
    out[2] = fromLabValueToXYZValue(Y - b / 2, illuminant[2]);
    return out;
};
/**
 * Return a lab representation from XYZ values with provided illuminant.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Array} out
 * @param {Array} illuminant
 * @returns {import("./lab.js").lab}
 */ const xyzToLab = (x, y, z, out, illuminant)=>{
    const X = fromXYZValueToLabValue(x, illuminant[0]);
    const Y = fromXYZValueToLabValue(y, illuminant[1]);
    const Z = fromXYZValueToLabValue(z, illuminant[2]);
    out[0] = 1.16 * Y - 0.16;
    out[1] = 5 * (X - Y);
    out[2] = 2 * (Y - Z);
    return out;
};
// Ok
// https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/colorconversion.js
// prettier-ignore
const mOklabToLMS = [
    1,
    1,
    1,
    0.3963377774,
    -0.1055613458,
    -0.0894841775,
    0.2158037573,
    -0.0638541728,
    -1.291485548
];
// prettier-ignore
const mLMSToLinear = [
    4.0767416621,
    -1.2684380046,
    -0.0041960863,
    -3.3077115913,
    2.6097574011,
    -0.7034186147,
    0.2309699292,
    -0.3413193965,
    1.707614701
];
// TODO: https://github.com/w3c/csswg-drafts/issues/6642#issuecomment-943521484
// prettier-ignore
const mLinearToLMS = [
    0.4122214708,
    0.2119034982,
    0.0883024619,
    0.5363325363,
    0.6806995451,
    0.2817188376,
    0.0514459929,
    0.1073969566,
    0.6299787005
];
// prettier-ignore
const mLMSToOklab = [
    0.2104542553,
    1.9779984951,
    0.0259040371,
    0.793617785,
    -2.428592205,
    0.7827717662,
    -0.0040720468,
    0.4505937099,
    -0.808675766
];
/**
 * Return a Linear representation from Oklab values.
 * @param {number} L
 * @param {number} a
 * @param {number} b
 * @param {Array} out
 * @returns {import("./linear.js").linear}
 */ const oklabToLinear = (L, a, b, out)=>{
    fromValues(out, L, a, b);
    transformMat3(out, mOklabToLMS);
    cubed3(out);
    return transformMat3(out, mLMSToLinear);
};
/**
 * Return a Oklab representation from Linear values.
 * @param {number} lr
 * @param {number} lg
 * @param {number} lb
 * @param {Array} out
 * @returns {import("./oklab.js").oklab}
 */ const linearToOklab = (lr, lg, lb, out)=>{
    fromValues(out, lr, lg, lb);
    transformMat3(out, mLinearToLMS);
    cbrt3(out);
    return transformMat3(out, mLMSToOklab);
};
const K1 = 0.206;
const K2 = 0.03;
const K3 = (1 + K1) / (1 + K2);
const toe = (x)=>0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) * (K3 * x - K1) + 4 * K2 * K3 * x));
const toeInv = (x)=>(x ** 2 + K1 * x) / (K3 * (x + K2));
const computeMaxSaturation = (a, b)=>{
    let k0, k1, k2, k3, k4, wl, wm, ws;
    if (-1.88170328 * a - 0.80936493 * b > 1) {
        k0 = 1.19086277;
        k1 = 1.76576728;
        k2 = 0.59662641;
        k3 = 0.75515197;
        k4 = 0.56771245;
        wl = mLMSToLinear[0];
        wm = mLMSToLinear[3];
        ws = mLMSToLinear[6];
    } else if (1.81444104 * a - 1.19445276 * b > 1) {
        k0 = 0.73956515;
        k1 = -0.45954404;
        k2 = 0.08285427;
        k3 = 0.1254107;
        k4 = 0.14503204;
        wl = mLMSToLinear[1];
        wm = mLMSToLinear[4];
        ws = mLMSToLinear[7];
    } else {
        k0 = 1.35733652;
        k1 = -915799e-8;
        k2 = -1.1513021;
        k3 = -0.50559606;
        k4 = 0.00692167;
        wl = mLMSToLinear[2];
        wm = mLMSToLinear[5];
        ws = mLMSToLinear[8];
    }
    const S = k0 + k1 * a + k2 * b + k3 * a ** 2 + k4 * a * b;
    const kl = mOklabToLMS[3] * a + mOklabToLMS[6] * b;
    const km = mOklabToLMS[4] * a + mOklabToLMS[7] * b;
    const ks = mOklabToLMS[5] * a + mOklabToLMS[8] * b;
    const l_ = 1 + S * kl;
    const m_ = 1 + S * km;
    const s_ = 1 + S * ks;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    const ldS = 3 * kl * l_ ** 2;
    const mdS = 3 * km * m_ ** 2;
    const sdS = 3 * ks * s_ ** 2;
    const ldS2 = 6 * kl ** 2 * l_;
    const mdS2 = 6 * km ** 2 * m_;
    const sdS2 = 6 * ks ** 2 * s_;
    const f = wl * l + wm * m + ws * s;
    const f1 = wl * ldS + wm * mdS + ws * sdS;
    const f2 = wl * ldS2 + wm * mdS2 + ws * sdS2;
    return S - f * f1 / (f1 ** 2 - 0.5 * f * f2);
};
const findCusp = (a, b)=>{
    const sCusp = computeMaxSaturation(a, b);
    oklabToLinear(1, sCusp * a, sCusp * b, TMP);
    const lCusp = Math.cbrt(1 / Math.max(TMP[0], TMP[1], TMP[2]));
    return [
        lCusp,
        lCusp * sCusp
    ];
};
const getStMax = (a_, b_, cusp = null)=>{
    if (!cusp) cusp = findCusp(a_, b_);
    return [
        cusp[1] / cusp[0],
        cusp[1] / (1 - cusp[0])
    ];
};
const findGamutIntersection = (a, b, L1, C1, L0, cusp = null)=>{
    if (!cusp) cusp = findCusp(a, b);
    let t;
    if ((L1 - L0) * cusp[1] - (cusp[0] - L0) * C1 <= 0) {
        t = cusp[1] * L0 / (C1 * cusp[0] + cusp[1] * (L0 - L1));
    } else {
        t = cusp[1] * (L0 - 1) / (C1 * (cusp[0] - 1) + cusp[1] * (L0 - L1));
        const dL = L1 - L0;
        const dC = C1;
        const kl = mOklabToLMS[3] * a + mOklabToLMS[6] * b;
        const km = mOklabToLMS[4] * a + mOklabToLMS[7] * b;
        const ks = mOklabToLMS[5] * a + mOklabToLMS[8] * b;
        const l_dt = dL + dC * kl;
        const m_dt = dL + dC * km;
        const s_dt = dL + dC * ks;
        const L = L0 * (1 - t) + t * L1;
        const C = t * C1;
        const l_ = L + C * kl;
        const m_ = L + C * km;
        const s_ = L + C * ks;
        const l = l_ ** 3;
        const m = m_ ** 3;
        const s = s_ ** 3;
        const ldt = 3 * l_dt * l_ ** 2;
        const mdt = 3 * m_dt * m_ ** 2;
        const sdt = 3 * s_dt * s_ ** 2;
        const ldt2 = 6 * l_dt ** 2 * l_;
        const mdt2 = 6 * m_dt ** 2 * m_;
        const sdt2 = 6 * s_dt ** 2 * s_;
        const r = mLMSToLinear[0] * l + mLMSToLinear[3] * m + mLMSToLinear[6] * s - 1;
        const r1 = mLMSToLinear[0] * ldt + mLMSToLinear[3] * mdt + mLMSToLinear[6] * sdt;
        const r2 = mLMSToLinear[0] * ldt2 + mLMSToLinear[3] * mdt2 + mLMSToLinear[6] * sdt2;
        const ur = r1 / (r1 ** 2 - 0.5 * r * r2);
        let tr = -r * ur;
        const g = mLMSToLinear[1] * l + mLMSToLinear[4] * m + mLMSToLinear[7] * s - 1;
        const g1 = mLMSToLinear[1] * ldt + mLMSToLinear[4] * mdt + mLMSToLinear[7] * sdt;
        const g2 = mLMSToLinear[1] * ldt2 + mLMSToLinear[4] * mdt2 + mLMSToLinear[7] * sdt2;
        const ug = g1 / (g1 ** 2 - 0.5 * g * g2);
        let tg = -g * ug;
        const b0 = mLMSToLinear[2] * l + mLMSToLinear[5] * m + mLMSToLinear[8] * s - 1;
        const b1 = mLMSToLinear[2] * ldt + mLMSToLinear[5] * mdt + mLMSToLinear[8] * sdt;
        const b2 = mLMSToLinear[2] * ldt2 + mLMSToLinear[5] * mdt2 + mLMSToLinear[8] * sdt2;
        const ub = b1 / (b1 ** 2 - 0.5 * b0 * b2);
        let tb = -b0 * ub;
        tr = ur >= 0 ? tr : Number.MAX_VALUE; // 10e5
        tg = ug >= 0 ? tg : Number.MAX_VALUE; // 10e5
        tb = ub >= 0 ? tb : Number.MAX_VALUE; // 10e5
        t += Math.min(tr, tg, tb);
    }
    return t;
};
const getStMid = (a, b)=>{
    // prettier-ignore
    const Smid = 0.11516993 + 1 / (7.44778970 + 4.15901240 * b + a * (-2.19557347 + 1.75198401 * b + a * (-2.13704948 - 10.02301043 * b + a * (-4.24894561 + 5.38770819 * b + 4.69891013 * a))));
    // prettier-ignore
    const Tmid = 0.11239642 + 1 / (1.61320320 - 0.68124379 * b + a * (0.40370612 + 0.90148123 * b + a * (-0.27087943 + 0.61223990 * b + a * (299215e-8 - 0.45399568 * b - 0.14661872 * a))));
    return [
        Smid,
        Tmid
    ];
};
const getCs = (L, a_, b_)=>{
    const cusp = findCusp(a_, b_);
    const Cmax = findGamutIntersection(a_, b_, L, 1, L, cusp);
    const STmax = getStMax(a_, b_, cusp);
    const STmid = getStMid(a_, b_);
    const k = Cmax / Math.min(L * STmax[0], (1 - L) * STmax[1]);
    let Ca = L * STmid[0];
    let Cb = (1 - L) * STmid[1];
    const Cmid = 0.9 * k * Math.sqrt(Math.sqrt(1 / (1 / Ca ** 4 + 1 / Cb ** 4)));
    Ca = L * 0.4;
    Cb = (1 - L) * 0.8;
    return [
        Math.sqrt(1 / (1 / Ca ** 2 + 1 / Cb ** 2)),
        Cmid,
        Cmax
    ];
};

var utils = /*#__PURE__*/Object.freeze({
  __proto__: null,
  D50: D50,
  D65: D65,
  TAU: TAU,
  TMP: TMP,
  findCusp: findCusp,
  findGamutIntersection: findGamutIntersection,
  floorArray: floorArray,
  getCs: getCs,
  getStMax: getStMax,
  hpluvToLch: hpluvToLch,
  hsluvToLch: hsluvToLch,
  labToLch: labToLch,
  labToXyz: labToXyz,
  lchToHpluv: lchToHpluv,
  lchToHsluv: lchToHsluv,
  lchToLab: lchToLab,
  lchToLuv: lchToLuv,
  linearP3ToXyzD65: linearP3ToXyzD65,
  linearToOklab: linearToOklab,
  linearToRgb: linearToRgb,
  linearToSrgb: linearToSrgb,
  linearToXyzD50: linearToXyzD50,
  linearToXyzD65: linearToXyzD65,
  luvToLch: luvToLch,
  luvToXyz: luvToXyz,
  oklabToLinear: oklabToLinear,
  rgbToLinear: rgbToLinear,
  setAlpha: setAlpha,
  srgbToLinear: srgbToLinear,
  toe: toe,
  toeInv: toeInv,
  xyzD50ToLinear: xyzD50ToLinear,
  xyzD65ToLinear: xyzD65ToLinear,
  xyzD65ToLinearP3: xyzD65ToLinearP3,
  xyzToLab: xyzToLab,
  xyzToLuv: xyzToLuv
});

/**
 * @typedef {number[]} color An array of 3 (RGB) or 4 (A) values.
 *
 * All components in the range 0 <= x <= 1
 */ /**
 * Creates a new color from linear values.
 * @alias module:pex-color.create
 * @param {number} [r=0]
 * @param {number} [g=0]
 * @param {number} [b=0]
 * @param {number} [a]
 * @returns {color}
 */ function create(r = 0, g = 0, b = 0, a = 1) {
    return [
        r,
        g,
        b,
        a
    ];
}
/**
 * Returns a copy of a color.
 * @alias module:pex-color.copy
 * @param {color} color
 * @returns {color}
 */ function copy(color) {
    return color.slice();
}
/**
 * Sets a color to another color.
 * @alias module:pex-color.set
 * @param {color} color
 * @param {color} color2
 * @returns {color}
 */ function set(color, color2) {
    color[0] = color2[0];
    color[1] = color2[1];
    color[2] = color2[2];
    return setAlpha(color, color2[3]);
}
/**
 * Updates a color based on r, g, b, [a] values.
 * @alias module:pex-color.fromValues
 * @param {import("./color.js").color} color
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromValues(color, r, g, b, a) {
    color[0] = r;
    color[1] = g;
    color[2] = b;
    return setAlpha(color, a);
}
/**
 * @deprecated Use "fromValues()".
 * @ignore
 */ function fromRGB(color, r, g, b, a) {
    console.error(`"fromRGB()" deprecated. Use "fromValues()".`);
    return fromValues(color, r, g, b, a);
}
/**
 * @deprecated Use "set()".
 * @ignore
 */ function toRGB(color, out = []) {
    console.error(`"toRGB()" deprecated. Use "set()".`);
    return set(out, color);
}

/**
 * @typedef {string} hex hexadecimal string (RGB[A] or RRGGBB[AA]).
 */ /**
 * Updates a color based on a hexadecimal string.
 * @alias module:pex-color.fromHex
 * @param {import("./color.js").color} color
 * @param {hex} hex Leading '#' is optional.
 * @returns {import("./color.js").color}
 */ function fromHex(color, hex) {
    hex = hex.replace(/^#/, "");
    let a = 1;
    if (hex.length === 8) {
        a = parseInt(hex.slice(6, 8), 16) / 255;
        hex = hex.slice(0, 6);
    } else if (hex.length === 4) {
        a = parseInt(hex.slice(3, 4).repeat(2), 16) / 255;
        hex = hex.slice(0, 3);
    }
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    color[0] = (num >> 16 & 255) / 255;
    color[1] = (num >> 8 & 255) / 255;
    color[2] = (num & 255) / 255;
    if (color[3] !== undefined) color[3] = a;
    return color;
}
/**
 * Returns a hexadecimal string representation of a given color.
 * @alias module:pex-color.toHex
 * @param {import("./color.js").color} color
 * @param {boolean} alpha Handle alpha
 * @returns {hex}
 */ function toHex(color, alpha = true) {
    const c = color.map((val)=>Math.round(val * 255));
    return `#${(c[2] | c[1] << 8 | c[0] << 16 | 1 << 24).toString(16).slice(1).toUpperCase()}${alpha && color[3] !== undefined && color[3] !== 1 ? (c[3] | 1 << 8).toString(16).slice(1) : ""}`;
}

/**
 * @typedef {number[]} hsl hue, saturation, lightness.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://en.wikipedia.org/wiki/HSL_and_HSV}
 */ function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}
/**
 * Updates a color based on HSL values and alpha.
 * @alias module:pex-color.fromHSL
 * @param {import("./color.js").color} color
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromHSL(color, h, s, l, a) {
    if (s === 0) {
        color[0] = color[1] = color[2] = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        color[0] = hue2rgb(p, q, h + 1 / 3);
        color[1] = hue2rgb(p, q, h);
        color[2] = hue2rgb(p, q, h - 1 / 3);
    }
    return setAlpha(color, a);
}
/**
 * Returns a HSL representation of a given color.
 * @alias module:pex-color.toHSL
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {hsl}
 */ function toHSL([r, g, b, a], out = []) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    out[2] = (max + min) / 2;
    if (max === min) {
        out[0] = out[1] = 0; // achromatic
    } else {
        const d = max - min;
        out[1] = out[2] > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r:
                out[0] = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                out[0] = (b - r) / d + 2;
                break;
            case b:
                out[0] = (r - g) / d + 4;
                break;
        }
        out[0] /= 6;
    }
    return setAlpha(out, a);
}

export { luvToLch as A, hsluvToLch as B, lchToHsluv as C, D50 as D, hpluvToLch as E, lchToHpluv as F, set as G, TMP as H, floorArray as I, utils as J, create as K, copy as L, fromValues as M, fromRGB as N, toRGB as O, fromHex as P, TAU as T, toHSL as a, linearToXyzD50 as b, xyzD65ToLinear as c, linearToXyzD65 as d, linearP3ToXyzD65 as e, fromHSL as f, xyzD65ToLinearP3 as g, labToXyz as h, xyzToLab as i, D65 as j, lchToLab as k, linearToRgb as l, labToLch as m, linearToOklab as n, oklabToLinear as o, getStMax as p, toeInv as q, rgbToLinear as r, setAlpha as s, toHex as t, toe as u, getCs as v, lchToLuv as w, xyzD50ToLinear as x, luvToXyz as y, xyzToLuv as z };
