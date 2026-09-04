import type { PointLightComponentOptions } from "../types.js";

/** Point light component */
export default (options?: PointLightComponentOptions) => ({
  color: [1, 1, 1, 1],
  // Luminous power (lm). 4π lm is 1 cd, the illuminance a metre away that an
  // unexposed pipeline is scaled for; a 75 W bulb is nearer 1000 lm.
  intensity: 4 * Math.PI,
  // Infinite, matching KHR_lights_punctual: the cutoff is an optimisation, not
  // a look, and inverse-square already ends the light's reach.
  range: Infinity,
  // Normalized shadow-map bias (fraction of the light's far plane); scales with
  // scene size. Trades shadow acne against contact detachment (peter-panning).
  bias: 0.005,
  bulbRadius: 1,
  castShadows: true,
  shadowMapSize: 2048,
  ...options,
});
