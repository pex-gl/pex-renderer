import type { CameraHelperComponentOptions } from "../types.js";

/** Camera helper component */
export default (options?: CameraHelperComponentOptions) => ({
  color: [1, 1, 1, 1],
  ...options,
});
