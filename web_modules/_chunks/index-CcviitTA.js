/**
 * @module typedArrayConstructor
 */ const upperBounds = new Map();
upperBounds.set([
    Int8Array,
    Uint8Array
], 255);
upperBounds.set([
    Int16Array,
    Uint16Array
], 65535);
upperBounds.set([
    Int32Array,
    Uint32Array
], 4294967295);
upperBounds.set([
    BigInt64Array,
    BigUint64Array
], 2 ** 64 - 1);
const upperBoundsArray = Array.from(upperBounds.entries());
/**
 * Get a typed array constructor based on the hypothetical max value it could contain. Signed or unsigned.
 *
 * @alias module:typedArrayConstructor
 * @param {number} maxValue The max value expected.
 * @param {boolean} signed Get a signed or unsigned array.
 * @returns {(Uint8Array|Uint16Array|Uint32Array|BigInt64Array|Int8Array|Int16Array|Int32Array|BigInt64Array)}
 * @see [MDN TypedArray objects]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray#typedarray_objects}
 */ const typedArrayConstructor = (maxValue, signed)=>{
    const value = Math.max(0, maxValue);
    return upperBoundsArray[upperBoundsArray.findLastIndex(([_, bound])=>value > Math[Math.sign(maxValue) === -1 ? "ceil" : "floor"](bound / (1))) + 1][0][1];
};

export { typedArrayConstructor as t };
