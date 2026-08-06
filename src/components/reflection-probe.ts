import type { ReflectionProbeComponentOptions } from "../types.js";

/** Reflection probe component */
export default (options?: ReflectionProbeComponentOptions) => ({
  size: 1024,
  ...options,
});
