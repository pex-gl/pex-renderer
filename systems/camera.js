import { mat4, vec3, quat, utils } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";
import { TEMP_MAT4 } from "../utils.js";

function updateCamera(camera, transform) {
  // TODO: projectionMatrix should only be recomputed if parameters changed
  if (camera.projection === "orthographic") {
    const dx = (camera.right - camera.left) / (2 / camera.zoom);
    const dy = (camera.top - camera.bottom) / (2 / camera.zoom);
    const cx = (camera.right + camera.left) / 2;
    const cy = (camera.top + camera.bottom) / 2;

    let left = cx - dx;
    let right = cx + dx;
    let top = cy + dy;
    let bottom = cy - dy;

    mat4.ortho(
      camera.projectionMatrix,
      left,
      right,
      bottom,
      top,
      camera.near,
      camera.far
    );
  } else {
    mat4.perspective(
      camera.projectionMatrix,
      camera.fov,
      camera.aspect,
      camera.near,
      camera.far
    );
  }

  mat4.set(camera.invViewMatrix, transform.modelMatrix);
  //look at matrix is opposite of camera modelMatrix transform
  mat4.set(camera.viewMatrix, transform.modelMatrix);
  mat4.invert(camera.viewMatrix);
}

export default () => ({
  type: "camera-system",
  updateCamera,
  checkCamera(_, cameraEntity) {
    if (!cameraEntity.transform) {
      console.warn(
        `"${this.type}" camera entity missing transform. Add a transformSystem.update(entities).`
      );
    } else {
      return true;
    }
  },
  update(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (entity.camera && entity.orbiter) {
        if (!this.checkCamera(null, entity)) continue;

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
            zoom: camera.zoom,
            getViewRay: (x, y, windowWidth, windowHeight) => {
              let nx = (2 * x) / windowWidth - 1;
              let ny = 1 - (2 * y) / windowHeight;
              const hNear = 2 * Math.tan(camera.fov / 2) * camera.near;
              const wNear = hNear * camera.aspect;
              nx *= wNear * 0.5;
              ny *= hNear * 0.5; // [origin, direction]

              return [[0, 0, 0], vec3.normalize([nx, ny, -camera.near])];
            },
            set({ target, position, zoom }) {
              if (zoom) {
                camera.zoom = zoom;
                return;
              }

              if (target) {
                vec3.set(orbiter._orbiter.camera.target, target);
                vec3.set(orbiter.target, target);
              }

              if (position) {
                vec3.set(orbiter._orbiter.camera.position, position);
                vec3.set(entity.transform.position, position);
              }

              mat4.lookAt(
                TEMP_MAT4,
                orbiter._orbiter.camera.position,
                orbiter._orbiter.camera.target,
                orbiter._orbiter.camera.up
              );
              mat4.invert(TEMP_MAT4);
              quat.fromMat4(entity.transform.rotation, TEMP_MAT4);
              quat.set(
                orbiter._orbiter.camera.rotationCache,
                entity.transform.rotation
              );

              orbiter.lat = orbiter._orbiter.lat;
              orbiter.lon = orbiter._orbiter.lon;
              orbiter.distance = orbiter._orbiter.distance;

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
          orbiter.distance = orbiter._orbiter.distance;
          orbiter.lat = orbiter._orbiter.lat;
          orbiter.lon = orbiter._orbiter.lon;
          orbiter._orbiter.distanceCache = orbiter._orbiter.distance;
          orbiter._orbiter.latCache = orbiter._orbiter.lat;
          orbiter._orbiter.lonCache = orbiter._orbiter.lon;
        } else {
          if (camera.dirty) {
            camera.dirty = false;

            updateCamera(camera, entity._transform);
          }

          let newPosition = null;
          let newTarget = null;

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
          } else {
            // added cached properties to know if distance,lon,lat changed externally
            // and if they haven't give a chance to _orbiter.updateCamera() to update them
            // comparing orbiter.distance to orbiter._orbiter.distance would always overwrite orbiter
            if (orbiter.distance !== orbiter._orbiter.distanceCache) {
              orbiter._orbiter.distanceCache = orbiter.distance;
              orbiter._orbiter.set({ distance: orbiter.distance });
            }
            if (orbiter.lon !== orbiter._orbiter.lonCache) {
              orbiter._orbiter.lonCache = orbiter.lon;
              orbiter._orbiter.set({ lon: orbiter.lon });
            }
            if (orbiter.lat !== orbiter._orbiter.latCache) {
              orbiter._orbiter.latCache = orbiter.lat;
              orbiter._orbiter.set({ lat: orbiter.lat });
            }
          }

          orbiter._orbiter.updateCamera();

          mat4.identity(camera.invViewMatrix);
          mat4.translate(camera.invViewMatrix, entity.transform.position);
          mat4.mult(
            camera.invViewMatrix,
            mat4.fromQuat(TEMP_MAT4, entity.transform.rotation)
          );
          mat4.set(camera.viewMatrix, camera.invViewMatrix);
          mat4.invert(camera.viewMatrix);
        }
      } else if (entity.camera) {
        if (!this.checkCamera(null, entity)) continue;

        // Camera manually updated or animation
        if (entity.camera.dirty) {
          entity.camera.dirty = false;
          updateCamera(entity.camera, entity._transform);
        }
      }
    }
  },
});
