const bits = new Uint32Array(1);
// Van der Corput radical inverse
function radicalInverse(i) {
    bits[0] = i;
    bits[0] = (bits[0] << 16 | bits[0] >> 16) >>> 0;
    bits[0] = (bits[0] & 0x55555555) << 1 | (bits[0] & 0xaaaaaaaa) >>> 1 >>> 0;
    bits[0] = (bits[0] & 0x33333333) << 2 | (bits[0] & 0xcccccccc) >>> 2 >>> 0;
    bits[0] = (bits[0] & 0x0f0f0f0f) << 4 | (bits[0] & 0xf0f0f0f0) >>> 4 >>> 0;
    bits[0] = (bits[0] & 0x00ff00ff) << 8 | (bits[0] & 0xff00ff00) >>> 8 >>> 0;
    return bits[0] * 2.3283064365386963e-10; // / 0x100000000 or / 4294967296
}
function hammersley(i, n) {
    return [
        i / n,
        radicalInverse(i)
    ];
}

export { hammersley as default, radicalInverse };
