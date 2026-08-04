/**
 * Spot light component
 *
 * @param {import("../types.js").SpotLightComponentOptions} [options]
 * @returns {object}
 * @alias module:components.spotLight
 */
export default (options) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  angle: Math.PI / 4,
  innerAngle: 0,
  range: 10,
  // Slope-scaled depth bias applied by the shadow-map rasterizer (see
  // renderer/standard.ts getDepthPipeline). Trades shadow acne against contact
  // detachment (peter-panning).
  bias: 1,
  bulbRadius: 1,
  castShadows: true,
  shadowMapSize: 2048,
  ...options,
});
