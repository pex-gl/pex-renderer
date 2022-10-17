import { mat4, vec3, quat, utils } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";

const tmpMatrix = mat4.create();

export default function createCameraSystem() {
  const cameraSystem = {
    type: "camera-system",
  };

  const tempMat = mat4.create();

  let debuggerCountdown = 4;

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
            rotationCache: [...entity.transform.rotation],
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
                vec3.set(orbiter._orbiter.camera.target, target);
                vec3.set(orbiter.target, target);
              }

              if (position) {
                vec3.set(orbiter._orbiter.camera.position, position);
                vec3.set(entity.transform.position, position);
              }

              mat4.lookAt(
                tempMat,
                orbiter._orbiter.camera.position,
                orbiter._orbiter.camera.target,
                orbiter._orbiter.camera.up
              );
              mat4.invert(tempMat);
              quat.fromMat4(entity.transform.rotation, tempMat);
              quat.set(
                orbiter._orbiter.camera.rotationCache,
                entity.transform.rotation
              );

              entity.transform = {
                ...entity.transform,
              };
              camera.dirty = true;
            },
          };
          orbiter._orbiter = createOrbiter({
            element: orbiter.element || document.body, //TODO: element used to default to ctx.gl.canvas
            autoUpdate: false,
            camera: proxyCamera,
            position: proxyCamera.position,
            maxDistance: camera.far * 0.9,
          });
          orbiter._orbiter.updateCamera();
        } else {
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

          // check if camera moved without _orbiter intervention
          if (
            vec3.distance(
              orbiter._orbiter.camera.position,
              entity.transform.position
            ) > utils.EPSILON
          ) {
            console.log("sync with camera position");
            orbiter._orbiter.camera.set({
              position: [...entity.transform.position],
            });
            orbiter._orbiter.set({
              camera: orbiter._orbiter.camera,
            });
          }

          if (
            vec3.distance(
              orbiter._orbiter.camera.rotationCache,
              entity.transform.rotation
            ) > utils.EPSILON
          ) {
            console.log("sync with camera rotation");
            const newTarget = [0, 0, -orbiter._orbiter.distance];
            vec3.multMat4(newTarget, camera.invViewMatrix);
            orbiter._orbiter.camera.set({ target: [...newTarget] });
            orbiter.target = [...newTarget];

            orbiter._orbiter.set({
              camera: orbiter._orbiter.camera,
            });
          }

          // check if camera orbiter moved without _orbiter intervention
          if (
            vec3.distance(orbiter.target, orbiter._orbiter.camera.target) >
            utils.EPSILON
          ) {
            console.log("sync with orbiter target");
            orbiter._orbiter.camera.set({ target: orbiter.target });
            orbiter._orbiter.set({
              camera: orbiter._orbiter.camera,
            });
            // orbiter._orbiter.updateCamera();
          }

          /*
          //check if camera rotated without orbiter intervention
          const newTarget = [0, 0, -orbiter._orbiter.distance];
          vec3.multMat4(newTarget, camera.invViewMatrix);
          if (
            vec3.distance(orbiter._orbiter.camera.target, newTarget) >
            utils.EPSILON
          ) {
            if (debuggerCountdown-- < 0) debugger;
            console.log("sync with camera rotation", camera.dirty);
            console.log(
              newTarget,
              orbiter._orbiter.camera.target,
              // vec3.distance(orbiter._orbiter.camera.target, newTarget),
              vec3.distance(entity.transform.position, newTarget),
              vec3.distance(
                orbiter._orbiter.camera.target,
                orbiter._orbiter.camera.position
              ),
              orbiter._orbiter.distance,
              camera.invViewMatrix
            );

            orbiter._orbiter.camera.set({ target: [...newTarget] });
            orbiter.target = [...newTarget];

            orbiter._orbiter.set({
              camera: orbiter._orbiter.camera,
            });
            console.log(
              newTarget,
              orbiter._orbiter.camera.target,
              // vec3.distance(orbiter._orbiter.camera.target, newTarget),
              vec3.distance(entity.transform.position, newTarget),
              vec3.distance(
                orbiter._orbiter.camera.target,
                orbiter._orbiter.camera.position
              ),
              orbiter._orbiter.distance,
              camera.invViewMatrix
            );
          }
          */

          orbiter._orbiter.updateCamera();
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
