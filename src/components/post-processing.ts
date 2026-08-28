import type {
  BloomComponentOptions,
  ColorCorrectionComponentOptions,
  DoFComponentOptions,
  FilmGrainComponentOptions,
  FogComponentOptions,
  FXAAComponentOptions,
  LutComponentOptions,
  MSAAComponentOptions,
  PostProcessingComponentOptions,
  SMAAComponentOptions,
  SSAOComponentOptions,
  TAAComponentOptions,
  VignetteComponentOptions,
} from "../types.js";

// The post-processing factory doubles as a namespace of subcomponent factories
// (postProcessing.ssao, .dof, ...), so it is typed as a callable with those
// attached members.
interface PostProcessingFactory {
  (options?: PostProcessingComponentOptions): object;
  ssao: (options?: SSAOComponentOptions) => object;
  dof: (options?: DoFComponentOptions) => object;
  msaa: (options?: MSAAComponentOptions) => object;
  fxaa: (options?: FXAAComponentOptions) => object;
  smaa: (options?: SMAAComponentOptions) => object;
  taa: (options?: TAAComponentOptions) => object;
  fog: (options?: FogComponentOptions) => object;
  bloom: (options?: BloomComponentOptions) => object;
  vignette: (options?: VignetteComponentOptions) => object;
  lut: (options?: LutComponentOptions) => object;
  colorCorrection: (options?: ColorCorrectionComponentOptions) => object;
  filmGrain: (options?: FilmGrainComponentOptions) => object;
}

/** Post Processing component */
const postProcessing = ((options?: PostProcessingComponentOptions) => ({
  // msaa
  // ssao
  // dof
  // aa
  // fog
  // bloom
  // vignette
  // lut
  // colorCorrection
  // filmGrain
  exposure: 1,
  toneMap: "aces",
  opacity: 1,
  ...options,
})) as PostProcessingFactory;

/** Post Processing SSAO subcomponent */
postProcessing.ssao = (options?: SSAOComponentOptions) => ({
  type: "sao", // "gtao",
  mix: 1,
  radius: 0.5, // m
  brightness: 0,
  contrast: 1,
  // SAO
  noiseTexture: true,
  samples: options?.type === "gtao" ? 3 : 11,
  intensity: 2.2,
  bias: 0.001, // cm
  spiralTurns: 7,
  blurRadius: 0.5,
  blurSharpness: 10,
  // GTAO. XeGTAO's own defaults, including the slice count: its "high" preset
  // takes three, which is tuned for exactly the temporal accumulation `taa`
  // provides — cycling the noise index rotates the slice azimuths and the
  // history averages the error between them out. Without `taa` three slices
  // leaves low-frequency blotching a spatial denoiser cannot remove (a 3x3
  // filter takes ~7x off the high-frequency noise but only ~1.4x off that), so
  // raise this to six there instead; nine is the reference's "ultra".
  slices: 3,
  bentNormals: false,
  radiusMultiplier: 1.457,
  falloffRange: 0.615,
  sampleDistributionPower: 2,
  thinOccluderCompensation: 0,
  finalValuePower: 2.2,
  depthMipSamplingOffset: 3.3,
  denoisePasses: 1,
  denoiseBlurBeta: 1.2,
  ...options,
});

/** Post Processing DoF subcomponent */
postProcessing.dof = (options?: DoFComponentOptions) => ({
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

/** Post Processing MSAA subcomponent */
postProcessing.msaa = (options?: MSAAComponentOptions) => ({
  sampleCount: 4,
  ...options,
});

/** Post Processing FXAA subcomponent */
postProcessing.fxaa = (options?: FXAAComponentOptions) => ({
  quality: 3,
  subPixelQuality: 0.75, // (0, 1]
  ...options,
});

/** Post Processing SMAA subcomponent */
postProcessing.smaa = (options?: SMAAComponentOptions) => ({
  quality: 2, // [0, 3]
  edges: "luma", // "depth" | "color"
  ...options,
});

/** Post Processing TAA subcomponent */
postProcessing.taa = (options?: TAAComponentOptions) => ({
  // Ten frames of accumulation. Low enough that a disoccluded pixel is back to
  // single-frame quality within a few frames, high enough that the jitter
  // sequence completes inside the window it averages over.
  blendFactor: 0.1,
  // Salvi's clipping box, at the width where ghosting stops surviving and the
  // history still accumulates. Lower clips so hard nothing converges.
  varianceGamma: 1.25,
  // Off. Resampling and reblending the history every frame does soften the
  // image, and this is what wins that back — but how much is wanted depends on
  // the content, and a sharpener left at a value nobody chose is how ringing
  // gets shipped. 0.5 is a reasonable place to start.
  sharpness: 0,
  // Two percent of the depth being tested, which is loose enough that a surface
  // moving towards the camera is not mistaken for a different one — a metre per
  // second at ten metres shifts depth by well under a percent per frame — and
  // tight enough to catch an occluder giving way to what was behind it.
  disocclusionTolerance: 0.02,
  ...options,
});

/** Post Processing Fog subcomponent */
postProcessing.fog = (options?: FogComponentOptions) => ({
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

/** Post Processing Bloom subcomponent */
postProcessing.bloom = (options?: BloomComponentOptions) => ({
  quality: 1,
  colorFunction: "luma", // "average" | "luminance"
  threshold: 1,
  source: false, // "color" | "emissive"
  radius: 1,
  intensity: 0.1,
  ...options,
});

/** Post Processing Vignette subcomponent */
postProcessing.vignette = (options?: VignetteComponentOptions) => ({
  radius: 0.8,
  intensity: 0.2,
  ...options,
});

/** Post Processing LUT subcomponent */
postProcessing.lut = (options?: LutComponentOptions) => ({
  // texture,
  ...options,
});

/** Post Processing Color Correction subcomponent */
postProcessing.colorCorrection = (
  options?: ColorCorrectionComponentOptions,
) => ({
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  ...options,
});

/** Post Processing Film Grain subcomponent */
postProcessing.filmGrain = (options?: FilmGrainComponentOptions) => ({
  quality: 2,
  size: 1.6,
  intensity: 0.05,
  colorIntensity: 0.6,
  luminanceIntensity: 1,
  speed: 0.5,
  ...options,
});

export default postProcessing;
