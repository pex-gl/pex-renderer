/**
 * Skybox component
 * @param {import("../types.js").SkyboxComponentOptions} [options]
 * @returns {object}
 * @module SkyboxComponent
 * @exports module:SkyboxComponent
 */
export default (options) => ({
  // Shared
  backgroundBlur: false,
  exposure: 1,
  // Sky
  turbidity: 10,
  rayleigh: 2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  // sunPosition,
  // Environment map
  // envMap,
  ...options,
});
