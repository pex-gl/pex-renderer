import type { AmbientLightComponentOptions } from "../types.js";

/** Ambient light component */
export default (options?: AmbientLightComponentOptions) => ({
  color: [1, 1, 1, 1],
  // Luminance (cd/m²), the unit image-based lighting uses: a stand-in for an
  // environment of uniform brightness, not an extra lamp.
  intensity: 1,
  ...options,
});
