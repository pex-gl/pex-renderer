/**
 * Ambient light component
 * @param {import("../types.js").AmbientLightComponentOptions} [options]
 * @returns {object}
 * @module AmbientLightComponent
 * @exports module:AmbientLightComponent
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  ...options,
});
