import type { DirectionalLightComponentOptions } from "../types.js";

/** Directional light component */
export default (options?: DirectionalLightComponentOptions) => ({
  color: [1, 1, 1, 1],
  // Illuminance (lx). A clear midday sun, which the camera's default exposure
  // is metered for.
  intensity: 100_000,
  // Shadow-map rasterizer depth bias (see renderer/standard.ts getDepthPipeline).
  // The slope-scaled term is the effective one on a float depth map; raise it to
  // remove acne, clamp to avoid contact detachment (peter-panning).
  depthBias: 1,
  depthBiasSlopeScale: 2,
  depthBiasClamp: 0,
  bulbRadius: 1,
  castShadows: true,
  shadowMapSize: 2048,
  ...options,
});
