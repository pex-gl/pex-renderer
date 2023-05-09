import { mat4 } from "pex-math";

/**
 * Camera component
 * @param {import("../types.js").CameraComponentOptions} [options]
 * @returns {object}
 * @module CameraComponent
 * @exports module:CameraComponent
 */
export default (options) => {
  const camera = {
    projection: "perspective",
    fov: Math.PI / 4,
    near: 0.5,
    far: 1000,
    aspect: 1,
    clearColor: [0, 0, 0, 1],
    viewMatrix: mat4.lookAt(mat4.create(), [0, 0, 1], [0, 0, 0], [0, 1, 0]),
    invViewMatrix: mat4.create(),
    // exposure: 1,
    // left: -1,
    // right: 1,
    // bottom: -1,
    // top: 1,
    // zoom: 1,

    // focalLength: 50, // mm
    // fStop: 2.8,

    // sensorSize: [36, 24], // mm
    // actualSensorHeight: 24, // mm
    // sensorFit: "vertical",
    ...options,
  };
  // TODO: should this be in systems
  camera.projectionMatrix = mat4.perspective(
    mat4.create(),
    camera.fov,
    camera.aspect,
    camera.near,
    camera.far
  );
  return camera;
};
