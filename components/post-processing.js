/**
 * Post Processing component
 * @param {import("../types.js").PostProcessingComponentOptions} [options]
 * @returns {object}
 * @module PostProcessingComponent
 * @exports module:PostProcessingComponent
 */
export default (options) => ({
  // dof
  // aa
  // fog
  // bloom
  // lut
  // colorCorrection
  // vignette
  opacity: 1,
  ...options,
});
