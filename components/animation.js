/**
 * Animation component
 * @param {import("../types.js").AnimationComponentOptions} [options]
 * @returns {object}
 * @module AnimationComponent
 * @exports module:AnimationComponent
 */
export default (options) => ({
  playing: false,
  loop: false,
  time: 0, // seconds
  channels: [],
  ...options,
});
