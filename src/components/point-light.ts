/**
 * Point light component
 *
 * @param {import("../types.js").PointLightComponentOptions} [options]
 * @returns {object}
 * @alias module:components.pointLight
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  range: 10,
  // Normalized shadow-map bias (fraction of the light's far plane); scales with
  // scene size. Trades shadow acne against contact detachment (peter-panning).
  bias: 0.005,
  bulbRadius: 1,
  castShadows: true,
  shadowMapSize: 2048,
  ...options,
});
