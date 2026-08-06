import type { OrbiterComponentOptions } from "../types.js";

/** Orbiter component */
export default (options?: OrbiterComponentOptions) => ({
  target: [0, 0, 0],
  lat: 0,
  lon: 0,
  distance: 10,
  // element: document.body,
  ...options,
});
