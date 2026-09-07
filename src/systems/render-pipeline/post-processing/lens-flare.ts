import {
  downsampleShader,
  upsampleShader,
} from "../../../shaders/post-processing/bloom.js";
import {
  lensFlareBrightShader,
  lensFlareMainShader,
  lensFlareStreakSeedShader,
  lensFlareStreakShader,
} from "../../../shaders/post-processing/lens-flare.js";

import type { ResourceHandle } from "../../../frame-graph/index.js";
import type { PostProcessingEffect } from "../post-processing.js";

/**
 * Bright pass resolution, as a divisor of the viewport.
 *
 * Every family reads it through a scale about the optical centre, so a ghost is
 * a magnified crop of it and never a sharpened one — the detail a full
 * resolution pass would carry is thrown away by the first ghost that enlarges.
 * A quarter is also where HDRP's default `bloomMip` of 1 lands on a half
 * resolution pyramid.
 */
const BRIGHT_DIVISOR = 4;

/**
 * Streak resolution. Coarser than the bright pass because a spike is a
 * low-frequency smear along one axis: what it needs is reach, and reach is
 * measured in texels, so halving the grid doubles it for free.
 */
const STREAK_DIVISOR = 8;

/**
 * Directions the streak atlas is allowed to hold.
 *
 * A cap on the atlas' height and on the composite's tap count, both of which
 * scale with it. Eight covers every diaphragm that produces distinguishable
 * spikes: past about sixteen blades the aperture is round and diffracts as a
 * disc, which is a halo rather than a starburst.
 */
const MAX_STREAK_DIRECTIONS = 8;

/** Half-support of one streak iteration, in strides: six taps, spaced one apart. */
const STREAK_TAP_SPAN = 2.5;

/**
 * Largest the stride may grow between streak iterations.
 *
 * Each iteration lays copies of the previous filter's support one stride apart,
 * so the growth is what decides whether those copies abut or leave gaps.
 * Exactly at the tap span they abut but the tent's own shape still ripples
 * through — measured at ~46% peak-to-trough — and past it they separate into
 * beads. Three is the largest ratio that stays under 5% ripple for every value
 * in between, which is what a continuous `streakLength` needs.
 */
const STREAK_MAX_GROWTH = 3;

/** Iterations a streak chain may be given, whatever `streakIterations` says. */
const MAX_STREAK_ITERATIONS = 8;

/** Halving stops once a blur level would be smaller than this on either axis. */
const MIN_BLUR_SIZE = 8;

/** Bloom's quality 0, which is the plain box filter without the reweighting. */
const PLAIN_BOX = new Set(["QUALITY_0"]);

/**
 * How far a chain of `iterations` reaches at a given growth, in atlas texels.
 *
 * The base stride is one texel — the finest lattice the atlas has, and the
 * coarsest that bilinear still covers continuously — so reach is the geometric
 * sum of every iteration's half-support and nothing else.
 */
const streakReach = (growth: number, iterations: number) =>
  STREAK_TAP_SPAN *
  (growth === 1 ? iterations : (growth ** iterations - 1) / (growth - 1));

/** The growth that reaches `reach` in `iterations`, or the cap if it cannot. */
const streakGrowth = (reach: number, iterations: number) => {
  if (reach <= streakReach(1, iterations)) return 1;
  if (reach >= streakReach(STREAK_MAX_GROWTH, iterations)) {
    return STREAK_MAX_GROWTH;
  }

  // Monotonic in growth but not invertible in closed form past two iterations.
  let low = 1;
  let high = STREAK_MAX_GROWTH;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (streakReach(mid, iterations) < reach) low = mid;
    else high = mid;
  }

  return (low + high) / 2;
};

/**
 * Which bloom level stands in for the bright pass when the flare is sourced
 * from bloom's pyramid.
 *
 * `blur` is a count of dual-filter levels when the flare owns its bright pass.
 * Bloom's pyramid has already been through the same filter pair, so the same
 * number picks the level whose blur matches instead of running it again — which
 * is what HDRP's `bloomMip` selects. The threshold texture is half resolution
 * and level 0 of the pyramid is a quarter, so the count starts at the pyramid.
 */
const bloomSourceName = (blur: number) =>
  blur < 1 ? "bloom.threshold" : `bloom.downsample[${Math.floor(blur) - 1}]`;

/**
 * Spike axes a diaphragm produces.
 *
 * A straight blade edge diffracts into a spike perpendicular to it. Opposite
 * edges of an even-sided polygon are parallel, so their spikes coincide and the
 * count collapses to the blade count; an odd polygon has no parallel pair and
 * gives twice as many. A chain is bidirectional either way, so the number of
 * chains is half the spikes.
 */
