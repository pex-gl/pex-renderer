import { mat4, vec3, quat, utils } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";

const tmpMatrix = mat4.create();

export default function createCameraSystem() {
  const cameraSystem = {
    type: "camera-system",
  };

  const tempMat = mat4.create();

  let debuggerCountdown = 4;

  var tempMat4multQuatMat4 = mat4.create();
  function mat4multQuat(m, q) {
    mat4.fromQuat(tempMat4multQuatMat4, q);
    mat4.mult(m, tempMat4multQuatMat4);
    return m;
  }

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

              entity.transform.dirty = true;
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

          let newPosition = null;
          let newTarget = null;
          let newTarget2 = null;

          // check if camera moved without _orbiter intervention
          if (
            vec3.distance(
              orbiter._orbiter.camera.position,
              entity.transform.position
            ) > utils.EPSILON
          ) {
            newPosition = [...entity.transform.position];
          }

          //check if camera rotated without orbiter intervention
          if (
            vec3.distance(
              orbiter._orbiter.camera.rotationCache,
              entity.transform.rotation
            ) > utils.EPSILON
          ) {
            // console.log("sync with camera rotation");
            newTarget = [0, 0, -orbiter._orbiter.distance];
            const useInvMatrix = false;
            if (useInvMatrix) {
              vec3.multMat4(newTarget, camera.invViewMatrix); //this is out of date?
            } else {
              vec3.multQuat(newTarget, entity.transform.rotation);
              vec3.add(newTarget, entity.transform.position);
            }
          }

          // check if camera orbiter moved without _orbiter intervention
          if (
            vec3.distance(orbiter.target, orbiter._orbiter.camera.target) >
            utils.EPSILON
          ) {
            newTarget = orbiter.target;
            // console.log("sync with orbiter target");
          }

          if (newPosition || newTarget) {
            const opts = {};
            if (newPosition) {
              opts.position = [...newPosition];
            }
            if (newTarget) {
              opts.target = [...newTarget];
            }
            orbiter._orbiter.camera.set(opts);
            orbiter._orbiter.set({
              camera: orbiter._orbiter.camera,
            });
          }

          orbiter._orbiter.updateCamera();

          mat4.identity(camera.invViewMatrix);
          mat4.translate(camera.invViewMatrix, entity.transform.position);
          mat4multQuat(camera.invViewMatrix, entity.transform.rotation);
          mat4.set(camera.viewMatrix, camera.invViewMatrix);
          mat4.invert(camera.viewMatrix);
        }
      }
    }
  };
  return cameraSystem;
}
