import { mat4, vec3, quat, utils, avec4 } from "pex-math";
import { orbiter as createOrbiter } from "pex-cam";
import { NAMESPACE, TEMP_MAT4, TEMP_VEC3 } from "../utils.js";

function computeFrustum(camera) {
  mat4.set(TEMP_MAT4, camera.projectionMatrix);
  mat4.mult(TEMP_MAT4, camera.viewMatrix);

  // prettier-ignore
  {
    avec4.set4(camera.frustum, 0, TEMP_MAT4[3] - TEMP_MAT4[0], TEMP_MAT4[7] - TEMP_MAT4[4], TEMP_MAT4[11] - TEMP_MAT4[8], TEMP_MAT4[15] - TEMP_MAT4[12]) // -x
    avec4.set4(camera.frustum, 1, TEMP_MAT4[3] + TEMP_MAT4[0], TEMP_MAT4[7] + TEMP_MAT4[4], TEMP_MAT4[11] + TEMP_MAT4[8], TEMP_MAT4[15] + TEMP_MAT4[12]) // +x
    avec4.set4(camera.frustum, 2, TEMP_MAT4[3] + TEMP_MAT4[1], TEMP_MAT4[7] + TEMP_MAT4[5], TEMP_MAT4[11] + TEMP_MAT4[9], TEMP_MAT4[15] + TEMP_MAT4[13]) // +y
    avec4.set4(camera.frustum, 3, TEMP_MAT4[3] - TEMP_MAT4[1], TEMP_MAT4[7] - TEMP_MAT4[5], TEMP_MAT4[11] - TEMP_MAT4[9], TEMP_MAT4[15] - TEMP_MAT4[13]) // -y
    avec4.set4(camera.frustum, 4, TEMP_MAT4[3] - TEMP_MAT4[2], TEMP_MAT4[7] - TEMP_MAT4[6], TEMP_MAT4[11] - TEMP_MAT4[10], TEMP_MAT4[15] - TEMP_MAT4[14]) // +z (far)
    avec4.set4(camera.frustum, 5, TEMP_MAT4[3] + TEMP_MAT4[2], TEMP_MAT4[7] + TEMP_MAT4[6], TEMP_MAT4[11] + TEMP_MAT4[10], TEMP_MAT4[15] + TEMP_MAT4[14]) // -z (near)
  }

  // Normalize planes
  for (let i = 0; i < 6; i++) {
    TEMP_VEC3[0] = camera.frustum[i * 4];
    TEMP_VEC3[1] = camera.frustum[i * 4 + 1];
    TEMP_VEC3[2] = camera.frustum[i * 4 + 2];

    avec4.scale(camera.frustum, i, vec3.length(TEMP_VEC3));
  }
}

function updateCamera(camera, transform) {
  // calculate new fov based on sensor size and focal length
  // let sensorWidth = camera.sensorSize[0];
  // let sensorHeight = camera.sensorSize[1];
  // const sensorAspectRatio = sensorWidth / sensorHeight;
  // if (camera.aspect > sensorAspectRatio) {
  //   if (camera.sensorFit === "horizontal" || camera.sensorFit === "fill") {
  //     sensorHeight = sensorWidth / camera.aspect;
  //   }
  // } else {
  //   //camera.aspect <= sensorAspectRatio
  //   if (camera.sensorFit === "horizontal" || camera.sensorFit === "overscan") {
  //     sensorHeight = sensorWidth / camera.aspect;
  //   }
  // }
  // const hardcodedFoV = false;
  // if (hardcodedFoV) {
  //   camera.focalLength = sensorHeight / 2 / Math.tan(camera.fov / 2);
  // } else {
  //   camera.fov = 2 * Math.atan(sensorHeight / 2 / camera.focalLength);
  // }
  // camera.actualSensorHeight = sensorHeight;

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

    if (camera.view) {
      const zoomW =
        1 / camera.zoom / (camera.view.size[0] / camera.view.totalSize[0]);
      const zoomH =
        1 / camera.zoom / (camera.view.size[1] / camera.view.totalSize[1]);
      const scaleW = (camera.right - camera.left) / camera.view.size[0];
      const scaleH = (camera.top - camera.bottom) / camera.view.size[1];

      left += scaleW * (camera.view.offset[0] / zoomW);
      right = left + scaleW * (camera.view.size[0] / zoomW);
      top -= scaleH * (camera.view.offset[1] / zoomH);
      bottom = top - scaleH * (camera.view.size[1] / zoomH);
    }

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
    if (camera.view) {
      const aspectRatio = camera.view.totalSize[0] / camera.view.totalSize[1];

      const top = Math.tan(camera.fov * 0.5) * camera.near;
      const bottom = -top;
      const left = aspectRatio * bottom;
      const right = aspectRatio * top;
      const width = Math.abs(right - left);
      const height = Math.abs(top - bottom);
      const widthNormalized = width / camera.view.totalSize[0];
      const heightNormalized = height / camera.view.totalSize[1];

      const l = left + camera.view.offset[0] * widthNormalized;
      const r =
        left + (camera.view.offset[0] + camera.view.size[0]) * widthNormalized;
      const b =
        top - (camera.view.offset[1] + camera.view.size[1]) * heightNormalized;
      const t = top - camera.view.offset[1] * heightNormalized;

      mat4.frustum(
        camera.projectionMatrix,
        l,
        r,
        b,
        t,
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
  }

  mat4.set(camera.invViewMatrix, transform.modelMatrix);
  //look at matrix is opposite of camera modelMatrix transform
  mat4.set(camera.viewMatrix, transform.modelMatrix);
  mat4.invert(camera.viewMatrix);

  if (camera.culling) computeFrustum(camera);
}

/**
 * Camera system
 *
 * Adds:
 * - "_orbiter" to orbiter components
 * @returns {import("../types.js").System}
 */
export default () => ({
  type: "camera-system",
  cache: {},
  debug: false,
  updateCamera,
  checkCamera(_, cameraEntity) {
    if (!cameraEntity.transform) {
      console.warn(
        NAMESPACE,
        this.type,
        `camera entity missing transform. Add a transformSystem.update(entities).`
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
              // TODO: need to check lat/lon/dist change?
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
