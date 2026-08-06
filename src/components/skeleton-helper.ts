import type { SkeletonHelperComponentOptions } from "../types.js";

/** Skeleton helper component */
export default (options?: SkeletonHelperComponentOptions) => ({
  color: [
    [0, 0, 1, 1],
    [0, 1, 0, 1],
  ],
  ...options,
});
