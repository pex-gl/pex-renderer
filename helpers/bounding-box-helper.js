import Signal from "signals";

class BoundingBoxHelper {
  constructor(opts) {
    this.type = "BoundingBoxHelper";
    this.entity = null;
    this.enabled = true;
    this.color = [1, 0, 0, 1];
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

  getBBoxPositionsList(bbox) {
    return [
      [bbox[0][0], bbox[0][1], bbox[0][2]],
      [bbox[1][0], bbox[0][1], bbox[0][2]],
      [bbox[0][0], bbox[0][1], bbox[0][2]],
      [bbox[0][0], bbox[1][1], bbox[0][2]],
      [bbox[0][0], bbox[0][1], bbox[0][2]],
      [bbox[0][0], bbox[0][1], bbox[1][2]],
      [bbox[1][0], bbox[1][1], bbox[1][2]],
      [bbox[0][0], bbox[1][1], bbox[1][2]],
      [bbox[1][0], bbox[1][1], bbox[1][2]],
      [bbox[1][0], bbox[0][1], bbox[1][2]],
      [bbox[1][0], bbox[1][1], bbox[1][2]],
      [bbox[1][0], bbox[1][1], bbox[0][2]],
      [bbox[1][0], bbox[0][1], bbox[0][2]],
      [bbox[1][0], bbox[0][1], bbox[1][2]],
      [bbox[1][0], bbox[0][1], bbox[0][2]],
      [bbox[1][0], bbox[1][1], bbox[0][2]],
      [bbox[0][0], bbox[1][1], bbox[0][2]],
      [bbox[1][0], bbox[1][1], bbox[0][2]],
      [bbox[0][0], bbox[1][1], bbox[0][2]],
      [bbox[0][0], bbox[1][1], bbox[1][2]],
      [bbox[0][0], bbox[0][1], bbox[1][2]],
      [bbox[0][0], bbox[1][1], bbox[1][2]],
      [bbox[0][0], bbox[0][1], bbox[1][2]],
      [bbox[1][0], bbox[0][1], bbox[1][2]],
    ];
  }

  getBBoxGeometry(geomBuilder, bbox, color) {
    let positions = this.getBBoxPositionsList(bbox);
    positions.forEach((pos) => {
      geomBuilder.addPosition(pos);
      geomBuilder.addColor(color);
    });
  }

  draw(geomBuilder) {
    this.getBBoxGeometry(
      geomBuilder,
      this.entity.transform.worldBounds,
      this.color
    );
  }
}

// by pex-renderer convention we export factory function
// instead of the class type
export default function createBoundingBoxHelper(opts) {
  return new BoundingBoxHelper(opts);
}
