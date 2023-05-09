/**
 * Transform component
 * @param {import("../types.js").TransformComponentOptions} [options]
 * @returns {object}
 * @module TransformComponent
 * @exports module:TransformComponent
 */
export default (options) => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
  ...options,
});
