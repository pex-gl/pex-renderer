import type { SkyboxComponentOptions } from "../types.js";

/** Skybox component */
export default (options?: SkyboxComponentOptions) => ({
  // Shared
  backgroundBlur: false,
  exposure: 1,
  // Sky
  turbidity: 10,
  rayleigh: 2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  // sunPosition,
  // Environment map
  // envMap,
  ...options,
});
