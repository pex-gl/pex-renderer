/**
 * Reflection probe component
 * @param {import("../types.js").ReflectionProbeComponentOptions} [options]
 * @returns {object}
 * @alias module:components.reflectionProbe
 */
export default (options) => ({
  size: 1024,
  ...options,
});
