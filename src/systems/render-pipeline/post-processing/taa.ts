import { taaShader } from "../../../shaders/post-processing/taa.js";

import type { Entity } from "../../../types.js";
import type { PostProcessingEffect } from "../post-processing.js";

/**
 * What the last frame left behind for a camera, so this one can tell whether
 * the history texture holds anything worth blending.
 *
 * Kept here rather than on the camera component because it is this effect's
 * bookkeeping and nothing else reads it — and weakly, so a discarded camera
 * entity does not pin an entry.
 */
interface TAAState {
  width: number;
  height: number;
  frameIndex: number;
}
const states = new WeakMap<Entity, TAAState>();

/**
 * Temporal antialiasing.
 *
 * One resolve pass blending the jittered current frame into an accumulated
 * history, reprojected through this frame's depth. Declared first in the
 * post-processing stage so everything after it — bloom, depth of field, the
 * tonemap — works on a stable image.
 *
 * Two histories alternating by frame parity, because a pass may not read and
 * write one handle. Both are persistent: their contents have to survive to the
 * next frame, which is the one thing the pool's per-frame recycling would
 * otherwise take away.
 */
const taa: PostProcessingEffect = {
  name: "taa",
  // Reprojection needs to know where each surface was, and only geometry can
  // say that for anything that moved on its own.
  outputs: ["velocity"],
  declare({
    cameraEntity,
    frameIndex,
    renderView,
    samplers,
    textures,
    pass,
    createTexture,
  }) {
    const camera = cameraEntity.camera!;
    const component = cameraEntity.postProcessing!.taa!;

    // Reprojection is the whole mechanism, and it reads depth.
    const depth = textures.get("depth");
    if (!depth) return;

    // Set by the engine only while this effect is on, so its absence means the
    // frame was rendered unjittered and there is nothing to accumulate.
    if (!camera._previousViewProjectionMatrix || !camera._jitter) return;

    if (cameraEntity.postProcessing!.smaa) {
      textures.report(
        'both "taa" and "smaa" are enabled. Temporal antialiasing supersedes it — resolving temporally and leaving smaa to blur the result.',
      );
    }

    const viewId = cameraEntity.id;
    const width = renderView.viewport[2]!;
    const height = renderView.viewport[3]!;

    const parity = frameIndex % 2;
    const descriptor = {
      width,
      height,
      format: "rgba16float" as GPUTextureFormat,
      persistent: true,
    };
    // Declared both ways round every frame: the read side has no producing pass
    // this frame, and only a persistent declaration gives it a handle at all.
    const histories = [
      createTexture({ label: `taa.history0.${viewId}`, ...descriptor }),
      createTexture({ label: `taa.history1.${viewId}`, ...descriptor }),
    ];

    // Nothing to blend against when the texture was just allocated (first frame
    // for this camera), reallocated (a resize changed its shape), left behind
    // by a frame that is not the one immediately before this, or describing a
    // view this one does not continue from (a cut, via
    // `cameraSystem.resetTemporal`).
    const state = states.get(cameraEntity);
    const historyValid =
      !camera._temporalReset &&
      state &&
      state.width === width &&
      state.height === height &&
      state.frameIndex === frameIndex - 1;
    states.set(cameraEntity, { width, height, frameIndex });

    // Published whenever the scene pass ran with it; without it the resolve
    // falls back to camera reprojection from depth, which is exact for a static
    // scene and drags anything that moved on its own.
    const velocity = textures.get("velocity");

    pass({
      name: "main",
      shader: taaShader,
      ...(velocity && { defines: new Set(["USE_TAA_VELOCITY"]) }),
      // Writing straight into the history is what makes this one pass rather
      // than a resolve plus a copy: it is both the accumulator and the image
      // everything downstream reads.
      target: histories[parity]!,
      chain: true,
      uniforms: {
        uTAA: {
          inverseViewProjectionMatrix: camera._inverseViewProjectionMatrix!,
          previousViewProjectionMatrix: camera._previousViewProjectionMatrix,
          texelSize: [1 / width, 1 / height],
          blendFactor: component.blendFactor ?? 0.1,
          varianceGamma: component.varianceGamma ?? 1.25,
          historyValid: historyValid ? 1 : 0,
        },
        uHistoryTexture: histories[1 - parity]!,
        uHistoryTextureSampler: samplers.linear,
        uDepthTexture: depth,
        uDepthTextureSampler: samplers.nearest,
        ...(velocity && {
          uVelocityTexture: velocity,
          // Point-sampled: interpolating motion vectors across a silhouette
          // averages two surfaces that went different ways.
          uVelocityTextureSampler: samplers.nearest,
        }),
      },
    });
  },
};

export default taa;
