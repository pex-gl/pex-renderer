import type { AnimationComponentOptions } from "../types.js";

/** Animation component */
export default (options?: AnimationComponentOptions) => ({
  playing: false,
  loop: false,
  time: 0, // seconds
  channels: [],
  ...options,
});
