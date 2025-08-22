import { g as getDefaultExportFromCjs } from './_chunks/polyfills-Ci6ALveU.js';

function fitRect(rect, target, mode) {
    mode = mode || 'contain';
    var sw = target[2] / rect[2];
    var sh = target[3] / rect[3];
    var scale = 1;
    if (mode == 'contain') {
        scale = Math.min(sw, sh);
    } else if (mode == 'cover') {
        scale = Math.max(sw, sh);
    }
    return [
        target[0] + (target[2] - rect[2] * scale) / 2,
        target[1] + (target[3] - rect[3] * scale) / 2,
        rect[2] * scale,
        rect[3] * scale
    ];
}
var fitRect_1 = fitRect;
var index = /*@__PURE__*/ getDefaultExportFromCjs(fitRect_1);

export { index as default };
