import { mat4, vec3 } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";

const tmpMatrix = mat4.create();

export default function createCameraSystem() {
  const cameraSystem = {
    type: "camera-system",
  };

  cameraSystem.update = (entities) => {
    for (let entity of entities) {
      if (entity.camera && entity.orbiter) {
        const orbiter = entity.orbiter;
        const camera = entity.camera;
        if (!orbiter._orbiter) {
          const proxyCamera = {
            viewMatrix: mat4.create(),
            position: camera.position,
            target: camera.target,
            set({ position }) {
              vec3.set(camera.position, position);
            },
          };
          orbiter._orbiter = createOrbiter({
            element: entity.orbiter.element || document.body, //TODO: element used to default to ctx.gl.canvas
            autoUpdate: false,
            camera: proxyCamera,
            distance: 2,
          });
        } else {
          entity.orbiter._orbiter.updateCamera();
          mat4.lookAt(
            camera.viewMatrix,
            camera.position,
            camera.target,
            camera.up
          );

          mat4.set(camera.inverseViewMatrix, camera.viewMatrix);
          mat4.invert(camera.inverseViewMatrix);
        }
      }
    }
  };
  return cameraSystem;
}
