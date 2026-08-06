import type { AmbientLightComponentOptions } from "../types.js";

/** Ambient light component */
export default (options?: AmbientLightComponentOptions) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  ...options,
});
