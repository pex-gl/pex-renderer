import type { AreaLightComponentOptions } from "../types.js";

/** Area light component */
export default (options?: AreaLightComponentOptions) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  disk: false,
  doubleSided: false,
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
