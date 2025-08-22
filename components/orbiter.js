/**
 * Orbiter component
 * @param {import("../types.js").OrbiterComponentOptions} options
 * @returns {object}
 * @alias module:components.orbiter
 */
export default (options) => ({
  target: [0, 0, 0],
  lat: 0,
  lon: 0,
  distance: 10,
  // element: document.body,
  ...options,
});
