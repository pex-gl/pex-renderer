import Signal from "signals";
import { mat4 } from "pex-math";

class Skin {
  constructor(opts) {
    this.type = "Skin";
    this.enabled = true;
    this.changed = new Signal();
    this.entity = null;
    this.joints = [];
    this.jointMatrices = [];
    this.inverseBindMatrices = [];
    this.set(opts);
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));

    if (opts.joints) {
      this.jointMatrices.length = this.joints.length;
      for (let i = 0; i < this.joints.length; i++) {
        this.jointMatrices[i] = this.jointMatrices[i] || mat4.create();
      }
    }
  }

  update() {
    if (!this.enabled) return;

    this.joints.forEach((joint, i) => {
      const m = this.jointMatrices[i];
      mat4.identity(m);
      mat4.mult(m, joint.transform.modelMatrix);
      mat4.mult(m, this.inverseBindMatrices[i]);
    });
  }
}

export default function createSkin(opts) {
  return new Skin(opts);
}
