/**
 * Post Processing component
 * @param {import("../types.js").PostProcessingComponentOptions} [options]
 * @returns {object}
 * @module PostProcessingComponent
 * @exports module:PostProcessingComponent
 */
export default (options) => ({
  // ao
  // dof
  // aa
  // fog
  // bloom
  // lut
  // colorCorrection
  // vignette
  opacity: 1,
  ...options,
});

export const ao = (options) => ({
  type: "sao",
  samples: 11,
  intensity: 1,
  radius: 12,
  bias: 0.001,
  blurRadius: 0.5,
  blurSharpness: 10,
  brightness: 0,
  contrast: 1,
  ...options,
});
export const dof = (options) => ({
  type: "gustafsson", // "upitis"
  debug: false,
  focusDistance: 7,
  focusOnScreenPoint: false,
  screenPoint: [0.5, 0.5],
  chromaticAberration: 0.7,
  luminanceThreshold: 0.7,
  luminanceGain: 1,
  samples: 4,
  shape: "disc", // "pentagon"
  ...options,
});
export const aa = (options) => ({
  type: "fxaa2",
  spanMax: 8,
  ...options,
});
export const fog = (options) => ({
  color: [0.5, 0.5, 0.5],
  start: 5,
  density: 0.15,

  sunPosition: [1, 1, 1],
  sunDispertion: 0.2,
  sunIntensity: 0.1,
  sunColor: [0.98, 0.98, 0.7],
  inscatteringCoeffs: [0.3, 0.3, 0.3],
  ...options,
});
export const bloom = (options) => ({
  threshold: 1,
  radius: 1,
  intensity: 0.1,
  ...options,
});
export const lut = (options) => ({
  // texture,
  ...options,
});
export const colorCorrection = (options) => ({
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  ...options,
});
export const vignette = (options) => ({
  radius: 0.8,
  intensity: 0.2,
  ...options,
});
