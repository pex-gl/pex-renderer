import { l as linearToRgb, s as setAlpha, r as rgbToLinear, x as xyzD50ToLinear, b as linearToXyzD50, c as xyzD65ToLinear, d as linearToXyzD65, e as linearP3ToXyzD65, g as xyzD65ToLinearP3, f as fromHSL, a as toHSL, h as labToXyz, D as D50, i as xyzToLab, j as D65, k as lchToLab, m as labToLch, o as oklabToLinear, n as linearToOklab, p as getStMax, q as toeInv, u as toe, T as TAU, v as getCs, w as lchToLuv, y as luvToXyz, z as xyzToLuv, A as luvToLch, B as hsluvToLch, C as lchToHsluv, E as hpluvToLch, F as lchToHpluv, G as set, H as TMP, I as floorArray } from './_chunks/hsl-Cxyv9U6e.js';
export { L as copy, K as create, P as fromHex, N as fromRGB, M as fromValues, t as toHex, O as toRGB, J as utils } from './_chunks/hsl-Cxyv9U6e.js';

/**
 * @typedef {number[]} bytes An array of 3 (RGB) or 4 (A) values in bytes.
 *
 * All components in the range 0 <= x <= 255
 */ /**
 * Updates a color based on byte values.
 * @alias module:pex-color.fromBytes
 * @param {import("./color.js").color} color
 * @param {bytes} bytes
 * @returns {import("./color.js").color}
 */ function fromBytes(color, [r, g, b, a]) {
    color[0] = r / 255;
    color[1] = g / 255;
    color[2] = b / 255;
    if (a !== undefined) color[3] = a / 255;
    return color;
}
/**
 * Get RGB[A] color components as bytes array.
 * @alias module:pex-color.toBytes
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {bytes}
 */ function toBytes(color, out = []) {
    out[0] = Math.round(color[0] * 255);
    out[1] = Math.round(color[1] * 255);
    out[2] = Math.round(color[2] * 255);
    if (color[3] !== undefined) out[3] = Math.round(color[3] * 255);
    return out;
}
/**
 * @deprecated Use "fromBytes()".
 * @ignore
 */ function fromRGBBytes(color, bytes) {
    console.error(`"fromRGBBytes()" deprecated. Use "fromBytes()".`);
    return fromBytes(color, bytes);
}
/**
 * @deprecated Use "toBytes()".
 * @ignore
 */ function toRGBBytes(color, out) {
    console.error(`"toRGBBytes()" deprecated. Use "toBytes()".`);
    return toBytes(color, out);
}

/**
 * @typedef {number[]} linear r g b linear values.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://en.wikipedia.org/wiki/SRGB}
 */ /**
 * Updates a color based on linear values.
 * @alias module:pex-color.fromLinear
 * @param {import("./color.js").color} color
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromLinear(color, r, g, b, a) {
    linearToRgb(r, g, b, color);
    return setAlpha(color, a);
}
/**
 * Returns a linear color representation of a given color.
 * @alias module:pex-color.toLinear
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {linear}
 */ function toLinear([r, g, b, a], out = []) {
    rgbToLinear(r, g, b, out);
    return setAlpha(out, a);
}

/**
 * @typedef {number[]} xyz CIE XYZ.
 *
 * Components range: 0 <= x <= 0.95; 0 <= y <= 1; 0 <= z <= 1.08;
 * @see {@link https://en.wikipedia.org/wiki/CIE_1931_color_space}
 */ /**
 * Updates a color based on XYZ values and alpha using D50 standard illuminant.
 * @alias module:pex-color.fromXYZD50
 * @param {import("./color.js").color} color
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} a
 * @returns {import("./color.js").color}
 */ function fromXYZD50(color, x, y, z, a) {
    xyzD50ToLinear(x, y, z, color);
    linearToRgb(color[0], color[1], color[2], color);
    return setAlpha(color, a);
}
/**
 * Returns a XYZ representation of a given color using D50 standard illuminant.
 * @alias module:pex-color.toXYZD50
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {xyz}
 */ function toXYZD50([r, g, b, a], out = []) {
    rgbToLinear(r, g, b, out);
    linearToXyzD50(out[0], out[1], out[2], out);
    return setAlpha(out, a);
}
/**
 * Updates a color based on XYZ values and alpha using D65 standard illuminant.
 * @alias module:pex-color.fromXYZD65
 * @param {import("./color.js").color} color
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} a
 * @returns {import("./color.js").color}
 */ function fromXYZD65(color, x, y, z, a) {
    xyzD65ToLinear(x, y, z, color);
    linearToRgb(color[0], color[1], color[2], color);
    return setAlpha(color, a);
}
/**
 * Returns a XYZ representation of a given color using D65 standard illuminant.
 * @alias module:pex-color.toXYZD65
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {xyz}
 */ function toXYZD65([r, g, b, a], out = []) {
    rgbToLinear(r, g, b, out);
    linearToXyzD65(out[0], out[1], out[2], out);
    return setAlpha(out, a);
}

