import { mat4 } from "pex-math";
import { lens } from "cameras";

import type { CameraComponentOptions } from "../types.js";

/** Camera component */
export default (options?: CameraComponentOptions) => ({
  projection: "perspective",
  near: 0.5,
  far: 1000,
  zoom: 1,
  fov: lens.DEFAULT_FOV,
  size: 1,
  backgroundColor: [0, 0, 0, 1],
  culling: false,

  sensorSize: [...lens.FULL_FRAME],
  sensorFit: "vertical",
  fStop: 16,

  // Always metered, no unitless mode: relative lighting adjusts with
  // `exposureCompensation`.
  // Sunny 16 (f/16 at 1/ISO): an 18% grey card reads 0.198 under the default
  // sun and sky. Opening up for bokeh needs re-metering.
  shutterSpeed: 1 / 125, // s
  iso: 100,
  exposureCompensation: 0, // stops

  aspect: 1,
  projectionMatrix: mat4.create(),
  viewMatrix: mat4.create(),
  inverseViewMatrix: mat4.create(),
  frustum: new Float32Array(24),
  ...options,
});
