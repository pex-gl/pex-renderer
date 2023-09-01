/**
 * Point light component
 * @param {import("../types.js").PointLightComponentOptions} [options]
 * @returns {object}
 * @module PointLightComponent
 * @exports module:PointLightComponent
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  range: 10,
  bias: 0.05,
  castShadows: true,
  // shadowMapSize: 2048,
  ...options,
});
