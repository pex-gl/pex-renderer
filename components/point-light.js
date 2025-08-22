/**
 * Point light component
 * @param {import("../types.js").PointLightComponentOptions} [options]
 * @returns {object}
 * @alias module:components.pointLight
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  range: 10,
  bias: 0.1,
  bulbRadius: 1,
  castShadows: true,
  shadowMapSize: 2048,
  ...options,
});
