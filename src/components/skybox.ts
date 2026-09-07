import type { SkyboxComponentOptions } from "../types.js";

/** Skybox component */
export default (options?: SkyboxComponentOptions) => ({
  // Shared
  backgroundBlur: 0,
  // Irradiance the environment produces, in lux — what calibrates it into the
  // luminance (cd/m²) the rest of the lighting is in. Daylight without its sun,
  // which is what an environment carries here.
  intensity: 30_000,
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
