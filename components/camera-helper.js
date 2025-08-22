/**
 * Camera helper component
 * @param {import("../types.js").CameraHelperComponentOptions} [options]
 * @returns {object}
 * @alias module:components.cameraHelper
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  ...options,
});
