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
        //TODO: remove proxy and just use camera as component
        if (!orbiter._orbiter) {
          const proxyCamera = {
            viewMatrix: mat4.create(),
            invViewMatrix: camera.invViewMatrix,
            position: entity.orbiter.position || camera.position,
            target: camera.target,
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
              if (position) {
                vec3.set(camera.position, position);
                vec3.set(entity.transform.position, position);
              }
              if (target) {
                debugger;
                console.log(target);
                vec3.set(camera.target, target);
              }
              camera.dirty = true;
              entity.transform = {
                ...entity.transform,
              };
            },
          };
          orbiter._orbiter = createOrbiter({
            element: entity.orbiter.element || document.body, //TODO: element used to default to ctx.gl.canvas
            autoUpdate: false,
            camera: proxyCamera,
            position: entity.orbiter.position || [0, 0, 2.5], //TODO: orbiter position vs distance is confusing, shoudln't it come from camera anyway?
            maxDistance: camera.far * 0.9,
          });
        } else {
          entity.orbiter._orbiter.updateCamera();
          mat4.lookAt(
            camera.viewMatrix,
            camera.position,
            camera.target,
            camera.up
          );

          mat4.set(camera.invViewMatrix, camera.viewMatrix);
          mat4.invert(camera.invViewMatrix);
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
        }
      }
    }
  };
  return cameraSystem;
}
