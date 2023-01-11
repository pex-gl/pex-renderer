import { mat4 } from "pex-math";

export default (opts = {}) => {
  const camera = {
    fov: Math.PI / 4,
    near: 0.5,
    far: 1000,
    aspect: 1,
    exposure: 1,
    clearColor: [0, 0, 0, 1],
    viewMatrix: mat4.lookAt(mat4.create(), [0, 0, 1], [0, 0, 0], [0, 1, 0]),
    invViewMatrix: mat4.create(),
    ...opts,
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
