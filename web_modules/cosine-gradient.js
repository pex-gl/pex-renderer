import { g as getDefaultExportFromCjs } from './_chunks/polyfills-Ci6ALveU.js';

//a - offset
//b - amplitude
//c - frequency
//d - phase
function cosineGradient(a, b, c, d) {
    var TwoPI = Math.PI * 2;
    if (a && !b && !c && !d) {
        b = a[1];
        c = a[2];
        d = a[3];
        a = a[0];
    }
    return function(t) {
        return [
            a[0] + b[0] * Math.cos(TwoPI * (c[0] * t + d[0])),
            a[1] + b[1] * Math.cos(TwoPI * (c[1] * t + d[1])),
            a[2] + b[2] * Math.cos(TwoPI * (c[2] * t + d[2]))
        ];
    };
}
var cosineGradient_1 = cosineGradient;
var index = /*@__PURE__*/ getDefaultExportFromCjs(cosineGradient_1);

export { index as default };
