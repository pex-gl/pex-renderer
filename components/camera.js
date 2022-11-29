import { mat4 } from "pex-math";

export default function createCamera(opts = {}) {
  //TODO: just return pex-cam object for now not to duplicate functionality
  //TODO: how do we handle setters
  const camera = {
    fov: Math.PI / 4,
    aspect: 1,
    near: 0.5,
    far: 1000,
    exposure: 1,
    clearColor: [1, 0, 0, 1],
    ...opts,
  };
  //should this be in systems?
  const projectionMatrix = mat4.perspective(
    mat4.create(),
    camera.fov,
    camera.aspect,
    camera.near,
    camera.far
  );
  const viewMatrix = mat4.lookAt(
    mat4.create(),
    [0, 0, 1],
    [0, 0, 0],
    [0, 1, 0]
  );
  camera.projectionMatrix = projectionMatrix;
  camera.viewMatrix = viewMatrix;
  camera.invViewMatrix = mat4.create();
  return camera;
}
