import type { TransformComponentOptions } from "../types.js";

/** Transform component */
export default (options?: TransformComponentOptions) => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
  // parent,
  // worldBounds,
  // aabbDirty,
  // dirty,
  ...options,
});
