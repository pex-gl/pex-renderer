import type { PointLightComponentOptions } from "../types.js";

/** Point light component */
export default (options?: PointLightComponentOptions) => ({
  color: [1, 1, 1, 1],
  // Luminous power (lm), about a 75 W incandescent bulb. Reads as almost
  // nothing against the default sun; an interior wants the camera stopped down
  // to match, the way a real one would be.
  intensity: 1000,
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
