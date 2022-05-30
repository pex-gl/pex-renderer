import Signal from "signals";

class GridHelper {
  constructor(opts) {
    this.type = "GridHelper";
    this.entity = null;
    this.color = [0.7, 0.7, 0.7, 1];
    this.size = 10;
    this.step = 1;
    this.enabled = true;
    this.changed = new Signal();
    this.dirty = false;

    if (opts) this.set(opts);
  }

  // this function gets called when the component is added
  // to an enity
  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);
    this.dirty = true;
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
  }

  draw(geomBuilder) {
    for (let i = -this.size / 2; i <= this.size / 2; i += this.step) {
      geomBuilder.addPosition([this.size / 2, 0, i]);
      geomBuilder.addPosition([-this.size / 2, 0, i]);
      geomBuilder.addColor(this.color);
      geomBuilder.addColor(this.color);
    }
    for (let i = -this.size / 2; i <= this.size / 2; i += this.step) {
      geomBuilder.addPosition([i, 0, this.size / 2]);
      geomBuilder.addPosition([i, 0, -this.size / 2]);
      geomBuilder.addColor(this.color);
      geomBuilder.addColor(this.color);
    }
  }
}

// by pex-renderer convention we export factory function
// instead of the class type
export default function createGridHelper(opts) {
  return new GridHelper(opts);
}
