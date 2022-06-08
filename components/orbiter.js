import Signal from "signals";
import { mat4, quat } from "pex-math";
import { orbiter } from "pex-cam";

const up = [0, 1, 0];

class Orbiter {
  constructor(opts = {}) {
    this.type = "Orbiter";
    this.enabled = true;
    this.changed = new Signal();
    this.entity = null;
    this.dirty = false;

    this.position = [0, 0, 1];
    this.target = [0, 0, 0];
    this.matrix = mat4.create();

    this.control = orbiter({
      ...opts,
      element: opts.ctx.gl.canvas,
      autoUpdate: false,
    });
    this.set({ position: this.position, target: this.target, ...opts });
  }

  init(entity) {
    this.entity = entity;
    this.update();
  }

  set(opts) {
    Object.assign(this, opts);
    if (opts.target || opts.position) {
      this.control.set({
        ...opts,
        autoUpdate: false,
        camera: {
          position: this.position,
          target: this.target,
          zoom: this.entity?.camera?.zoom,
        },
      });
    }
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));
  }

  update() {
    const camera = this.entity.getComponent("Camera");
    this.control.camera ||= {};
    this.control.camera.position = this.position;
    this.control.camera.target = this.target;
    this.control.camera.zoom = camera.zoom;

    this.control.camera.set = ({ position, zoom }) => {
      if (position) this.position = position;

      mat4.identity(this.matrix);
      mat4.lookAt(this.matrix, this.position, this.target, up);
      mat4.invert(this.matrix);

      const transformCmp = this.entity.transform;
      const rotation = transformCmp.rotation;
      quat.fromMat4(rotation, this.matrix);

      if (camera) {
        transformCmp.set({ position: this.position, rotation });

        if (camera.projection === "orthographic" && zoom !== undefined) {
          camera.set({ zoom });
        }
      } else {
        transformCmp.set({
          rotation,
        });
      }
    };
    this.control.updateCamera();
  }

  dispose() {
    this.control.dispose();
  }
}

export default function createOrbiter(opts = {}) {
  // return new Orbiter(opts);
  return {
    ...opts,
  };
}