/**
 * @typedef {number[]} p3 r, g, b values (DCI-P3 color gamut, D65 whitepoint, sRGB gamma curve).
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://drafts.csswg.org/css-color/#color-conversion-code}
 */ /**
 * Updates a color based on P3 values and alpha using D65 standard illuminant.
 * @alias module:pex-color.fromP3
 * @param {import("./color.js").color} color
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} a
 * @returns {import("./color.js").color}
 */ function fromP3(color, r, g, b, a) {
    rgbToLinear(r, g, b, color);
    linearP3ToXyzD65(color[0], color[1], color[2], color);
    return fromXYZD65(color, color[0], color[1], color[2], a);
}
/**
 * Returns a P3 representation of a given color using D65 standard illuminant.
 * @alias module:pex-color.toP3
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {p3}
 */ function toP3(color, out = []) {
    toXYZD65(color, out);
    xyzD65ToLinearP3(out[0], out[1], out[2], out);
    return linearToRgb(out[0], out[1], out[2], out);
}

/**
 * @typedef {number[]} hwb hue, whiteness, blackness.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://en.wikipedia.org/wiki/HWB_color_model}
 */ /**
 * Updates a color based on HWB values and alpha.
 * @alias module:pex-color.fromHWB
 * @param {import("./color.js").color} color
 * @param {number} h
 * @param {number} w
 * @param {number} b
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromHWB(color, h, w, b, a) {
    if (w + b >= 1) {
        color[0] = color[1] = color[2] = w / (w + b);
    } else {
        fromHSL(color, h, 1, 0.5);
        for(let i = 0; i < 3; i++){
            color[i] *= 1 - w - b;
            color[i] += w;
        }
    }
    return setAlpha(color, a);
}
/**
 * Returns a HWB representation of a given color.
 * @alias module:pex-color.toHWB
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {hwb}
 */ function toHWB(color, out = []) {
    toHSL(color, out);
    out[1] = Math.min(color[0], color[1], color[2]);
    out[2] = 1 - Math.max(color[0], color[1], color[2]);
    return setAlpha(out, color[3]);
}

