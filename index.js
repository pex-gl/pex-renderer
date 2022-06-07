import { vec3, vec4, mat3, mat4 } from "pex-math";

import createEntity from "./entity.js";
import createCamera from "./components/camera.js";
import createGeometry from "./components/geometry.js";
import createMaterial from "./components/material.js";
import createOrbiter from "./components/orbiter.js";
import createReflectionProbe from "./components/reflection-probe.js";
import createSkybox from "./components/skybox.js";
import createTransform from "./components/transform.js";

import createCameraSystem from "./systems/camera-system.js";
import createGeometrySystem from "./systems/geometry-system.js";
import createTransformSystem from "./systems/transform-system.js";

class Renderer {
  constructor(opts) {
    this.entities = [];
    this.systems = [];

    // check if we passed gl context or options object
    opts = opts.texture2D ? { ctx: opts } : opts;

    const ctx = (this._ctx = opts.ctx);

    this._clearCmd = {
      pass: ctx.pass({
        clearColor: [0, 0.75, 0.5, 1],
      }),
    };

    this._drawSth = {
      pipeline: ctx.pipeline({
        vert: /*glsl*/ `
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        attribute vec3 aPosition;
        void main() {
          gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
        }
        `,
        frag: /*glsl*/ `
        precision highp float;
        uniform vec4 uBaseColor;
        void main() {
          gl_FragColor = uBaseColor;
        }
        `,
        depthTest: true,
        depthWrite: true,
      }),
      attributes: {
        aPosition: ctx.vertexBuffer([
          [-1, -1, 0],
          [1, -1, 0],
          [0, 1, 0],
        ]),
      },
      indices: ctx.indexBuffer([0, 1, 2]),
    };

    const cameraSystem = createCameraSystem();
    this.systems.push(cameraSystem);
  }

  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  addSystem(system) {
    this.systems.push(system);
    return system;
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

  camera(opts) {
    return createCamera(opts);
  }

  geometry(opts) {
    return createGeometry(opts);
  }

  material(opts) {
    return createMaterial(opts);
  }

  orbiter(opts) {
    return createOrbiter(opts);
  }

  skybox(opts) {
    return createSkybox(opts);
  }

  reflectionProbe(opts) {
    return createReflectionProbe(opts);
  }

  transform(opts) {
    return createTransform(opts);
  }

  cameraSystem(opts = {}) {
    return createCameraSystem(opts);
  }

  geometrySystem(opts = {}) {
    return createGeometrySystem({
      ...opts,
      ctx: this._ctx,
    });
  }

  transformSystem(opts = {}) {
    return createTransformSystem(opts);
  }

  update() {
    this.systems.forEach((system) => {
      system.update(this.entities);
    });
  }

  draw() {
    this.update();
    const ctx = this._ctx;
    ctx.submit(this._clearCmd);

    const camera = this.entities.find((e) => e.camera).camera;

    const geometryEntities = this.entities.filter((e) => e.geometry);

    for (let entity of geometryEntities) {
      const cachedGeometry = entity._geometry;
      const cachedTransform = entity._transform;
      ctx.submit(this._drawSth, {
        indices: cachedGeometry.indices,
        attributes: cachedGeometry.attributes,
        uniforms: {
          uProjectionMatrix: camera._projectionMatrix,
          uViewMatrix: camera._viewMatrix,
          uModelMatrix: cachedTransform.modelMatrix,
          uBaseColor: entity.material.baseColor,
        },
      });
    }
  }
}

export default function createRenderer(opts) {
  return new Renderer(opts);
}
