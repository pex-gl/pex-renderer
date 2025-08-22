/**
 * @module typedArrayInterleave
 */ /**
 * Interleave n typed arrays
 *
 * @alias module:typedArrayInterleave
 * @param {TypedArray} ResultConstructor Returned typed array constructor
 * @param {Array} elements Number of elements to group for each typed array
 * @param {...TypedArray} arrays Arrays to interleave
 * @returns {TypedArray}
 */ function typedArrayInterleave(ResultConstructor, elements, ...arrays) {
    const totalLength = arrays.reduce((total, arr)=>total + arr.length, 0);
    const result = new ResultConstructor(totalLength);
    const stride = elements.reduce((a, b)=>a + b);
    for(let i = 0; i < totalLength; i++){
        let offset = 0;
        for(let j = 0; j < elements.length; j++){
            for(let k = 0; k < elements[j]; k++){
                result[i * stride + offset] = arrays[j][elements[j] * i + k];
                offset++;
            }
        }
    }
    return result;
}

export { typedArrayInterleave as default };
