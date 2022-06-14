import { skybox } from "pex-shaderlib";
import createQuad from "primitive-quad";
import { es300Fragment, es300Vertex } from "../utils.js";
import { mat4 } from "pex-math";
const identityMatrix = mat4.create();

class Skybox {
  constructor(opts) {
    this.type = "Skybox";
    this.enabled = true;
    this.rgbm = false;
    this.backgroundBlur = 0;

    console.log("skybox-system", opts);

    const ctx = (this._ctx = opts.ctx);

    this.texture = null;
    this.diffuseTexture = null;
    this.dirty = true;

    this.set(opts);

    const skyboxPositions = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const skyboxFaces = [
      [0, 1, 2],
      [0, 2, 3],
    ];

    this._drawCommand = {
      name: "Skybox.draw",
      pipeline: ctx.pipeline({
        vert: ctx.capabilities.isWebGL2
          ? es300Vertex(skybox.skybox.vert)
          : /* glsl */ `
${ctx.capabilities.maxColorAttachments > 1 ? "#define USE_DRAW_BUFFERS" : ""}
    ${skybox.skybox.vert}`,
        frag: ctx.capabilities.isWebGL2
          ? es300Fragment(skybox.skybox.frag, 2)
          : /* glsl */ `
${ctx.capabilities.maxColorAttachments > 1 ? "#define USE_DRAW_BUFFERS" : ""}
${skybox.skybox.frag}`,
        depthTest: true,
      }),
      attributes: {
        aPosition: ctx.vertexBuffer(skyboxPositions),
      },
      indices: ctx.indexBuffer(skyboxFaces),
      uniforms: {
        uUseTonemapping: false,
        uExposure: 1,
      },
    };

    const quad = createQuad();

    this._skyTexture = ctx.texture2D({
      width: 512,
      height: 256,
      // pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    });

    this._updateSkyTexture = {
      name: "Skybox.updateSkyTexture",
      pass: ctx.pass({
        name: "Skybox.updateSkyTexture",
        color: [this._skyTexture],
        clearColor: [0, 0, 0, 0],
      }),
      pipeline: ctx.pipeline({
        vert: skybox.skyEnvMap.vert,
        frag: skybox.skyEnvMap.frag,
      }),
      uniforms: {
        uSunPosition: [0, 0, 0],
      },
      attributes: {
        aPosition: ctx.vertexBuffer(quad.positions),
        aTexCoord0: ctx.vertexBuffer(quad.uvs),
      },
      indices: ctx.indexBuffer(quad.cells),
    };
  }

  set(opts) {
    Object.assign(this, opts);

    if (opts.sunPosition) {
      this.dirty = true;
    }
  }

  updateSkyTexture() {
    const ctx = this._ctx;
    this.dirty = false;
    ctx.submit(this._updateSkyTexture, {
      uniforms: {
        uSunPosition: this.sunPosition,
        uRGBM: this.rgbm,
      },
    });
  }

  draw(camera, opts) {
    const { entity, projectionMatrix, viewMatrix, exposure } = camera;
    const { backgroundMode, outputEncoding } = opts;
    const ctx = this._ctx;
    if (!this.texture && this.dirty) {
      this.updateSkyTexture();
    }

    let texture = this.texture || this._skyTexture;
    let backgroundBlur = 0;
    if (backgroundMode) {
      if (this.backgroundTexture) {
        texture = this.backgroundTexture;
      }

      if (this.backgroundBlur > 0) {
        backgroundBlur = this.backgroundBlur;
        //TODO: skybox-system and reflection-probe-system peer dependency
        // if (!this._reflectionProbe) {
        // this._reflectionProbe =
        // this.entity.renderer.getComponents("ReflectionProbe")[0];
        // }
        if (this._reflectionProbe) {
          texture = this._reflectionProbe._reflectionMap;
        }
      }
    }

    //TODO: useTonemapping hardcoded to false
    // const postProcessingCmp = entity
    // ? entity.getComponent("PostProcessing")
    // : null;
    // const useTonemapping = !(postProcessingCmp && postProcessingCmp.enabled);
    const useTonemapping = false;

    // TODO: can we somehow avoid creating an object every frame here?
    ctx.submit(this._drawCommand, {
      uniforms: {
        uProjectionMatrix: projectionMatrix,
        uViewMatrix: viewMatrix,
        // uModelMatrix: this.entity.transform.modelMatrix,
        //TODO: iplement entity matrix
        uModelMatrix: identityMatrix,
        uEnvMap: texture,
        uEnvMapEncoding: texture.encoding,
        uOutputEncoding: outputEncoding,
        uBackgroundBlur: backgroundBlur,
        uUseTonemapping: backgroundMode ? useTonemapping : false,
        uExposure: backgroundMode ? exposure : 1,
      },
    });
  }
}

export default function createSkyboxSystem(opts) {
  const skyboxSystem = {
    cache: {},
    debug: false,
  };

  skyboxSystem.update = (entities) => {
    const skyboxEntities = entities.filter((e) => e.skybox);
    for (let skyboxEntity of skyboxEntities) {
      if (!skyboxSystem.cache[skyboxEntity.id]) {
        const skybox = new Skybox({
          ...skyboxEntity.skybox,
          ctx: opts.ctx,
        });
        skyboxSystem.cache[skyboxEntity.id] = skybox;
        skyboxEntity._skybox = skybox; //TODO: why do we need it

        skybox.updateSkyTexture();
      }
    }
  };

  return skyboxSystem;
}
