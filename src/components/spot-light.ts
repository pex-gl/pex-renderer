import type { SpotLightComponentOptions } from "../types.js";

/** Spot light component */
export default (options?: SpotLightComponentOptions) => ({
  color: [1, 1, 1, 1],
  // Luminous power (lm), about a 75 W incandescent bulb.
  intensity: 1000,
  angle: Math.PI / 4,
  innerAngle: 0,
  // Concentrate the power into the cone rather than spreading it over a
  // hemisphere, so narrowing the beam brightens it the way a real fixture does.
  focusedSpot: false,
  // Infinite, matching KHR_lights_punctual: the cutoff is an optimisation, not
  // a look, and inverse-square already ends the light's reach.
  range: Infinity,
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
