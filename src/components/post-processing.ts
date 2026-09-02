import type {
  BloomComponentOptions,
  ColorCorrectionComponentOptions,
  DoFComponentOptions,
  FilmGrainComponentOptions,
  FogComponentOptions,
  FXAAComponentOptions,
  LensFlareComponentOptions,
  LutComponentOptions,
  MSAAComponentOptions,
  PostProcessingComponentOptions,
  SMAAComponentOptions,
  MotionBlurComponentOptions,
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
  motionBlur: (options?: MotionBlurComponentOptions) => object;
  fog: (options?: FogComponentOptions) => object;
  bloom: (options?: BloomComponentOptions) => object;
  vignette: (options?: VignetteComponentOptions) => object;
  lut: (options?: LutComponentOptions) => object;
  colorCorrection: (options?: ColorCorrectionComponentOptions) => object;
  filmGrain: (options?: FilmGrainComponentOptions) => object;
  lensFlare: (options?: LensFlareComponentOptions) => object;
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

  // The diaphragm. Here rather than on one effect because two of them image it
  // and would otherwise disagree about the same lens: depth of field's bokeh is
  // the opening itself, and the lens flare's starburst is its diffraction
  // pattern. Circular under three blades.
  blades: 0,
  bladeRotation: 0,
  bladeCurvature: 0,
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
  // The camera's own optics. False swaps in the three artistic knobs below,
  // which describe the same curve without asking for a lens.
  physical: true,
  focusDistance: 7, // m
  focusOnScreenPoint: false,
  screenPoint: [0.5, 0.5],

  // Physical only: the f-stop and the focal length decide the blur, and this is
  // the override for a shot that wants more than the lens gives.
  focusScale: 1,

  // Artistic only.
  blurriness: 0.03,
  focusRange: 1, // m
  focusFalloff: 1,

  // Radius cap as a fraction of viewport height. `rings` caps what the gather
  // may spend reaching it; below that the count follows the radius.
  maxCoCRadius: 0.05,
  rings: 8,
  samples: 6,
  ringOcclusion: true,
  postFilter: true,
  transitionBlur: true,

  chromaticAberration: 0.05,
  luminanceThreshold: 0.7,
  // Off: an unclamped HDR gather already spreads a highlight's energy over its
  // disc correctly, so this is an artistic punch-up and not a correction.
  luminanceGain: 0,
  luminanceKnee: 0.5,
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
  // Widens the rounded min/max box for content whose real range exceeds one
  // 3x3; it cannot narrow it, so this is a ghosting control rather than the
  // knob that decides whether edges settle.
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
  debug: false,
  ...options,
});

/** Post Processing Motion Blur subcomponent */
postProcessing.motionBlur = (options?: MotionBlurComponentOptions) => ({
  // The reference's own settings, which it uses unchanged across every scene
  // it reports: {N, r, rho, gamma, xi} = {35, 40, 1, 40, 27}.
  intensity: 1,
  samples: 35,
  tileSize: 40,
  centerWeightBias: 40,
  directionBlend: 1.5,
  jitterScale: 27,
  tileBlend: 1,
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
  softKnee: 0.5,
  source: false, // "color" | "emissive"
  radius: 1,
  intensity: 0.1,
  ...options,
});

/** Post Processing Lens Flare subcomponent */
postProcessing.lensFlare = (options?: LensFlareComponentOptions) => ({
  intensity: 1,
  tint: [1, 1, 1],
  // Its own cutoff rather than bloom's: bloom glares off anything above the
  // display's white, a flare only off a source bright enough to reflect between
  // lens elements, so this sits well above it.
  threshold: 3,
  softKnee: 0.5,
  source: false, // "bloom"
  // Visible flare length scales with source brightness, so an unbounded HDR
  // highlight draws spikes off the edge of the frame. Unity's bloom carries the
  // same control for the same reason.
  clamp: 50,
  // Two levels of dual-filter blur. The families magnify what they read, and a
  // quarter-resolution pass has no detail to magnify.
  blur: 2,

  // Ghosts on the far side of the optical axis, the same on the near side, and
  // the polar family. Two of the three are on: the reversed set is the same
  // discs mirrored, and having all three at full strength reads as clutter
  // rather than as more lens.
  ghosts: 4,
  ghostIntensity: 1,
  reversedIntensity: 0.5,
  warpedIntensity: 0,
  ghostStart: 1.25,
  ghostSpacing: 1.5,
  ghostDimmer: 0.8,

  haloIntensity: 0.4,
  haloRadius: 0.4,

  // Fraction of a full sweep, applied radially. Small: past a few percent the
  // families separate into three coloured copies rather than fringing.
  chromaticAberration: 0.02,
  chromaticSamples: 4,

  // Full suppression on the axis, since every family converges there.
  vignette: 1,

  // Off by default. Spikes need a diaphragm to diffract off, and `blades` is 0
  // — a round aperture — unless the scene says otherwise.
  streakIntensity: 0,
  // Whole spike, as a fraction of viewport width: half the frame, so it reaches
  // a quarter of it either side of the source.
  streakLength: 0.5,
  streakThreshold: 0,
  streakRotation: 0, // rad, added to bladeRotation
  // A ceiling on the passes, not the number of them: the length decides how
  // many are needed, and five covers the longest spike worth drawing at 4K.
  streakIterations: 5,
  // 0 takes the axes from the diaphragm and draws its starburst; 1 is the
  // single streak a cylindrical anamorphic element gives, which has no blade
  // count behind it.
  streakDirections: 0,
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
