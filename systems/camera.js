import { mat4, vec3, quat, utils } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";

const tmpMatrix = mat4.create();

export default function createCameraSystem() {
  const cameraSystem = {
    type: "camera-system",
  };

  const tempMat = mat4.create();

  cameraSystem.update = (entities) => {
    for (let entity of entities) {
      if (entity.camera && entity.orbiter) {
        const orbiter = entity.orbiter;
        const camera = entity.camera;

        if (!orbiter._orbiter) {
          const proxyCamera = {
            viewMatrix: camera.viewMatrix,
            invViewMatrix: camera.invViewMatrix,
            position: [...entity.transform.position],
            target: [...orbiter.target],
            up: [0, 1, 0],
            getViewRay: (x, y, windowWidth, windowHeight) => {
              let nx = (2 * x) / windowWidth - 1;
              let ny = 1 - (2 * y) / windowHeight;
              const hNear = 2 * Math.tan(camera.fov / 2) * camera.near;
              const wNear = hNear * camera.aspect;
              nx *= wNear * 0.5;
              ny *= hNear * 0.5; // [origin, direction]

              return [[0, 0, 0], vec3.normalize([nx, ny, -camera.near])];
            },
            set({ target, position }) {
              if (target) {
                vec3.set(entity.orbiter._orbiter.camera.target, target);
              }

              if (position) {
                vec3.set(entity.orbiter._orbiter.camera.position, position);
                vec3.set(entity.transform.position, position);
              }

              mat4.lookAt(
                tempMat,
                entity.orbiter._orbiter.camera.position,
                entity.orbiter._orbiter.camera.target,
                entity.orbiter._orbiter.camera.up
              );
              mat4.invert(tempMat);
              quat.fromMat4(entity.transform.rotation, tempMat);

              entity.transform = {
                ...entity.transform,
              };
              camera.dirty = true;
            },
          };
          orbiter._orbiter = createOrbiter({
            element: entity.orbiter.element || document.body, //TODO: element used to default to ctx.gl.canvas
            autoUpdate: false,
            camera: proxyCamera,
            position: proxyCamera.position,
            maxDistance: camera.far * 0.9,
          });
        } else {
          if (
            vec3.distance(
              entity.orbiter._orbiter.camera.position,
              entity.transform.position
            ) > utils.EPSILON
          ) {
            vec3.set(
              entity.orbiter._orbiter.camera.position,
              entity.transform.position
            );
            entity.orbiter._orbiter.set({
              camera: entity.orbiter._orbiter.camera,
            });
          }
          entity.orbiter._orbiter.updateCamera();
        }

        if (camera.dirty) {
          camera.dirty = false;
          mat4.perspective(
            camera.projectionMatrix,
            camera.fov,
            camera.aspect,
            camera.near,
            camera.far
          );

          mat4.set(camera.invViewMatrix, entity._transform.modelMatrix);
          //look at matrix is opposite of camera modelMatrix transform
          mat4.set(camera.viewMatrix, entity._transform.modelMatrix);
          mat4.invert(camera.viewMatrix);
        }
      }
    }
  };
  return cameraSystem;
}
