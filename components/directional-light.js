/**
 * Directional light component
 * @param {import("../types.js").DirectionalLightComponentOptions} [options]
 * @returns {object}
 * @module DirectionalLightComponent
 * @exports module:DirectionalLightComponent
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  bias: 0.1,
  castShadows: true,
  radius: 1,
  // shadowMapSize: 2048,
  ...options,
});
