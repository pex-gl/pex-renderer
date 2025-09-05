import { vec3 } from "pex-math";
import { skybox, parser as ShaderParser } from "pex-shaders";

const parameters = [
  "turbidity",
  "rayleigh",
  "mieCoefficient",
  "mieDirectionalG",
];

/**
 * Skybox system
 *
 * Adds:
 * - "_skyTexture" to skybox components with no envMap for skybox-renderer to render
 * - "_skyTextureChanged" to skybox components for reflection-probe system
 * @param {import("../types.js").SystemOptions} options
 * @returns {import("../types.js").System}
 * @alias module:systems.skybox
 */
export default ({ ctx, resourceCache }) => ({
  type: "skybox-system",
  cache: {},
  debug: false,
  cmd: null,
  updateSkyboxEntity(entity) {
    // Initialise
    if (!this.cache[entity.id]) {
      entity.skybox._skyTexture = ctx.texture2D({
        name: "skyTexture",
        width: 512,
        height: 256,
        pixelFormat: ctx.PixelFormat.RGBA8,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
      });

      this.cache[entity.id] = {
        sunPosition: [...entity.skybox.sunPosition],
        parameters: new Array(parameters.length),
        _updateSkyTexturePass: ctx.pass({
          name: "skyboxUpdateSkyTexturePass",
          color: [entity.skybox._skyTexture],
          clearColor: [0, 0, 0, 0],
        }),
      };
      entity.skybox.dirty = true;
    }

    // Compare
    if (
      vec3.distance(
        this.cache[entity.id].sunPosition,
        entity.skybox.sunPosition,
      ) > 0
    ) {
      vec3.set(this.cache[entity.id].sunPosition, entity.skybox.sunPosition);
      entity.skybox.dirty = true;
    }

    for (let i = 0; i < parameters.length; i++) {
      const name = parameters[i];
      if (this.cache[entity.id].parameters[i] !== entity.skybox[name]) {
        this.cache[entity.id].parameters[i] = entity.skybox[name];
        entity.skybox.dirty = true;
      }
    }

    // Update and render
    if (entity.skybox.dirty) {
      entity.skybox.dirty = false;

      //TODO: use render graph
      this.cmd ||= {
        name: "skyboxUpdateSkyTextureCmd",
        //TODO: MARCIN: let's just move to WebGL2 already.
        //TODO: MARCIN: skybox.skyEnvMap looks like texture prop of skybox component not a shaderlib
        pipeline: ctx.pipeline({
          vert: ShaderParser.build(ctx, skybox.skyEnvMap.vert),
          frag: ShaderParser.build(ctx, skybox.skyEnvMap.frag),
        }),
        uniforms: {
          uOutputEncoding: 1, // Linear,
        },
        ...resourceCache.fullscreenTriangle(),
      };

      ctx.submit(this.cmd, {
        pass: this.cache[entity.id]._updateSkyTexturePass,
        uniforms: {
          uSunPosition: this.cache[entity.id].sunPosition,
          uParameters: this.cache[entity.id].parameters,
        },
      });

      entity.skybox._skyTextureChanged = true;
    }
  },
  update(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (entity.skybox) {
        entity.skybox._skyTextureChanged = false;

        if (!entity.skybox.envMap && entity.skybox.sunPosition) {
          this.updateSkyboxEntity(entity);
        }
      }
    }
  },
});
