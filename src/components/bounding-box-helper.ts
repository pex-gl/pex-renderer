import type { BoundingBoxHelperComponentOptions } from "../types.js";

/** Bounding box helper component */
export default (options?: BoundingBoxHelperComponentOptions) => ({
  color: [1, 0, 0, 1],
  ...options,
});
