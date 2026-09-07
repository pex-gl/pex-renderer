import { mat4 } from "pex-math";

import type { CameraComponentOptions } from "../types.js";

/** Camera component */
export default (options?: CameraComponentOptions) => {
  const camera = {
    projection: "perspective",
    near: 0.5,
    far: 1000,
    aspect: 1,
    clearColor: [0, 0, 0, 1],
    viewMatrix: mat4.lookAt(mat4.create(), [0, 0, 1], [0, 0, 0], [0, 1, 0]),
    inverseViewMatrix: mat4.create(),
    projectionMatrix: mat4.create(),
    culling: false,
    frustum: new Float32Array(24),

    focalLength: 50, // mm
    fStop: 16,
    sensorSize: [36, 24], // mm
    actualSensorHeight: 24, // mm
    sensorFit: "vertical",

    // Exposure is always metered from `fStop` and the two below; there is no
    // unitless mode to switch to, so no scene has to be re-authored to follow
    // one. Lighting kept in relative values meters itself with
    // `exposureCompensation`.
    //
    // Sunny 16 as it is actually written — f/16 at 1/ISO — which puts an 18%
    // grey card at 0.198 under the default sun and sky. The aperture is the
    // exposure's, not the depth of field's: a shot that wants bokeh opens up
    // and re-meters, the same five stops a photographer pays.
    shutterSpeed: 1 / 125, // s
    iso: 100,
    exposureCompensation: 0, // stops
    // view
    ...options,
  };
  if (camera.projection === "orthographic") {
    camera.left ||= -1;
    camera.right ||= 1;
    camera.bottom ||= -1;
    camera.top ||= 1;
    camera.zoom ||= 1;
  } else {
    camera.fov ||= Math.PI / 4;
  }

  return camera;
};