const bladeDirections = (blades: number) =>
  blades % 2 === 0 ? blades / 2 : blades;

/**
 * Lens flare.
 *
 * After depth of field, so an out-of-focus source flares as its bokeh rather
 * than as the sharp point it would have been; after bloom, because the two
 * share only the fact that they start from bright pixels and a flare is not
 * something bloom should then spread. Before `combine`, which adds the result
 * to the scene-referred image the way it adds bloom: light that reached the
 * sensor belongs above the tone map's input, not on top of its output.
 *
 * The same position HDRP gives it, and for the same reason — its
 * `LensFlareScreenSpacePass` runs after `BloomPass` and feeds `UberPass`.
 *
 * Sources
 *
 * - John Chapman, "Pseudo Lens Flare" (2013).
 *   https://john-chapman.github.io/2017/11/05/pseudo-lens-flare.html
 *   The ghost and halo formulation: resample one bright pass through the
 *   optical centre instead of drawing sprites at a projected light position.
 * - Unity, "Screen Space Lens Flare" (HDRP/URP 14+).
 *   https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.core/Runtime/PostProcessing/Shaders/LensFlareScreenSpaceCommon.hlsl
 *   Chapman plus the polar family, the spectral sweep and the streak chain, and
 *   the arrangement this follows. Pass order is in HDRenderPipeline.PostProcess.cs.
 * - Froyok (Lena Piquet), "Custom Lens-Flare in UE4" (2021).
 *   https://www.froyok.fr/blog/2021-09-ue4-custom-lens-flare/
 *   Where the blur between the threshold and the ghost pass comes from, and the
 *   reason it is a dual filter rather than one wide kernel.
 * - Masaki Kawase, "Frame Buffer Postprocessing Effects in DOUBLE-S.T.E.A.L",
 *   GDC 2003. http://www.daionet.gr.jp/~masa/archives/GDC2003_DSTEAL.ppt
 *   The streak filter: a few taps per pass with a stride that grows
 *   geometrically, so reach costs log passes.
 * - Jorge Jimenez, "Next Generation Post Processing in Call of Duty: Advanced
 *   Warfare", SIGGRAPH 2014.
 *   http://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare
 *   The downsample/upsample pair the blur reuses from bloom.
 *
 * Physically-based tier, read but deliberately not implemented: both trace rays
 * through an actual lens prescription and need a light list as well as the
 * optics, so neither is a post-process.
 *
 * - Hullin et al., "Physically-Based Real-Time Lens Flare Rendering",
 *   SIGGRAPH 2011. doi:10.1145/2010324.1964936
 * - Lee and Eisemann, "Practical Real-Time Lens-Flare Rendering", EGSR 2013.
 *   doi:10.1111/cgf.12145
 */
