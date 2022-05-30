import createQuad from "primitive-quad";
import SKYBOX_VERT from "./shaders/skybox/skybox.vert.js";
import SKYBOX_FRAG from "./shaders/skybox/skybox.frag.js";
import SKYTEXTURE_VERT from "./shaders/skybox/sky-env-map.vert.js";
import SKYTEXTURE_FRAG from "./shaders/skybox/sky-env-map.frag.js";
import Signal from "signals";
import { es300Fragment, es300Vertex } from "./utils.js";

class Skybox {
  constructor(opts) {
    this.type = "Skybox";
    this.enabled = true;
    this.changed = new Signal();
    this.rgbm = false;
    this.backgroundBlur = 0;

    const ctx = (this._ctx = opts.ctx);

    this.texture = null;
    this.diffuseTexture = null;
    this._dirtySunPosition = true;

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
          ? es300Vertex(SKYBOX_VERT)
          : /* glsl */ `
${ctx.capabilities.maxColorAttachments > 1 ? "#define USE_DRAW_BUFFERS" : ""}
    ${SKYBOX_VERT}`,
        frag: ctx.capabilities.isWebGL2
          ? es300Fragment(SKYBOX_FRAG, 2)
          : /* glsl */ `
${ctx.capabilities.maxColorAttachments > 1 ? "#define USE_DRAW_BUFFERS" : ""}
${SKYBOX_FRAG}`,
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
        vert: SKYTEXTURE_VERT,
        frag: SKYTEXTURE_FRAG,
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

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);

    if (opts.sunPosition) {
      this._dirtySunPosition = true;
    }

    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));
  }

  draw(
    { entity, projectionMatrix, viewMatrix, exposure },
    { backgroundMode, outputEncoding }
  ) {
    const ctx = this._ctx;
    if (!this.texture && this._dirtySunPosition) {
      this._dirtySunPosition = false;
      ctx.submit(this._updateSkyTexture, {
        uniforms: {
          uSunPosition: this.sunPosition,
          uRGBM: this.rgbm,
        },
      });
    }

    let texture = this.texture || this._skyTexture;
    let backgroundBlur = 0;
    if (backgroundMode) {
      if (this.backgroundTexture) {
        texture = this.backgroundTexture;
      }

      if (this.backgroundBlur > 0) {
        backgroundBlur = this.backgroundBlur;
        if (!this._reflectionProbe) {
          this._reflectionProbe =
            this.entity.renderer.getComponents("ReflectionProbe")[0];
        }
        if (this._reflectionProbe) {
          texture = this._reflectionProbe._reflectionMap;
        }
      }
    }

    const postProcessingCmp = entity
      ? entity.getComponent("PostProcessing")
      : null;
    const useTonemapping = !(postProcessingCmp && postProcessingCmp.enabled);
    // TODO: can we somehow avoid creating an object every frame here?
    ctx.submit(this._drawCommand, {
      uniforms: {
        uProjectionMatrix: projectionMatrix,
        uViewMatrix: viewMatrix,
        uModelMatrix: this.entity.transform.modelMatrix,
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

export default function createSkybox(opts) {
  if (!opts.sunPosition && !opts.texture) {
    throw new Error("Skybox requires either a sunPosition or a texture");
  }
  return new Skybox(opts);
}
