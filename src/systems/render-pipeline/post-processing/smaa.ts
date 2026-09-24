import { createTexture } from "pex-gpu";
import { loadImage } from "pex-io";
import { smaa as SMAA } from "pex-shaders";

import {
  smaaBlendShader,
  smaaEdgesShader,
  smaaResolveShader,
  smaaWeightsShader,
} from "../../../shaders/post-processing/smaa.js";
import { NAMESPACE } from "../../../utils.js";
import { createHistoryPair, createHistoryTracker } from "./history.js";

import type { Entity, GpuContext, GpuTexture } from "../../../types.js";
import type { PostProcessingEffect } from "../post-processing.js";

// `quality` indexes the reference's presets. Low and medium drop diagonal and
// corner detection outright, which is most of what makes them cheap.
const QUALITIES = ["low", "medium", "high", "ultra"] as const;

const EDGES_DEFINE: Record<string, string> = {
  color: "SMAA_EDGES_COLOR",
  depth: "SMAA_EDGES_DEPTH",
};

/**
 * Area texture rows matching each of the camera's T2x jitter samples, in the
 * same order (see `SMAA_T2X_JITTER_SAMPLES`).
 */
const T2X_SUBSAMPLE_INDICES = [
  [1, 1, 1, 0],
  [2, 2, 2, 0],
];
const NO_SUBSAMPLE_INDICES = [0, 0, 0, 0];

/** The precomputed area and search lookups: fixed data, one pair per context. */
interface SMAALookups {
  area?: GpuTexture;
  search?: GpuTexture;
}
const lookups = new WeakMap<GpuContext, SMAALookups>();

function getLookups(ctx: GpuContext): SMAALookups {
  let entry = lookups.get(ctx);
  if (entry) return entry;

  entry = {};
  lookups.set(ctx, entry);

  const loaded = entry;
  void (async () => {
    try {
      const [area, search] = await Promise.all([
        loadImage(SMAA.SMAATextures.area),
        loadImage(SMAA.SMAATextures.search),
      ]);
      // Uploaded as is: the lookups are stored in the reference's top-left
      // orientation, which WebGPU shares.
      loaded.area = createTexture(ctx, {
        label: "smaaAreaTexture",
        data: area,
        format: "rgba8unorm",
      });
      loaded.search = createTexture(ctx, {
        label: "smaaSearchTexture",
        data: search,
        format: "rgba8unorm",
      });
    } catch (error) {
      console.error(
        NAMESPACE,
        "post-processing",
        "smaa lookup textures failed to load",
        error,
      );
    }
  })();

  return entry;
}

const isHistoryValid = createHistoryTracker();

/** Reprojection reads the motion vectors the main pass writes. */
const usesReprojection = (cameraEntity: Entity) => {
  const component = cameraEntity.postProcessing!.smaa!;
  return component.mode === "t2x" && !!component.reprojection;
};

/**
 * Subpixel morphological anti-aliasing, 1x or T2x.
 *
 * Three passes: detect edges, turn them into blending weights against the
 * precomputed area/search lookups, then blend. Runs on the display-referred
 * image, which is what its perceptual thresholds are tuned for.
 *
 * T2x renders each frame at one of two jittered sub-pixel positions (see the
 * camera system), picks the area texture rows matching it, and resolves the
 * blended frame with the previous one — reprojected through the velocity buffer
 * temporal antialiasing and motion blur also read.
 *
 * The intermediate textures hold data, not color, so they opt out of the sRGB
 * format the rest of this stage uses. The histories do not: the blend and the
 * resolve mix colors, which the sRGB format does in linear space.
 */
