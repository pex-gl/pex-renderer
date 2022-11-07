import { quat } from "pex-math";

export default function createTransform(opts) {
  return {
    position: [0, 0, 0],
    rotation: quat.create(),
    scale: [1, 1, 1],
    ...opts,
  };
}
