import { vec3 } from "pex-math";
import { submit, createTexture } from "pex-gpu";

import * as SHADERS from "../shaders/index.js";

import type {
  Entity,
  SkyboxComponentOptions,
  SystemOptions,
} from "../types.js";

// Sky parameters packed, in order, into the shader's `parameters: vec4f`.
const parameters: (keyof SkyboxComponentOptions)[] = [
  "turbidity",
  "rayleigh",
  "mieCoefficient",
  "mieDirectionalG",
];

/**
 * Skybox system
 *
 * Adds:
 *
 * - "_skyTexture" to skybox components with no envMap for skybox-renderer to
 *   render
 * - "_skyTextureChanged" to skybox components for reflection-probe system
 */
export default ({ ctx, resourceCache }: SystemOptions) => ({
  type: "skybox-system",
  cache: {} as Record<number, any>,
  debug: false,
  pipeline: null as any,

  // Bakes the analytic sky into the entity's equirectangular _skyTexture as
  // linear HDR. rgba16float preserves radiance >1 (an 8-bit/sRGB target would
  // clamp it) and stays filterable — unlike rgba32float — so the background pass
  // can sample it with a linear sampler.
  updateSkyboxEntity(entity: Entity) {
    const skybox = entity.skybox!;

    if (!this.cache[entity.id]) {
      skybox._skyTexture = createTexture(ctx, {
        label: "skyTexture",
        width: 512,
        height: 256,
        format: "rgba16float",
      });

      this.cache[entity.id] = {
        sunPosition: [...skybox.sunPosition!],
        parameters: Array.from({ length: parameters.length }),
      };
      skybox.dirty = true;
    }

    if (
      vec3.distance(this.cache[entity.id].sunPosition, skybox.sunPosition!) > 0
    ) {
      vec3.set(this.cache[entity.id].sunPosition, skybox.sunPosition!);
      skybox.dirty = true;
    }

    for (let i = 0; i < parameters.length; i++) {
      const name = parameters[i]!;
      if (this.cache[entity.id].parameters[i] !== skybox[name]) {
        this.cache[entity.id].parameters[i] = skybox[name];
        skybox.dirty = true;
      }
    }

    if (skybox.dirty) {
      skybox.dirty = false;

      // Immutable per object identity: create once, reuse across frames.
      this.pipeline ||= (() => {
        const source = SHADERS.sky(new Set(), {});
        return { vertex: source, fragment: source };
      })();

      submit(ctx, {
        label: "skyboxUpdateSkyTextureCmd",
        pass: {
          colorAttachments: [
            { texture: skybox._skyTexture, clearValue: [0, 0, 0, 0] },
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

      skybox._skyTextureChanged = true;
    }
  },
  update(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;

      if (entity.skybox) {
        entity.skybox._skyTextureChanged = false;

        if (!entity.skybox.envMap && entity.skybox.sunPosition) {
          this.updateSkyboxEntity(entity);
        }
      }
    }
  },
  dispose(entities?: Entity[]) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]!;
        if (this.cache[entity.id]) {
          entity.skybox?._skyTexture?.dispose();
          delete this.cache[entity.id];
        }
      }
    } else {
      this.cache = {};
    }
  },
});
