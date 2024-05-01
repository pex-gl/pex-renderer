/**
 * Directional light component
 * @param {import("../types.js").DirectionalLightComponentOptions} [options]
 * @returns {object}
 * @alias module:components.directionalLight
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  bias: 0.1,
  castShadows: true,
  radius: 1,
  // shadowMapSize: 2048, //TODO: MARCIN: why is this commented out?
  ...options,
});
