/**
 * Post Processing component
 * @param {import("../types.js").PostProcessingComponentOptions} [options]
 * @returns {object}
 * @alias module:components.postProcessing
 */
const postProcessing = (options) => ({
  // ssao
  // dof
  // aa
  // fog
  // bloom
  // lut
  // colorCorrection
  // vignette
  // filmGrain
  opacity: 1,
  ...options,
});

postProcessing.ssao = (options) => ({
  type: "sao", // "gtao",
  noiseTexture: true,
  mix: 1,
  samples: options?.type === "gtao" ? 6 : 11,
  intensity: 2.2,
  radius: 0.5, // m
  blurRadius: 0.5,
  blurSharpness: 10,
  brightness: 0,
  contrast: 1,
  // SAO
  bias: 0.001, // cm
  spiralTurns: 7,
  // GTAO
  slices: 3,
  colorBounce: true,
  colorBounceIntensity: 1.0,
  ...options,
});
postProcessing.dof = (options) => ({
  type: "gustafsson", // "upitis"
  physical: true,
  focusDistance: 7,
  focusScale: 1,
  focusOnScreenPoint: false,
  screenPoint: [0.5, 0.5],
  chromaticAberration: 0.7,
  luminanceThreshold: 0.7,
  luminanceGain: 1,
  samples: 6,
  shape: "disk", // "pentagon"
  debug: false,
  ...options,
});
postProcessing.aa = (options) => ({
  type: "fxaa2",
  spanMax: 8,
  ...options,
});
postProcessing.fog = (options) => ({
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
postProcessing.bloom = (options) => ({
  quality: 1,
  colorFunction: "luma", // "average" | "luminance"
  threshold: 1,
  source: false, // "color" | "emissive"
  radius: 1,
  intensity: 0.1,
  ...options,
});
postProcessing.lut = (options) => ({
  // texture,
  ...options,
});
postProcessing.colorCorrection = (options) => ({
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  ...options,
});
postProcessing.vignette = (options) => ({
  radius: 0.8,
  intensity: 0.2,
  ...options,
});
postProcessing.filmGrain = (options) => ({
  quality: 2,
  size: 1.6,
  intensity: 0.05,
  colorIntensity: 0.6,
  luminanceIntensity: 1,
  speed: 0.5,
  ...options,
});

export default postProcessing;
