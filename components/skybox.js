/**
 * Skybox component
 * @param {import("../types.js").SkyboxComponentOptions} [options]
 * @returns {object}
 * @module SkyboxComponent
 * @exports module:SkyboxComponent
 */
export default (options) => ({
  backgroundBlur: false,
  // sunPosition,
  // envMap,
  // rgbm: false,
  ...options,
});
