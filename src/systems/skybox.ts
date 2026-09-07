import { vec3 } from "pex-math";
import { submit, createTexture } from "pex-gpu";

import { skyShader } from "../shaders/sky.js";
import createFullscreenGeometry from "../fullscreen-geometry.js";

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
// Irradiance the analytic sky produces, in its own model units, at the
// reference configuration: sun at zenith, default turbidity.
//
// Measured by integrating skyFrag over the hemisphere, excluding the sun disc,
// which pex carries as a directional light instead. The bake does not exclude
// it — at 8192 samples the disc lands 0.18 hits, worth under 0.1% — so this
// holds to that tolerance rather than exactly.
//
// Dividing by it turns `intensity` into the sky's irradiance in lux at that
// reference. It is a constant rather than a per-frame normalisation, so
// lowering the sun still dims the sky: the same integral gives 10.6 units at
// 45 degrees and 0.61 near the horizon.
const SKY_REFERENCE_IRRADIANCE = 20.3;

export default ({ ctx }: SystemOptions) => ({
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
        const source = skyShader(new Set(), {});
        return { vertex: source, fragment: source };
      })();

      submit(ctx, {
        label: "skyboxUpdateSkyTextureCmd",
        pass: {
          colorAttachments: [
            { texture: skybox._skyTexture!, clearValue: [0, 0, 0, 0] },
          ],
        },
        pipeline: this.pipeline,
        ...createFullscreenGeometry(ctx).triangle,
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

        // What takes this environment to cd/m². The two branches are not the
        // same statement, and what separates them is whether the source's own
        // scale is knowable. An env map has none, so `intensity` is a plain
        // multiplier: a scale applied so the result comes out in lux, where
        // the lux is the author's responsibility rather than a property of the
        // number. The analytic sky is generated here, so its scale is known and
        // the same field divides by it to actually mean lux.
        const intensity = entity.skybox.intensity ?? 1;
        entity.skybox._luminanceScale = entity.skybox.envMap
          ? intensity
          : intensity / SKY_REFERENCE_IRRADIANCE;

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
