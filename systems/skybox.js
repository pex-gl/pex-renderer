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
    const skyboxEntities = entities.filter((e) => e.skybox);
    for (let skyboxEntity of skyboxEntities) {
      const { skybox } = skyboxEntity;
      let needsUpdate = false;
      let cachedProps = skyboxSystem.cache[skyboxEntity.id];
      if (!cachedProps) {
        initSkybox(ctx, skyboxEntity.skybox);
        cachedProps = skyboxSystem.cache[skyboxEntity.id] = {};
        skyboxSystem.cache[skyboxEntity.id].sunPosition = [
          ...skybox.sunPosition,
        ];
        needsUpdate = true;
        // skyboxSystem.cache[skyboxEntity.id] = skybox;
        // skyboxEntity._skybox = skybox; //TODO: why do we need it
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
