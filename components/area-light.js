/**
 * Area light component
 * @param {import("../types.js").AreaLightComponentOptions} [options]
 * @returns {object}
 * @alias module:components.areaLight
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  disk: false,
  doubleSided: false,
  bias: 0.1,
  bulbRadius: 1,
  castShadows: true,
  // shadowMapSize: 2048,
  ...options,
});
