import { vec3 } from "pex-math";
import { submit, createTexture } from "pex-gpu";

import * as SHADERS from "../shaders/index.js";

// Sky parameters packed, in order, into the shader's `parameters: vec4f`.
const parameters = ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"];

/**
 * Skybox system
 *
 * Adds:
 *
 * - "_skyTexture" to skybox components with no envMap for skybox-renderer to
 *   render
 * - "_skyTextureChanged" to skybox components for reflection-probe system
 *
 * @param options
 * @returns
 * @alias module:systems.skybox
 */
export default ({ ctx, resourceCache }) => ({
  type: "skybox-system",
  cache: {},
  debug: false,
  pipeline: null,

  // Bakes the analytic sky into the entity's equirectangular _skyTexture. The
  // rgba8unorm-srgb target encodes on write and decodes on sample, so the
  // shader's linear output round-trips back to linear for the background pass.
  updateSkyboxEntity(entity) {
    if (!this.cache[entity.id]) {
      entity.skybox._skyTexture = createTexture(ctx, {
        label: "skyTexture",
        width: 512,
        height: 256,
        format: "rgba8unorm-srgb",
      });

      this.cache[entity.id] = {
        sunPosition: [...entity.skybox.sunPosition],
        parameters: Array.from({ length: parameters.length }),
      };
      entity.skybox.dirty = true;
    }

    if (
      vec3.distance(this.cache[entity.id].sunPosition, entity.skybox.sunPosition) > 0
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

    if (entity.skybox.dirty) {
      entity.skybox.dirty = false;

      // Immutable per object identity: create once, reuse across frames.
      this.pipeline ||= (() => {
        const source = SHADERS.sky(new Set(), {});
        return { vertex: source, fragment: source };
      })();

      submit(ctx, {
        name: "skyboxUpdateSkyTextureCmd",
        pass: {
          colorAttachments: [
            { texture: entity.skybox._skyTexture, clearValue: [0, 0, 0, 0] },
          ],
        },
        pipeline: this.pipeline,
        ...resourceCache.fullscreenTriangle(),
        uniforms: {
          uSky: {
            sunPosition: this.cache[entity.id].sunPosition,
            parameters: this.cache[entity.id].parameters,
          },
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
  dispose(entities) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (this.cache[entity.id]) {
          entity.skybox._skyTexture?.dispose();
          delete this.cache[entity.id];
        }
      }
    } else {
      this.cache = {};
    }
  },
});