const lensFlare: PostProcessingEffect = {
  name: "lensFlare",
  declare({ cameraEntity, viewport, textures, samplers, pass, createTexture }) {
    const camera = cameraEntity.camera!;
    const postProcessing = cameraEntity.postProcessing!;
    const component = postProcessing.lensFlare!;
    const viewId = cameraEntity.id;

    const ghostIntensity = component.ghostIntensity ?? 0;
    const reversedIntensity = component.reversedIntensity ?? 0;
    const warpedIntensity = component.warpedIntensity ?? 0;
    const haloIntensity = component.haloIntensity ?? 0;
    const streakIntensity = component.streakIntensity ?? 0;

    const ghosts = component.ghosts ?? 4;
    const useGhosts = ghosts > 0 && ghostIntensity > 0;
    const useReversed = ghosts > 0 && reversedIntensity > 0;
    const useWarped = ghosts > 0 && warpedIntensity > 0;
    const useHalo = haloIntensity > 0;

    const width = viewport[2]!;
    const height = viewport[3]!;

    // Spike axes come from the diaphragm unless a count is named: an anamorphic
    // streak is a cylindrical element's, not the aperture's, so it has no blade
    // count to derive from and asks for one directly.
    const blades = postProcessing.blades ?? 0;
    const requested = component.streakDirections ?? 0;
    const fromBlades = requested < 1 && blades >= 3;
    const directions = Math.min(
      MAX_STREAK_DIRECTIONS,
      Math.max(1, requested || (fromBlades ? bladeDirections(blades) : 1)),
    );

    // A rounded blade has no straight edge to diffract off, so the spikes it
    // produces fade as the diaphragm approaches a circle.
    const curvature = fromBlades ? (postProcessing.bladeCurvature ?? 0) : 0;
    const useStreaks = streakIntensity > 0 && curvature < 1;

    if (!useGhosts && !useReversed && !useWarped && !useHalo && !useStreaks) {
      return;
    }

    const blur = Math.max(0, Math.round(component.blur ?? 2));
    const chromaticAberration = component.chromaticAberration ?? 0;

    const brightWidth = Math.max(1, Math.ceil(width / BRIGHT_DIVISOR));
    const brightHeight = Math.max(1, Math.ceil(height / BRIGHT_DIVISOR));
    const streakWidth = Math.max(1, Math.ceil(width / STREAK_DIVISOR));
    const streakHeight = Math.max(1, Math.ceil(height / STREAK_DIVISOR));

    // Half a spike, in atlas texels: `streakLength` is the whole thing and it
    // grows both ways from the source. A fraction of viewport width rather than
    // of the atlas, so one setting streaks the same distance on screen at every
    // resolution.
    const reach = ((component.streakLength ?? 0.5) * streakWidth) / 2;

    // Reach decides the pass count, not the other way round: the growth is
    // capped at what stays smooth, so a chain too short to reach cannot be
    // stretched into one and has to be given another iteration instead.
    // `streakIterations` is the budget that bounds it.
    const maxIterations = Math.min(
      MAX_STREAK_ITERATIONS,
      Math.max(1, component.streakIterations ?? 5),
    );
    let iterations = 1;
    while (
      iterations < maxIterations &&
      streakReach(STREAK_MAX_GROWTH, iterations) < reach
    ) {
      iterations++;
    }
    const growth = streakGrowth(reach, iterations);

    // The optical axis, projected. A point in front of the camera on the axis
    // rather than the middle of the viewport: a sheared or off-centre frustum
    // moves the principal point, and every family is mirrored through it, so a
    // flare drawn about the viewport centre would drift against its own source.
    // One expression covers both projections — the perspective divide is the
    // identity when w stays 1.
    const projectionMatrix = camera.projectionMatrix!;
    const axisW = -projectionMatrix[11]! + projectionMatrix[15]! || 1;
    const axisX = (-projectionMatrix[8]! + projectionMatrix[12]!) / axisW;
    const axisY = (-projectionMatrix[9]! + projectionMatrix[13]!) / axisW;

    // Bloom's pyramid holds the same bright pixels blurred to the same scales,
    // so a scene already paying for it can read that instead. Its levels are
    // separate textures rather than a mip chain, which is what costs the
    // fractional bias.
    const fromBloom =
      component.source === "bloom"
        ? textures.get(bloomSourceName(blur))
        : undefined;

    const uLensFlare = {
      // Normalized device coordinates to UV. Y flips: the texture origin is
      // top-left and clip space points up.
      center: [axisX * 0.5 + 0.5, 0.5 - axisY * 0.5],
      aspect: [width / height, 1],

      tint: component.tint ?? [1, 1, 1],
      clamp: component.clamp ?? 50,

      ghostIntensity,
      ghostReversedIntensity: reversedIntensity,
      ghostWarpedIntensity: warpedIntensity,
      ghostStart: component.ghostStart ?? 1.25,

      ghostSpacing: component.ghostSpacing ?? 1.5,
      ghostDimmer: component.ghostDimmer ?? 0.8,
      chromaticAberration,
      haloIntensity,

      haloRadius: component.haloRadius ?? 0.4,
      vignette: component.vignette ?? 1,
      threshold: component.threshold ?? 1,

      softKnee: component.softKnee ?? 0.5,
      streakIntensity: streakIntensity * (1 - curvature),
      streakThreshold: component.streakThreshold ?? 0,
      // Spikes are perpendicular to the blade edges, so they are spaced by the
      // polygon's own sector. An explicit count spreads its axes evenly over
      // the half turn a bidirectional chain does not already cover.
      streakAngleStep: fromBlades
        ? (2 * Math.PI) / blades
        : Math.PI / directions,

      streakRotation:
        (component.streakRotation ?? 0) +
        (fromBlades ? (postProcessing.bladeRotation ?? 0) : 0),
      streakInset: 0.5 / streakHeight,
      // Replaced per iteration.
      streakStride: 1,
    };

    const constants = {
      LENS_FLARE_CHROMATIC_SAMPLES: component.chromaticSamples ?? 4,
      USE_LENS_FLARE_CHROMATIC_ABERRATION: chromaticAberration > 0,
    };

    // What the spikes grow out of: sharp, because a spike is the diffraction of
    // a peak and blurring the peak first spreads it into a band.
    let bright: ResourceHandle;
    // What the ghosts and the halo resample. Blurred, because they magnify it.
    let smooth: ResourceHandle;

    if (fromBloom) {
      // Already through this filter pair on its way up bloom's pyramid.
      bright = fromBloom;
      smooth = fromBloom;
    } else {
      bright = pass({
        name: "bright",
        shader: lensFlareBrightShader,
        size: [brightWidth, brightHeight],
        uniforms: { uLensFlare },
      });
      smooth = bright;

      // Halvings the bright pass has before a level stops having neighbours to
      // gather from.
      const levels = Math.min(
        blur,
        Math.max(
          0,
          Math.floor(
            Math.log2(Math.min(brightWidth, brightHeight) / MIN_BLUR_SIZE),
          ),
        ),
      );
      const levelSize = (level: number) => [
        Math.max(1, Math.ceil(brightWidth / 2 ** level)),
        Math.max(1, Math.ceil(brightHeight / 2 ** level)),
      ];

      // Down then straight back up, keeping nothing on the way: a dual filter,
      // not a pyramid sum. Bloom accumulates every level because a glare is the
      // sum of every scale; a ghost is one image of the aperture, so what it
      // wants is the same image band-limited, at the same brightness.
      for (let level = 0; level < levels; level++) {
        smooth = pass({
          name: `blurDown[${level}]`,
          shader: downsampleShader,
          // The plain box, not bloom's anti-flicker weighting: that one is a
          // non-linear average that pulls bright samples down, and here the
          // bright samples are the subject. The ceiling in the bright pass is
          // what keeps them bounded instead.
          defines: PLAIN_BOX,
          source: smooth,
          size: levelSize(level + 1),
          uniforms: { uDownsample: { intensity: 1 } },
        });
      }

      for (let level = levels - 1; level >= 0; level--) {
        smooth = pass({
          name: `blurUp[${level}]`,
          shader: upsampleShader,
          source: smooth,
          size: levelSize(level),
        });
      }
    }

    let streaks: ResourceHandle | undefined;
    if (useStreaks) {
      const streakConstants = {
        ...constants,
        LENS_FLARE_STREAK_DIRECTIONS: directions,
      };
      const atlasSize = [streakWidth, streakHeight * directions];

      // Two, ping-ponged: a pass may not read and write one handle, and the
      // chain is every iteration reading what the last one left.
      const atlas = [
        createTexture({
          label: `lensFlare.streakAtlas0_${viewId}`,
          width: atlasSize[0]!,
          height: atlasSize[1]!,
          format: "rgba16float",
        }),
        createTexture({
          label: `lensFlare.streakAtlas1_${viewId}`,
          width: atlasSize[0]!,
          height: atlasSize[1]!,
          format: "rgba16float",
        }),
      ];

      pass({
        name: "streakSeed",
        shader: lensFlareStreakSeedShader,
        constants: streakConstants,
        source: bright,
        target: atlas[0]!,
        uniforms: { uLensFlare },
      });

      streaks = atlas[0]!;
      for (let iteration = 0; iteration < iterations; iteration++) {
        const target = atlas[(iteration + 1) % 2]!;

        pass({
          name: `streak[${iteration}]`,
          shader: lensFlareStreakShader,
          constants: streakConstants,
          source: streaks,
          target,
          uniforms: {
            uLensFlare: {
              ...uLensFlare,
              streakStride: growth ** iteration,
            },
          },
        });

        streaks = target;
      }
    }

    pass({
      name: "main",
      shader: lensFlareMainShader,
      defines: new Set([
        ...(useGhosts ? ["USE_LENS_FLARE_GHOSTS"] : []),
        ...(useReversed ? ["USE_LENS_FLARE_REVERSED"] : []),
        ...(useWarped ? ["USE_LENS_FLARE_WARPED"] : []),
        ...(useHalo ? ["USE_LENS_FLARE_HALO"] : []),
        ...(streaks ? ["USE_LENS_FLARE_STREAKS"] : []),
      ]),
      constants: {
        ...constants,
        // Only what this variant declares: pex-gpu narrows a stage's constants
        // to the overrides its entry point references, so an undeclared one is
        // dropped rather than fatal — but a variant that never compiles the
        // ghost loop has no business naming its bound.
        ...((useGhosts || useReversed || useWarped) && {
          LENS_FLARE_GHOSTS: ghosts,
        }),
        ...(streaks && { LENS_FLARE_STREAK_DIRECTIONS: directions }),
      },
      source: smooth,
      size: [brightWidth, brightHeight],
      uniforms: {
        uLensFlare,
        ...(streaks && {
          uStreakTexture: streaks,
          uStreakTextureSampler: samplers.linear,
        }),
      },
    });
  },
};

export default lensFlare;
