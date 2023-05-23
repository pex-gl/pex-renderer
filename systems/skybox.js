import { pipeline, skybox } from "./renderer/pex-shaders/index.js";
import { vec3 } from "pex-math";
import { quad } from "../utils.js";

function initSkybox(ctx, skybox) {
  skybox._skyTexture = ctx.texture2D({
    width: 512,
    height: 256,
    // pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    pixelFormat: skybox.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA, // TODO: these are the same values
    encoding: skybox.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear,
  });
  skybox._updateSkyTexturePass = ctx.pass({
    name: "Skybox.updateSkyTexturePass",
    color: [skybox._skyTexture],
    clearColor: [0, 0, 0, 0],
  });
}

export default function createSkyboxSystem(opts) {
  const { ctx } = opts;

  const skyboxSystem = {
    type: "skybox-system",
    cache: {},
    debug: false,
  };

  const updateSkyTextureCmd = {
    name: "Skybox.updateSkyTextureCmd",
    pipeline: ctx.pipeline({
      vert: pipeline.fullscreen.vert,
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

  skyboxSystem.update = (entities) => {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (entity.skybox) {
        let needsUpdate = false;
        let cachedProps = skyboxSystem.cache[entity.id];
        if (!cachedProps) {
          initSkybox(ctx, entity.skybox);
          cachedProps = skyboxSystem.cache[entity.id] = {};
          skyboxSystem.cache[entity.id].sunPosition = [
            ...entity.skybox.sunPosition,
          ];
          needsUpdate = true;
          // skyboxSystem.cache[entity.id] = entity.skybox;
          // entity._skybox = entity.skybox; //TODO: why do we need it
        }

        if (
          vec3.distance(cachedProps.sunPosition, entity.skybox.sunPosition) > 0
        ) {
          vec3.set(cachedProps.sunPosition, entity.skybox.sunPosition);
          needsUpdate = true;
        }

        if (needsUpdate) {
          //TODO: use render graph for updateSkyTextureCmd
          ctx.submit(updateSkyTextureCmd, {
            pass: entity.skybox._updateSkyTexturePass,
            uniforms: {
              uSunPosition: entity.skybox.sunPosition || [0, 0, 0],
              uRGBM: entity.skybox.rgbm || false,
            },
          });
        }
      }
    }
  };

  return skyboxSystem;
}
