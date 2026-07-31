/**
 * Skeleton helper component
 * @param {import("../types.js").SkeletonHelperComponentOptions} [options]
 * @returns {object}
 * @alias module:components.skeletonHelper
 */
export default (options) => ({
  color: [
    [0, 0, 1, 1],
    [0, 1, 0, 1],
  ],
  ...options,
});
