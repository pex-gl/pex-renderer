/**
 * Animation component
 * @param {import("../types.js").AnimationComponentOptions} [options]
 * @returns {object}
 * @alias module:components.animation
 */
export default (options) => ({
  playing: false,
  loop: false,
  time: 0, // seconds
  channels: [],
  ...options,
});
