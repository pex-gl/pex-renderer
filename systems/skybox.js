import { skybox } from "pex-shaders";
import createQuad from "primitive-quad";
import { patchVS, patchFS } from "../utils.js";
import { mat4, vec3 } from "pex-math";
const identityMatrix = mat4.create();

class Skybox {
  constructor(opts) {
    this.type = "Skybox";
    this.enabled = true;
    this.rgbm = false;
    this.backgroundBlur = 1;

    console.log("skybox-system", opts);

    const ctx = (this._ctx = opts.ctx);

    this.texture = null;
    this.diffuseTexture = null;
    this.dirty = true;

    this.set(opts);

    const quad = createQuad();

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
        uSunPosition: this.sunPosition || [0, 0, 0],
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
      return;
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
      viewport: camera.viewport,
      scissor: camera.viewport,
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
        uExposure: backgroundMode ? exposure || 1 : 1, //TODO: hardcoded default from camera.exposure
      },
    });
  }
}

export default function createSkyboxSystem(opts) {
  const { ctx } = opts;

  const skyboxSystem = {
    cache: {},
    debug: false,
  };

  const quad = createQuad();

  const updateSkyTextureCmd = {
    name: "Skybox.updateSkyTexture",
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

  function initSkybox(ctx, entity, skybox) {
    skybox._skyTexture = ctx.texture2D({
      width: 512,
      height: 256,
      // pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      pixelFormat: skybox.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA,
      encoding: skybox.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    });
    skybox._updateSkyTexturePass = ctx.pass({
      name: "Skybox.updateSkyTexture",
      color: [skybox._skyTexture],
      clearColor: [0, 0, 0, 0],
    });
  }

  skyboxSystem.update = (entities) => {
    const skyboxEntities = entities.filter((e) => e.skybox);
    for (let skyboxEntity of skyboxEntities) {
      const { skybox } = skyboxEntity;
      let needsUpdate = false;
      let cachedProps = skyboxSystem.cache[skyboxEntity.id];
      if (!cachedProps) {
        initSkybox(ctx, skyboxEntity, skyboxEntity.skybox);
        cachedProps = skyboxSystem.cache[skyboxEntity.id] = {};
        skyboxSystem.cache[skyboxEntity.id].sunPosition = [
          ...skybox.sunPosition,
        ];
        needsUpdate = true;
        // const skybox = new Skybox({
        //   ...skyboxEntity.skybox,
        //   ctx: opts.ctx,
        // });
        // skyboxSystem.cache[skyboxEntity.id] = skybox;
        // skyboxEntity._skybox = skybox; //TODO: why do we need it

        // skybox.updateSkyTexture();
      }

      if (vec3.distance(cachedProps.sunPosition, skybox.sunPosition) > 0) {
        vec3.set(cachedProps.sunPosition, skybox.sunPosition);
        needsUpdate = true;
      }

      if (needsUpdate) {
        //TODO: use render graph for updateSkyTextureCmd
        ctx.submit(updateSkyTextureCmd, {
          pass: skybox._updateSkyTexturePass,
          uniforms: {
            uSunPosition: skybox.sunPosition || [0, 0, 0],
            uRGBM: skybox.rgbm || false,
          },
        });
      }
    }
  };

  return skyboxSystem;
}
