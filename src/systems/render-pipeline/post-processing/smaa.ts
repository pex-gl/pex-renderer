import { createTexture } from "pex-gpu";
import { loadImage } from "pex-io";
import * as pexShaders from "pex-shaders";

import {
  smaaBlendShader,
  smaaEdgesShader,
  smaaWeightsShader,
} from "../../../shaders/post-processing/smaa.js";
import { NAMESPACE } from "../../../utils.js";

import type { GpuContext, GpuTexture } from "../../../types.js";
import type { PostProcessingEffect } from "../post-processing.js";

// pex-shaders' generated types lag its exports until it is rebuilt.
const { SMAATextures } = pexShaders as any;

// The reference's presets. Low and medium drop diagonal and corner detection
// outright, which is most of what makes them cheap.
const PRESETS = [
  { threshold: 0.15, searchSteps: 4, searchStepsDiag: 8, cornerRounding: 25, diagonals: false, corners: false },
  { threshold: 0.1, searchSteps: 8, searchStepsDiag: 8, cornerRounding: 25, diagonals: false, corners: false },
  { threshold: 0.1, searchSteps: 16, searchStepsDiag: 8, cornerRounding: 25, diagonals: true, corners: true },
  { threshold: 0.05, searchSteps: 32, searchStepsDiag: 16, cornerRounding: 25, diagonals: true, corners: true },
] as const;

const EDGES_DEFINE: Record<string, string> = {
  color: "SMAA_EDGES_COLOR",
  depth: "SMAA_EDGES_DEPTH",
};

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
  Promise.all([loadImage(SMAATextures.area), loadImage(SMAATextures.search)])
    .then(([area, search]) => {
      // No flipY, unlike the WebGL version: the WGSL port keeps the
      // reference's top-left texture origin, which WebGPU shares.
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
    })
    .catch((error: unknown) => {
      console.error(
        NAMESPACE,
        "post-processing",
        "smaa lookup textures failed to load",
        error,
      );
    });

  return entry;
}

/**
 * Subpixel morphological anti-aliasing, 1x.
 *
 * Three passes: detect edges, turn them into blending weights against the
 * precomputed area/search lookups, then blend. Runs on the display-referred
 * image, which is what its perceptual thresholds are tuned for.
 *
 * The intermediate textures hold data, not color, so they opt out of the sRGB
 * format the rest of this stage uses.
 */
const smaa: PostProcessingEffect = {
  name: "smaa",
  srgb: true,
  declare({ ctx, cameraEntity, textures, samplers, pass }) {
    // Skipped until the lookups have loaded rather than drawn with a
    // placeholder: one or two frames without anti-aliasing beats one with wrong
    // weights.
    const { area, search } = getLookups(ctx);
    if (!area || !search) return;

    const component = cameraEntity.postProcessing!.smaa!;
    const usesDepth = component.edges === "depth";

    const depth = textures.get("depth");
    if (usesDepth && !depth) return;

    const preset = PRESETS[component.quality!] ?? PRESETS[2];

    const edges = pass({
      name: "edges",
      shader: smaaEdgesShader,
      defines: new Set(
        EDGES_DEFINE[component.edges!] ? [EDGES_DEFINE[component.edges!]!] : [],
      ),
      constants: { SMAA_THRESHOLD: preset.threshold, SMAA_SRGB_INPUT: true },
      clearValue: [0, 0, 0, 0],
      format: "rg8unorm",
      uniforms: {
        ...(usesDepth && {
          uDepthTexture: depth!,
          uDepthTextureSampler: samplers.nearest,
        }),
      },
    });

    const weights = pass({
      name: "weights",
      shader: smaaWeightsShader,
      constants: {
        SMAA_MAX_SEARCH_STEPS: preset.searchSteps,
        SMAA_MAX_SEARCH_STEPS_DIAG: preset.searchStepsDiag,
        SMAA_CORNER_ROUNDING: preset.cornerRounding,
        SMAA_DISABLE_DIAG_DETECTION: !preset.diagonals,
        SMAA_DISABLE_CORNER_DETECTION: !preset.corners,
      },
      clearValue: [0, 0, 0, 0],
      format: "rgba8unorm",
      source: edges,
      uniforms: {
        uEdgesTexture: edges,
        uEdgesTextureSampler: samplers.linear,
        uAreaTexture: area,
        uAreaTextureSampler: samplers.linear,
        uSearchTexture: search,
        uSearchTextureSampler: samplers.nearest,
      },
    });

    pass({
      name: "blend",
      shader: smaaBlendShader,
      chain: true,
      clearValue: [0, 0, 0, 0],
      uniforms: {
        uBlendTexture: weights,
        uBlendTextureSampler: samplers.linear,
      },
    });
  },
};

export default smaa;
