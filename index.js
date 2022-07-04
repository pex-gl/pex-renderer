import createEntity from "./entity.js";
import createAnimation from "./components/animation.js";
import createCamera from "./components/camera.js";
import createAmbientLight from "./components/ambient-light.js";
import createDirectionalLight from "./components/directional-light.js";
import createPointLight from "./components/point-light.js";
import createAreaLight from "./components/area-light.js";

import createGeometry from "./components/geometry.js";
import createMaterial from "./components/material.js";
import createMorph from "./components/morph.js";
import createOrbiter from "./components/orbiter.js";
import createReflectionProbe from "./components/reflection-probe.js";
import createSkybox from "./components/skybox.js";
import createTransform from "./components/transform.js";

import createCameraSystem from "./systems/camera-system.js";
import createGeometrySystem from "./systems/geometry-system.js";
import createReflectionProbeSystem from "./systems/reflection-probe-system.js";
import createRenderSystem from "./systems/render-system.js";
import createSkyboxSystem from "./systems/skybox-system.js";
import createTransformSystem from "./systems/transform-system.js";

import loadGltf from "./loaders/glTF.js";

class Renderer {
  constructor(opts) {
    this.entities = [];
    this.systems = [];

    // check if we passed gl context or options object
    opts = opts.texture2D ? { ctx: opts } : opts;

    const ctx = (this._ctx = opts.ctx);

    this._drawSth = {
      pipeline: ctx.pipeline({
        vert: /*glsl*/ `
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        attribute vec3 aPosition;
        attribute vec3 aNormal;

        varying vec3 vNormal;
        void main() {
          gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
          vNormal = aNormal;
        }
        `,
        frag: /*glsl*/ `
        precision highp float;
        uniform vec4 uBaseColor;
        varying vec3 vNormal;
        void main() {
          gl_FragColor = uBaseColor;
          gl_FragColor.rgb = vNormal * 0.5 + 0.5;
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

  animation(opts) {
    return createAnimation(opts);
  }

  camera(opts) {
    return createCamera(opts);
  }

  ambientLight(opts) {
    return createAmbientLight(opts);
  }

  areaLight(opts) {
    return createAreaLight(opts);
  }

  directionalLight(opts) {
    return createDirectionalLight(opts);
  }

  pointLight(opts) {
    return createPointLight(opts);
  }

  spotLight(opts) {
    return createSpotLight(opts);
  }

  geometry(opts) {
    return createGeometry(opts);
  }

  material(opts) {
    return createMaterial(opts);
  }

  morph(opts) {
    return createMorph(opts);
  }

  orbiter(opts) {
    return createOrbiter(opts);
  }

  skin(opts) {
    return {}; //TODO: implement skin
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

  reflectionProbeSystem(opts = {}) {
    return createReflectionProbeSystem({
      ...opts,
      ctx: this._ctx,
    });
  }

  renderSystem(opts = {}) {
    return createRenderSystem({
      ...opts,
      ctx: this._ctx,
    });
  }

  skyboxSystem(opts = {}) {
    return createSkyboxSystem({
      ...opts,
      ctx: this._ctx,
    });
  }

  transformSystem(opts = {}) {
    return createTransformSystem(opts);
  }

  loadScene(url, options) {
    return loadGltf(url, this, options);
  }

  update() {
    this.systems.forEach((system) => {
      system.update(this.entities);
    });
  }

  draw() {
    if (this.systems.length == 0) {
      console.warn("No systems present. There is nothing to draw.");
    }
    try {
      this.update();
    } catch (e) {
      console.error(e);
      this.update = () => {};
    }

    const ctx = this._ctx;

    // const camera = this.entities.find((e) => e.camera).camera;

    // const geometryEntities = this.entities.filter((e) => e.geometry);

    // let i = 0;
    // for (let entity of geometryEntities) {
    //   i++;
    //   // if (i != 5) continue;
    //   const cachedGeometry = entity._geometry;
    //   const cachedTransform = entity._transform;
    //   ctx.submit(this._drawSth, {
    //     name: "drawMesh",
    //     indices: cachedGeometry.indices,
    //     attributes: cachedGeometry.attributes,
    //     uniforms: {
    //       uProjectionMatrix: camera._projectionMatrix,
    //       uViewMatrix: camera._viewMatrix,
    //       uModelMatrix: cachedTransform.modelMatrix,
    //       uBaseColor: entity.material.baseColor || [0, 0, 0, 1],
    //     },
    //     count: cachedGeometry.count,
    //   });
    // }
  }
}

export default function createRenderer(opts) {
  return new Renderer(opts);
}
