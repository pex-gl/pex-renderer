/**
 * Area light component
 * @param {import("../types.js").AreaLightComponentOptions} [options]
 * @returns {object}
 * @module AreaLightComponent
 * @exports module:AreaLightComponent
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  // castShadows: true,
  ...options,
});
