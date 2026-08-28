import {
  taaShader,
  taaSharpenShader,
  taaDepthHistoryShader,
} from "../../../shaders/post-processing/taa.js";

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
  // say that for anything that moved on its own — plus, from the same geometry,
  // which surfaces it could not answer for at all.
  outputs: ["velocity", "responsive"],
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

    // One texture read and written in the same frame, which the graph orders
    // for us: the resolve reads what the last frame recorded, and the pass
    // declared after it overwrites that with this frame's. A second output on
    // the resolve would have needed two textures alternating instead.
    const disocclusionTolerance = component.disocclusionTolerance ?? 0;
    const previousDepth =
      disocclusionTolerance > 0
        ? createTexture({
            label: `taa.depthHistory.${viewId}`,
            width,
            height,
            // Half floats reach past any sensible far plane and hold three
            // decimal digits doing it, where the test tolerates whole percents.
            format: "r16float" as GPUTextureFormat,
            persistent: true,
          })
        : undefined;

    const responsive = textures.get("responsive");

    // Resolved alongside the colour image, because it is the same jittered
    // raster: bloom samples it at full resolution and adds the result on top of
    // an image that is already stable, so an unresolved emissive buffer puts
    // the jitter back into the frame it was just taken out of.
    //
    // Its own history pair, since the two accumulate different images — sharing
    // the pass only shares the reprojection, which is what they do agree on.
    const emissive = textures.get("emissive");
    const emissiveHistories = emissive && [
      createTexture({ label: `taa.emissiveHistory0.${viewId}`, ...descriptor }),
      createTexture({ label: `taa.emissiveHistory1.${viewId}`, ...descriptor }),
    ];

    const defines = new Set([
      ...(velocity ? ["USE_TAA_VELOCITY"] : []),
      ...(previousDepth ? ["USE_TAA_DISOCCLUSION"] : []),
      ...(responsive ? ["USE_TAA_RESPONSIVE"] : []),
      ...(emissiveHistories ? ["USE_TAA_EMISSIVE"] : []),
    ]);

    const params = {
      inverseViewProjectionMatrix: camera._inverseViewProjectionMatrix!,
      previousViewProjectionMatrix: camera._previousViewProjectionMatrix,
      texelSize: [1 / width, 1 / height],
      blendFactor: component.blendFactor ?? 0.1,
      varianceGamma: component.varianceGamma ?? 1.25,
      historyValid: historyValid ? 1 : 0,
      disocclusionTolerance,
    };

    pass({
      name: "main",
      shader: taaShader,
      defines,
      // Writing straight into the history is what makes this one pass rather
      // than a resolve plus a copy: it is both the accumulator and the image
      // everything downstream reads.
      target: histories[parity]!,
      chain: true,
      ...(emissiveHistories && {
        targets: [{ name: "emissive", texture: emissiveHistories[parity]! }],
      }),
      uniforms: {
        uTAA: params,
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
        ...(previousDepth && {
          uPreviousDepthTexture: previousDepth,
          uPreviousDepthTextureSampler: samplers.nearest,
        }),
        ...(responsive && {
          uResponsiveTexture: responsive,
          uResponsiveTextureSampler: samplers.nearest,
        }),
        ...(emissiveHistories && {
          uEmissiveTexture: emissive!,
          uEmissiveTextureSampler: samplers.linear,
          uEmissiveHistoryTexture: emissiveHistories[1 - parity]!,
          uEmissiveHistoryTextureSampler: samplers.linear,
        }),
      },
    });

    // Under its own name, not just "taa.emissive": bloom asks for the frame's
    // emissive buffer and has no business knowing whether a temporal filter ran.
    if (emissiveHistories) {
      textures.set("emissive", emissiveHistories[parity]!);
    }

    // After the resolve has read it, which is the whole reason one texture is
    // enough. Records depth against this frame's view, since that is what the
    // next frame will be testing against.
    if (previousDepth) {
      pass({
        name: "depthHistory",
        shader: taaDepthHistoryShader,
        target: previousDepth,
        // Nothing to sample from the colour chain, and binding it would hold a
        // texture alive for a read that never happens.
        source: null,
        uniforms: {
          uTAA: params,
          uDepthTexture: depth,
          uDepthTextureSampler: samplers.nearest,
        },
      });
    }

    // After the resolve and reading what it published, so the history keeps the
    // unsharpened image: sharpening what is then sharpened again next frame
    // compounds without bound. Skipped entirely at zero, which is what makes it
    // free rather than merely cheap.
    const sharpness = component.sharpness ?? 0;
    if (sharpness > 0) {
      pass({
        name: "sharpen",
        shader: taaSharpenShader,
        chain: true,
        uniforms: { uSharpen: { sharpness } },
      });
    }
  },
};

export default taa;
