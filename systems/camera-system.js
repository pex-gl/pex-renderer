import { mat4, vec3 } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";

const tmpMatrix = mat4.create();

export default function createCameraSystem() {
  return {
    update: (entities) => {
      for (let entity of entities) {
        if (entity.camera && entity.orbiter) {
          const orbiter = entity.orbiter;
          const camera = entity.camera;
          if (!orbiter._orbiter) {
            const proxyCamera = {
              position: camera.position,
              target: camera.target,
              set({ position }) {
                vec3.set(camera.position, position);
              },
            };
            orbiter._orbiter = createOrbiter({
              element: entity.orbiter.element,
              autoUpdate: false,
              camera: proxyCamera,
            });
          } else {
            entity.orbiter._orbiter.updateCamera();
            mat4.lookAt(
              camera._viewMatrix,
              camera.position,
              camera.target,
              camera.up
            );
          }
        }
      }
    },
  };
}