const smaa: PostProcessingEffect = {
  name: "smaa",
  srgb: true,
  outputs: (cameraEntity) =>
    usesReprojection(cameraEntity) ? ["velocity"] : [],
  declare({
    ctx,
    cameraEntity,
    frameIndex,
    renderView,
    textures,
    samplers,
    pass,
    createTexture: createFrameTexture,
  }) {
    // Skipped until the lookups have loaded rather than drawn with a
    // placeholder: one or two frames without anti-aliasing beats one with wrong
    // weights.
    const { area, search } = getLookups(ctx);
    if (!area || !search) return;

    const camera = cameraEntity.camera!;
    const component = cameraEntity.postProcessing!.smaa!;
    const usesDepth = component.edges === "depth";
    const predication = !usesDepth && !!component.predication;

    const depth = textures.get("depth");
    if ((usesDepth || predication) && !depth) return;

    // The image SMAA starts from, before any of its passes chains its own.
    const color = textures.get("color");

    const preset = SMAA.PRESETS[QUALITIES[component.quality!] ?? "high"];

    // The camera jitters for T2x only while temporal antialiasing is off, which
    // is what running as 1x under it amounts to.
    const jitter = camera._jitter;
    const temporal =
      component.mode === "t2x" &&
      !cameraEntity.postProcessing!.taa &&
      !!jitter &&
      jitter[0] !== 0;
    const velocity = textures.get("velocity");
    const reprojection =
      temporal && usesReprojection(cameraEntity) && !!velocity;

    const edges = pass({
      name: "edges",
      shader: smaaEdgesShader,
      defines: new Set([
        ...(EDGES_DEFINE[component.edges!]
          ? [EDGES_DEFINE[component.edges!]!]
          : []),
        ...(predication ? ["USE_SMAA_PREDICATION"] : []),
      ]),
      constants: {
        ...preset.edges,
        SMAA_SRGB_INPUT: true,
        ...(predication && {
          SMAA_PREDICATION_THRESHOLD: component.predicationThreshold!,
          SMAA_PREDICATION_SCALE: component.predicationScale!,
          SMAA_PREDICATION_STRENGTH: component.predicationStrength!,
        }),
      },
      clearValue: [0, 0, 0, 0],
      format: "rg8unorm",
      // Depth edges sample no color.
      ...(usesDepth && { source: null }),
      uniforms: {
        // Point-sampled, as the reference reads the edge detection input.
        ...(!usesDepth && { uTextureSampler: samplers.nearest }),
        ...((usesDepth || predication) && {
          uDepthTexture: depth!,
          uDepthTextureSampler: samplers.nearest,
        }),
      },
    });

    const weights = pass({
      name: "weights",
      shader: smaaWeightsShader,
      constants: preset.weights,
      clearValue: [0, 0, 0, 0],
      format: "rgba8unorm",
      source: null,
      uniforms: {
        uSMAA: {
          // Which of the two samples this frame was rendered at.
          subsampleIndices: temporal
            ? T2X_SUBSAMPLE_INDICES[jitter[0]! > 0 ? 0 : 1]!
            : NO_SUBSAMPLE_INDICES,
        },
        uEdgesTexture: edges,
        uEdgesTextureSampler: samplers.linear,
        uAreaTexture: area,
        uAreaTextureSampler: samplers.linear,
        uSearchTexture: search,
        uSearchTextureSampler: samplers.linear,
      },
    });

    const blendDefines = new Set(reprojection ? ["USE_SMAA_REPROJECTION"] : []);
    const blendUniforms = {
      uBlendTexture: weights,
      uBlendTextureSampler: samplers.linear,
      // Linearly filtered, unlike other motion vector reads: the reference
      // antialiases velocity along with color, for the resolve.
      ...(reprojection && {
        uVelocityTexture: velocity!,
        uVelocityTextureSampler: samplers.linear,
      }),
    };

    if (!temporal) {
      pass({
        name: "blend",
        shader: smaaBlendShader,
        defines: blendDefines,
        chain: true,
        clearValue: [0, 0, 0, 0],
        uniforms: blendUniforms,
      });
      return;
    }

    const width = renderView.viewport[2]!;
    const height = renderView.viewport[3]!;
    const parity = frameIndex % 2;
    const histories = createHistoryPair(
      createFrameTexture,
      "smaa.history",
      cameraEntity.id,
      { width, height, format: "rgba8unorm-srgb" },
    );
    const historyValid = isHistoryValid(
      cameraEntity,
      frameIndex,
      width,
      height,
    );

    // This frame's blend, kept for the next frame to resolve against.
    const current = pass({
      name: "blend",
      shader: smaaBlendShader,
      defines: blendDefines,
      target: histories[parity]!,
      uniforms: blendUniforms,
    });

    // Without a usable history, resolving the frame with itself leaves it as
    // is.
    pass({
      name: "resolve",
      shader: smaaResolveShader,
      defines: blendDefines,
      constants: {
        SMAA_REPROJECTION_WEIGHT_SCALE: component.reprojectionWeightScale!,
      },
      source: current,
      chain: true,
      uniforms: {
        uTextureSampler: samplers.nearest,
        uHistoryTexture: historyValid ? histories[1 - parity]! : current,
        ...(reprojection && {
          uVelocityTexture: velocity!,
          uVelocityTextureSampler: samplers.nearest,
          uColorTexture: color!,
        }),
      },
    });
  },
};

export default smaa;
