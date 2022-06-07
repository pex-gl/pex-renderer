import { vec3, vec4, mat3, mat4 } from "pex-math";
import createEntity from "./entity.js";
import createTransform from "./components/transform.js";
import createGeometry from "./components/geometry.js";
import createMaterial from "./components/material.js";
import createSkybox from "./components/skybox.js";
import createReflectionProbe from "./components/reflection-probe.js";

class Renderer {
  constructor(opts) {
    this.entities = [];

    // check if we passed gl context or options object
    opts = opts.texture2D ? { ctx: opts } : opts;

    const ctx = (this._ctx = opts.ctx);

    console.log(ctx);
    console.log(ctx.pass);
    this._clearCmd = {
      pass: ctx.pass({
        clearColor: [0, 0.75, 0.5, 1],
      }),
    };
  }

  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  entity(components, tags) {
    if (tags) {
      throw new Error(
        "Tags are deprecated. Use component props instead of tags."
      );
    }
    if (Array.isArray(components)) {
      throw new Error(
        "Arrays of components are deprecated. Use component props instead."
      );
    }
    return createEntity(components);
  }

  transform(opts) {
    return createTransform(opts);
  }

  geometry(opts) {
    return createGeometry(opts);
  }

  material(opts) {
    return createMaterial(opts);
  }

  camera(opts) {
    return {};
  }

  skybox(opts) {
    return createSkybox(opts);
  }

  reflectionProbe(opts) {
    return createReflectionProbe(opts);
  }

  draw() {
    const ctx = this._ctx;
    ctx.submit(this._clearCmd);
  }
}

export default function createRenderer(opts) {
  return new Renderer(opts);
}
