/**
 * Transform component
 * @param {import("../types.js").TransformComponentOptions} [options]
 * @returns {object}
 * @alias module:components.transform
 */
export default (options) => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
  // parent,
  // worldBounds,
  // aabbDirty,
  // dirty,
  ...options,
});