/**
 * @typedef {number[]} hsv hue, saturation, value.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://en.wikipedia.org/wiki/HSL_and_HSV}
 */ /**
 * Updates a color based on HSV values and alpha.
 * @alias module:pex-color.fromHSV
 * @param {import("./color.js").color} color
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromHSV(color, h, s, v, a) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch(i % 6){
        case 0:
            color[0] = v;
            color[1] = t;
            color[2] = p;
            break;
        case 1:
            color[0] = q;
            color[1] = v;
            color[2] = p;
            break;
        case 2:
            color[0] = p;
            color[1] = v;
            color[2] = t;
            break;
        case 3:
            color[0] = p;
            color[1] = q;
            color[2] = v;
            break;
        case 4:
            color[0] = t;
            color[1] = p;
            color[2] = v;
            break;
        case 5:
            color[0] = v;
            color[1] = p;
            color[2] = q;
            break;
    }
    return setAlpha(color, a);
}
/**
 * Returns a HSV representation of a given color.
 * @alias module:pex-color.toHSV
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {hsv}
 */ function toHSV([r, g, b, a], out = []) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    out[2] = max;
    const d = max - min;
    out[1] = max === 0 ? 0 : d / max;
    if (max === min) {
        out[0] = 0; // achromatic
    } else {
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

/**
 * @typedef {number[]} lab CIELAB perceptual Lightness, a* red/green, b* blue/yellow.
 *
 * Components range (D65): 0 <= l <= 1; -0.86183 <= a <= 0.98234; -1.0786 <= b <= 0.94478;
 *
 * Components range (D50): 0 <= l <= 1; -0.79287 <= a <= 0.9355; -1.12029 <= b <= 0.93388;
 * @see {@link https://en.wikipedia.org/wiki/CIELAB_color_space}
 */ function fromLab(color, l, a, b, α, { illuminant = D50, fromXYZ = fromXYZD50 } = {}) {
    labToXyz(l, a, b, color, illuminant);
    return fromXYZ(color, color[0], color[1], color[2], α);
}
function toLab(color, out = [], { illuminant = D50, toXYZ = toXYZD50 } = {}) {
    toXYZ(color, out);
    return xyzToLab(out[0], out[1], out[2], out, illuminant);
}
/**
 * Updates a color based on Lab values and alpha using D50 standard illuminant.
 * @alias module:pex-color.fromLabD50
 * @param {import("./color.js").color} color
 * @param {number} l
 * @param {number} a
 * @param {number} b
 * @param {number} α
 * @returns {import("./color.js").color}
 */ function fromLabD50(color, l, a, b, α) {
    return fromLab(color, l, a, b, α, {
        illuminant: D50,
        fromXYZ: fromXYZD50
    });
}
/**
 * Returns a Lab representation of a given color using D50 standard illuminant.
 * @alias module:pex-color.toLabD50
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {lab}
 */ function toLabD50(color, out = []) {
    return toLab(color, out, {
        illuminant: D50,
        toXYZ: toXYZD50
    });
}
/**
 * Updates a color based on Lab values and alpha using D65 standard illuminant.
 * @alias module:pex-color.fromLabD65
 * @param {import("./color.js").color} color
 * @param {number} l
 * @param {number} a
 * @param {number} b
 * @param {number} α
 * @returns {import("./color.js").color}
 */ function fromLabD65(color, l, a, b, α) {
    return fromLab(color, l, a, b, α, {
        illuminant: D65,
        fromXYZ: fromXYZD65
    });
}
/**
 * Returns a Lab representation of a given color using D65 standard illuminant.
 * @alias module:pex-color.toLabD65
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {lab}
 */ function toLabD65(color, out = []) {
    return toLab(color, out, {
        illuminant: D65,
        toXYZ: toXYZD65
    });
}

/**
 * @typedef {number[]} lch CIELCh Luminance Chroma Hue. Cylindrical form of Lab.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://en.wikipedia.org/wiki/CIELAB_color_space#Cylindrical_model}
 */ /**
 * Updates a color based on LCH values and alpha.
 * @alias module:pex-color.fromLCH
 * @param {import("./color.js").color} color
 * @param {number} l
 * @param {number} c
 * @param {number} h
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromLCH(color, l, c, h, a) {
    lchToLab(l, c, h, color);
    return fromLabD50(color, color[0], color[1], color[2], a);
}
/**
 * Returns a LCH representation of a given color.
 * @alias module:pex-color.toLCH
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {lch}
 */ function toLCH(color, out = []) {
    toLabD50(color, out);
    return labToLch(out[0], out[1], out[2], out);
}

/**
 * @typedef {number[]} oklab Cartesian form using D65 standard illuminant.
 *
 * Components range: 0 <= l <= 1; -0.233 <= a <= 0.276; -0.311 <= b <= 0.198;
 * @see {@link https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab}
 */ /**
 * Updates a color based on Oklab values and alpha.
 * @alias module:pex-color.fromOklab
 * @param {import("./color.js").color} color
 * @param {number} L
 * @param {number} a
 * @param {number} b
 * @param {number} [α]
 * @returns {import("./color.js").color}
 */ function fromOklab(color, L, a, b, α) {
    oklabToLinear(L, a, b, color);
    linearToRgb(color[0], color[1], color[2], color);
    return setAlpha(color, α);
}
/**
 * Returns an Oklab representation of a given color.
 * @alias module:pex-color.toOklab
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {oklab}
 */ function toOklab([r, g, b, a], out = []) {
    rgbToLinear(r, g, b, out);
    linearToOklab(out[0], out[1], out[2], out);
    return setAlpha(out, a);
}

/**
 * @typedef {number[]} okhsv
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://bottosson.github.io/posts/colorpicker/#hsv-2}
 */ const S0 = 0.5;
/**
 * Updates a color based on Okhsv values and alpha.
 * @alias module:pex-color.fromOkhsv
 * @param {import("./color.js").color} color
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @param {number} [α]
 * @returns {import("./color.js").color}
 */ function fromOkhsv(color, h, s, v, α) {
    let L = toeInv(v);
    let a = 0; // null
    let b = 0; // null
    // Avoid processing gray or colors with undefined hues
    if (L !== 0 && s !== 0) {
        const a_ = Math.cos(TAU * h);
        const b_ = Math.sin(TAU * h);
        const [S, T] = getStMax(a_, b_);
        const k = 1 - S0 / S;
        const Lv = 1 - s * S0 / (S0 + T - T * k * s);
        const Cv = s * T * S0 / (S0 + T - T * k * s);
        L = v * Lv;
        let C = v * Cv;
        const Lvt = toeInv(Lv);
        const Cvt = Cv * Lvt / Lv;
        const Lnew = toeInv(L);
        C = C * Lnew / L;
        L = Lnew;
        oklabToLinear(Lvt, a_ * Cvt, b_ * Cvt, color);
        const scaleL = Math.cbrt(1 / Math.max(color[0], color[1], color[2], 0));
        L = L * scaleL;
        C = C * scaleL;
        a = C * a_;
        b = C * b_;
    }
    return fromOklab(color, L, a, b, α);
}
/**
 * Returns an Okhsv representation of a given color.
 * @alias module:pex-color.toOkhsv
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {okhsv}
 */ function toOkhsv(color, out = []) {
    toLinear(color, out);
    linearToOklab(out[0], out[1], out[2], out);
    const H = 0.5 + 0.5 * Math.atan2(-out[2], -out[1]) / Math.PI;
    let L = out[0];
    let C = Math.sqrt(out[1] * out[1] + out[2] * out[2]);
    if (L !== 0 && L !== 1 && C !== 0) {
        const a_ = out[1] / C;
        const b_ = out[2] / C;
        const [S, T] = getStMax(a_, b_);
        const t = T / (C + L * T);
        const Lv = t * L;
        const Cv = t * C;
        const Lvt = toeInv(Lv);
        const Cvt = Cv * Lvt / Lv;
        oklabToLinear(Lvt, a_ * Cvt, b_ * Cvt, out);
        const scaleL = Math.cbrt(1 / Math.max(out[0], out[1], out[2], 0));
        L = L / scaleL;
        C = C / scaleL;
        const toeL = toe(L);
        C = C * toeL / L;
        out[1] = (S0 + T) * Cv / (T * S0 + T * (1 - S0 / S) * Cv);
        out[2] = toeL / Lv;
    } else {
        out[1] = 0;
        out[2] = toe(L);
    }
    // Epsilon for saturation just needs to be sufficiently close when denoting achromatic
    const ε = 1e-4;
    if (Math.abs(out[1]) < ε || out[2] === 0) {
        out[0] = 0; // null
    } else {
        out[0] = H;
    }
    return out;
}

/**
 * @typedef {number[]} okhsl
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://bottosson.github.io/posts/colorpicker/#hsl-2}
 */ /**
 * Updates a color based on Okhsl values and alpha.
 * @alias module:pex-color.fromOkhsl
 * @param {import("./color.js").color} color
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @param {number} [α]
 * @returns {import("./color.js").color}
 */ function fromOkhsl(color, h, s, l, α) {
    if (l == 1) {
        color[0] = color[1] = color[2] = 1;
    } else if (l == 0) {
        color[0] = color[1] = color[2] = 0;
    } else {
        const a_ = Math.cos(TAU * h);
        const b_ = Math.sin(TAU * h);
        let L = toeInv(l);
        const [C0, Cmid, Cmax] = getCs(L, a_, b_);
        let C, t, k0, k1, k2;
        if (s < 0.8) {
            t = 1.25 * s;
            k0 = 0;
            k1 = 0.8 * C0;
            k2 = 1 - k1 / Cmid;
        } else {
            t = 5 * (s - 0.8);
            k0 = Cmid;
            k1 = 0.2 * Cmid * Cmid * 1.25 * 1.25 / C0;
            k2 = 1 - k1 / (Cmax - Cmid);
        }
        C = k0 + t * k1 / (1 - k2 * t);
        return fromOklab(color, L, C * a_, C * b_, α);
    }
    return setAlpha(color, α);
}
/**
 * Returns an Okhsl representation of a given color.
 * @alias module:pex-color.toOkhsl
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {okhsl}
 */ function toOkhsl(color, out = []) {
    toLinear(color, out);
    linearToOklab(out[0], out[1], out[2], out);
    const C = Math.sqrt(out[1] * out[1] + out[2] * out[2]);
    const a_ = out[1] / C;
    const b_ = out[2] / C;
    const L = out[0];
    out[0] = 0.5 + 0.5 * Math.atan2(-out[2], -out[1]) / Math.PI;
    const [C0, Cmid, Cmax] = getCs(L, a_, b_);
    out[2] = toe(L);
    if (out[2] !== 0 && out[2] !== 1 && C !== 0) {
        if (C < Cmid) {
            const k0 = 0;
            const k1 = 0.8 * C0;
            const k2 = 1 - k1 / Cmid;
            const t = (C - k0) / (k1 + k2 * (C - k0));
            out[1] = t * 0.8;
        } else {
            const k0 = Cmid;
            const k1 = 0.2 * Cmid * Cmid * 1.25 * 1.25 / C0;
            const k2 = 1 - k1 / (Cmax - Cmid);
            const t = (C - k0) / (k1 + k2 * (C - k0));
            out[1] = 0.8 + 0.2 * t;
        }
    } else {
        out[1] = 0;
    }
    // Epsilon for lightness should approach close to 32 bit lightness
    // Epsilon for saturation just needs to be sufficiently close when denoting achromatic
    let εL = 1e-7;
    let εS = 1e-4;
    const achromatic = Math.abs(out[1]) < εS;
    if (achromatic || Math.abs(1 - out[2]) < εL) {
        out[0] = 0; // null
        if (!achromatic) out[1] = 0;
    }
    return out;
}

/**
 * @typedef {number[]} oklch Cylindrical form using D65 standard illuminant.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://drafts.csswg.org/css-color/#color-conversion-code}
 */ /**
 * Updates a color based on Oklch values and alpha.
 * @alias module:pex-color.fromOklch
 * @param {import("./color.js").color} color
 * @param {number} l
 * @param {number} c
 * @param {number} h
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromOklch(color, l, c, h, a) {
    lchToLab(l, c, h, color);
    // Range is [0, 150]
    color[1] /= 1.5;
    color[2] /= 1.5;
    return fromOklab(color, color[0], color[1], color[2], a);
}
/**
 * Returns an Oklch representation of a given color.
 * @alias module:pex-color.toOklch
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {oklch}
 */ function toOklch(color, out = []) {
    toOklab(color, out);
    // Range is [0, 150]
    out[1] *= 1.5;
    out[2] *= 1.5;
    return labToLch(out[0], out[1], out[2], out);
}

/**
 * @typedef {number[]} lchuv CIELChuv Luminance Chroma Hue.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://en.wikipedia.org/wiki/CIELUV}
 */ /**
 * Updates a color based on LCHuv values and alpha.
 * @alias module:pex-color.fromLCHuv
 * @param {import("./color.js").color} color
 * @param {number} l
 * @param {number} c
 * @param {number} h
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromLCHuv(color, l, c, h, a) {
    lchToLuv(l, c, h, color);
    luvToXyz(color[0], color[1], color[2], color);
    return fromXYZD65(color, color[0], color[1], color[2], a);
}
/**
 * Returns a LCHuv representation of a given color.
 * @alias module:pex-color.toLCHuv
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {lchuv}
 */ function toLCHuv(color, out = []) {
    toXYZD65(color, out);
    xyzToLuv(out[0], out[1], out[2], out);
    return luvToLch(out[0], out[1], out[2], out);
}

/**
 * @typedef {number[]} hsluv CIELUV hue, saturation, lightness.
 *
 * All components in the range 0 <= x <= 1
 * @see {@link https://www.hsluv.org/}
 */ /**
 * Updates a color based on HSLuv values and alpha.
 * @alias module:pex-color.fromHSLuv
 * @param {import("./color.js").color} color
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromHSLuv(color, h, s, l, a) {
    hsluvToLch(h, s, l, color);
    return fromLCHuv(color, color[0], color[1], color[2], a);
}
/**
 * Returns a HSLuv representation of a given color.
 * @alias module:pex-color.toHSLuv
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {hsluv}
 */ function toHSLuv(color, out = []) {
    toLCHuv(color, out);
    return lchToHsluv(out[0], out[1], out[2], out);
}

/**
 * @typedef {number[]} hpluv CIELUV hue, saturation, lightness.
 *
 * All components in the range 0 <= x <= 1.
 */ /**
 * Updates a color based on HPLuv values and alpha.
 * @alias module:pex-color.fromHPLuv
 * @param {import("./color.js").color} color
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @param {number} [a]
 * @returns {import("./color.js").color}
 */ function fromHPLuv(color, h, s, l, a) {
    hpluvToLch(h, s, l, color);
    return fromLCHuv(color, color[0], color[1], color[2], a);
}
/**
 * Returns a HPLuv representation of a given color.
 * @alias module:pex-color.toHPLuv
 * @param {import("./color.js").color} color
 * @param {Array} out
 * @returns {hpluv}
 */ function toHPLuv(color, out = []) {
    toLCHuv(color, out);
    return lchToHpluv(out[0], out[1], out[2], out);
}

// Get the color without alpha
const getCoords = (color)=>color.slice(0, 3);
// Set alpha only when necessary
const setCSSAlpha = (a)=>a !== undefined && a !== 1 ? ` / ${a}` : "";
// Format color space
const toCSSColorSpace = (colorSpace, color, a)=>`color(${colorSpace} ${color.join(" ")}${setCSSAlpha(a)})`;
// sRGB color spaces:
// TODO: a98-rgb, prophoto-rgb, and rec2020
/**
 * Returns a rgb CSS string representation of a given color.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color}
 * @alias module:pex-color.toCSSRGB
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSRGB(color, precision = 5) {
    set(TMP, getCoords(color));
    if (precision !== undefined) floorArray(TMP, precision);
    return toCSSColorSpace("srgb", TMP, color[3]);
}
/**
 * Returns a linear rgb CSS string representation of a given color.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color}
 * @alias module:pex-color.toCSSRGBLinear
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSRGBLinear(color, precision = 5) {
    toLinear(getCoords(color), TMP);
    if (precision !== undefined) floorArray(TMP, precision);
    return toCSSColorSpace("srgb-linear", TMP, color[3]);
}
/**
 * Returns a P3 rgb CSS string representation of a given color.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color}
 * @alias module:pex-color.toCSSRGBLinear
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSP3(color, precision = 5) {
    toP3(getCoords(color), TMP);
    if (precision !== undefined) floorArray(TMP, precision);
    return toCSSColorSpace("display-p3", TMP, color[3]);
}
/**
 * Returns a hsl CSS string representation of a given color.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl}
 * @alias module:pex-color.toCSSHSL
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSHSL(color, precision = 5) {
    toHSL(getCoords(color), TMP);
    TMP[0] *= 360;
    TMP[1] *= 100;
    TMP[2] *= 100;
    if (precision !== undefined) floorArray(TMP, precision);
    return `hsl(${TMP[0]} ${TMP[1]}% ${TMP[2]}%${setCSSAlpha(color[3])})`;
}
/**
 * Returns a hwb CSS string representation of a given color.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hwb}
 * @alias module:pex-color.toCSSHWB
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSHWB(color, precision = 5) {
    toHWB(getCoords(color), TMP);
    TMP[0] *= 360;
    if (precision !== undefined) floorArray(TMP, precision);
    return `hwb(${TMP[0]} ${TMP[1]}% ${TMP[2]}%${setCSSAlpha(color[3])})`;
}
// CIELAB color spaces:
/**
 * Returns a lab CSS string representation of a given color.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/lab}
 * @alias module:pex-color.toCSSLab
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSLab(color, precision = 5) {
    toLab(getCoords(color), TMP);
    TMP[0] *= 100;
    TMP[1] *= 100;
    TMP[2] *= 100;
    if (precision !== undefined) floorArray(TMP, precision);
    return `lab(${TMP[0]}% ${TMP[1]} ${TMP[2]}${setCSSAlpha(color[3])})`;
}
/**
 * Returns a lab CSS string representation of a given color.
 * @alias module:pex-color.toCSSLab
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSLabD65(color, precision = 5) {
    toLabD65(getCoords(color), TMP);
    TMP[0] *= 100;
    TMP[1] *= 100;
    TMP[2] *= 100;
    if (precision !== undefined) floorArray(TMP, precision);
    return `lab-d65(${TMP[0]}% ${TMP[1]} ${TMP[2]}${setCSSAlpha(color[3])})`;
}
/**
 * Returns a lch CSS string representation of a given color.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/lch}
 * @alias module:pex-color.toCSSLCH
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSLCH(color, precision = 5) {
    toLCH(getCoords(color), TMP);
    TMP[0] *= 100;
    TMP[1] *= 150;
    TMP[2] *= 360;
    if (precision !== undefined) floorArray(TMP, precision);
    return `lch(${TMP[0]}% ${TMP[1]} ${TMP[2]}${setCSSAlpha(color[3])})`;
}
/**
 * Returns a lab CSS string representation of a given color.
 * @alias module:pex-color.toCSSOkLab
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSOkLab(color, precision = 5) {
    toOklab(getCoords(color), TMP);
    TMP[0] *= 100;
    if (precision !== undefined) floorArray(TMP, precision);
    return `oklab(${TMP[0]}% ${TMP[1]} ${TMP[2]}${setCSSAlpha(color[3])})`;
}
/**
 * Returns a lch CSS string representation of a given color.
 * @alias module:pex-color.toCSSOklch
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSOklch(color, precision = 5) {
    toOklch(getCoords(color), TMP);
    TMP[0] *= 100;
    TMP[2] *= 360;
    if (precision !== undefined) floorArray(TMP, precision);
    return `oklch(${TMP[0]}% ${TMP[1]} ${TMP[2]}${setCSSAlpha(color[3])})`;
}
// XYZ colors spaces:
/**
 * Returns a xyz-d50 CSS string representation of a given color.
 * @alias module:pex-color.toCSSXYZD50
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSXYZD50(color, precision = 5) {
    toXYZD50(getCoords(color), TMP);
    if (precision !== undefined) floorArray(TMP, precision);
    return toCSSColorSpace("xyz-d50", TMP, color[3]);
}
/**
 * Returns a xyz (xyz-d65) CSS string representation of a given color.
 * @alias module:pex-color.toCSSXYZ
 * @param {import("./color.js").color} color
 * @param {number} [precision=5]
 * @returns {css}
 */ function toCSSXYZ(color, precision = 5) {
    toXYZD65(getCoords(color), TMP);
    if (precision !== undefined) floorArray(TMP, precision);
    return toCSSColorSpace("xyz", TMP, color[3]);
}

export { fromBytes, fromHPLuv, fromHSL, fromHSLuv, fromHSV, fromHWB, fromLCH, fromLCHuv, fromLab, fromLabD50, fromLabD65, fromLinear, fromOkhsl, fromOkhsv, fromOklab, fromOklch, fromP3, fromRGBBytes, fromXYZD50, fromXYZD65, set, toBytes, toCSSHSL, toCSSHWB, toCSSLCH, toCSSLab, toCSSLabD65, toCSSOkLab, toCSSOklch, toCSSP3, toCSSRGB, toCSSRGBLinear, toCSSXYZ, toCSSXYZD50, toHPLuv, toHSL, toHSLuv, toHSV, toHWB, toLCH, toLCHuv, toLab, toLabD50, toLabD65, toLinear, toOkhsl, toOkhsv, toOklab, toOklch, toP3, toRGBBytes, toXYZD50, toXYZD65 };
