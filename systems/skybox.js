import { pipeline, skybox, parser as ShaderParser } from "pex-shaders";
import { vec3 } from "pex-math";

function initSkybox(ctx, skybox) {
  skybox._skyTexture = ctx.texture2D({
    name: "skyTexture",
    width: 512,
    height: 256,
    // pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    pixelFormat: skybox.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA, // TODO: these are the same values
    encoding: skybox.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear,
  });
  skybox._updateSkyTexturePass = ctx.pass({
    name: "skyboxUpdateSkyTexturePass",
    color: [skybox._skyTexture],
    clearColor: [0, 0, 0, 0],
  });
}

export default ({ ctx, resourceCache }) => {
  let updateSkyTextureCmd;

  return {
    type: "skybox-system",
    cache: {},
    debug: false,
    update(entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];

        if (
          entity.skybox &&
          !entity.skybox.envMap &&
          entity.skybox.sunPosition
        ) {
          let needsUpdate = false;
          let cachedProps = this.cache[entity.id];
          if (!cachedProps) {
            initSkybox(ctx, entity.skybox);
            cachedProps = this.cache[entity.id] = {};
            this.cache[entity.id].sunPosition = [...entity.skybox.sunPosition];
            needsUpdate = true;
            // this.cache[entity.id] = entity.skybox;
            // entity._skybox = entity.skybox; //TODO: why do we need it
          }

          if (
            vec3.distance(cachedProps.sunPosition, entity.skybox.sunPosition) >
            0
          ) {
            vec3.set(cachedProps.sunPosition, entity.skybox.sunPosition);
            needsUpdate = true;
          }

          if (needsUpdate) {
            const fullscreenQuad = resourceCache.fullscreenQuad();

            //TODO: use render graph for updateSkyTextureCmd
            updateSkyTextureCmd ||= {
              name: "skyboxUpdateSkyTextureCmd",
              pipeline: ctx.pipeline({
                vert: ShaderParser.build(ctx, pipeline.fullscreen.vert),
                frag: ShaderParser.build(ctx, skybox.skyEnvMap.frag),
              }),
              uniforms: {
                uSunPosition: [0, 0, 0],
              },
              attributes: fullscreenQuad.attributes,
              indices: fullscreenQuad.indices,
            };

            ctx.submit(updateSkyTextureCmd, {
              pass: entity.skybox._updateSkyTexturePass,
              uniforms: {
                uSunPosition: entity.skybox.sunPosition || [0, 0, 0],
                uOutputEncoding: entity.skybox.rgbm
                  ? ctx.Encoding.RGBM
                  : ctx.Encoding.Linear,
              },
            });
          }
        }
      }
    },
  };
};
