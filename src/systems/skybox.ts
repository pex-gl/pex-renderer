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
 *
 * `update` is CPU only. `declareSkybox` records the environment map and its
 * bake into the frame's graph, once per frame rather than per camera.
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

export default ({ ctx, frameGraph }: SystemOptions) => ({
  type: "skybox-system",
  cache: {} as Record<number, any>,
  debug: false,
  pipeline: null as any,

  updateSkyboxEntity(entity: Entity) {
    const skybox = entity.skybox!;
    let cached = this.cache[entity.id];

    if (!cached) {
      // Linear HDR: rgba16float preserves radiance >1 (an 8-bit/sRGB target
      // would clamp it) and stays filterable — unlike rgba32float — so the
      // background pass can sample it with a linear sampler.
      skybox._skyTexture = createTexture(ctx, {
        label: "skyTexture",
        width: 512,
        height: 256,
        format: "rgba16float",
      });

      cached = this.cache[entity.id] = {
        sunPosition: [...skybox.sunPosition!],
        parameters: Array.from({ length: parameters.length }),
        needsBake: true,
      };
    }

    if (vec3.distance(cached.sunPosition, skybox.sunPosition!) > 0) {
      vec3.set(cached.sunPosition, skybox.sunPosition!);
      skybox.dirty = true;
    }

    for (let i = 0; i < parameters.length; i++) {
      const name = parameters[i]!;
      if (cached.parameters[i] !== skybox[name]) {
        cached.parameters[i] = skybox[name];
        skybox.dirty = true;
      }
    }

    // `dirty` is the user's input; `needsBake` is the pending work only the
    // bake clears.
    if (skybox.dirty) {
      skybox.dirty = false;
      cached.needsBake = true;
    }

    // Pending rather than done: the reflection probe system runs next and
    // settles its own rebake before either is declared.
    skybox._skyTextureChanged = cached.needsBake;
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
  /**
   * Records the analytic sky bake into this frame's graph, for every skybox
   * whose sky has moved since it was last drawn.
   */
  declareSkybox(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      const skybox = entity.skybox;
      const cached = this.cache[entity.id];
      if (!skybox?._skyTexture || !cached?.needsBake) continue;

      // Immutable per object identity: create once, reuse across frames.
      this.pipeline ||= (() => {
        const source = skyShader(new Set(), {});
        return { vertex: source, fragment: source };
      })();

      // Imported, not graph-owned: the sky is rewritten only when it moves, so
      // on most frames no pass writes it and a handle would resolve to nothing.
      // The renderers bind it straight off the component.
      const skyTexture = frameGraph.importTexture(
        skybox._skyTexture,
        `skyTexture.${entity.id}`,
      );

      frameGraph.addPass({
        name: `skyTexture.${entity.id}`,
        color: [{ texture: skyTexture, clearValue: [0, 0, 0, 0] }],
        uniforms: {
          uSky: {
            sunPosition: cached.sunPosition,
            parameters: cached.parameters,
          },
        },
        execute: ({ uniforms }) => {
          submit(ctx, {
            label: "skyboxUpdateSkyTextureCmd",
            pipeline: this.pipeline,
            ...createFullscreenGeometry(ctx).triangle,
            uniforms,
          });

          // Cleared here, not at declaration: a pass that never runs leaves
          // the bake pending rather than losing it.
          cached.needsBake = false;
        },
      });
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
