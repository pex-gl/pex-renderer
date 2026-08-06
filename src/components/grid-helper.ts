import type { GridHelperComponentOptions } from "../types.js";

/** Grid helper component */
export default (options?: GridHelperComponentOptions) => ({
  color: [1, 1, 1, 1],
  size: 10,
  ...options,
});
