/**
 * Ambient light component
 * @param {import("../types.js").AmbientLightComponentOptions} [options]
 * @returns {object}
 * @alias module:components.ambientLight
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  ...options,
});
