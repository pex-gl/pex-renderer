import { chunks } from "pex-shaders";

// pex-shaders' generated types lag behind its chunks until it is rebuilt
// (same reason as the casts in shaders/standard.ts and shaders/sky.ts).
const SHADERS = chunks as any;

import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

/**
 * The passes the `lensFlare` chunk describes: a bright pass, a streak seed, one
 * pass per streak iteration, and the composite that sums the three families.
 * The blur between the bright pass and the composite reuses bloom's pyramid
 * filters and so has no shader here.
 *
 * Plumbing only — coordinates, loop bounds, attachments. What the numbers mean
 * lives in the chunk.
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

const params = (alloc: ReturnType<typeof createBindingAllocator>) =>
  `@group(0) @binding(${alloc.next()}) var<uniform> uLensFlare: LensFlareParams;`;

/**
 * Bright pass: what the flare families resample.
 *
 * Its own threshold rather than bloom's, because the two want different
 * cutoffs — bloom glares off anything above the display's white, a flare only
 * off a source bright enough to reflect between lens elements — and because an
 * effect that reads another effect's buffer stops working when that one is
 * switched off. `source: "bloom"` is the opt-out for a scene that would rather
 * spend nothing here.
 *
 * Exposure-aware like bloom's: the threshold is a number about the image, so it
 * has to be applied where the image is, not to the scene radiance behind it.
 * The ceiling goes on here for the same reason, and before the threshold so the
 * knee sees the value the families will actually spread.
 *
 * The reduction to a quarter has to be filtered rather than sampled — Froyok's
 * threshold pass spends thirteen taps on it and says why: filtering is what
 * stabilises the aliasing. Everything downstream magnifies this pass, so an
 * unread pixel here is a visible one there.
 */
export const lensFlareBrightShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.TWO_PI}
${SHADERS.lensFlare.common}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${SHADERS.luma}
${SHADERS.threshold}

${fullscreenVertex({ corners: true })}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Four bilinear taps, one source texel either side of a centre that lands on
  // the block boundary, which works out to a uniform average of all sixteen
  // full-resolution texels behind this one.
  //
  // The single centre tap this replaces reached four of those sixteen — the
  // middle 2x2 — so a highlight crossing the ring that was never read dropped
  // out of the flare and came back. Only visible because temporal antialiasing
  // shifts the raster sub-pixel every frame, which moves a highlight across
  // that ring at frame rate rather than at the speed of the camera.
  //
  // No firefly reweighting on top: the ceiling below bounds a single hot pixel
  // to a sixteenth of itself here, which is what the weighting would be for.
  var color = (
    textureSample(uTexture, uTextureSampler, input.texCoord0LeftUp) +
    textureSample(uTexture, uTextureSampler, input.texCoord0RightUp) +
    textureSample(uTexture, uTextureSampler, input.texCoord0LeftDown) +
    textureSample(uTexture, uTextureSampler, input.texCoord0RightDown)
  ) * 0.25;

  color = vec4f(
    min(color.rgb, vec3f(uLensFlare.clamp)),
    color.a
  );

  return threshold(color, luma(color.rgb), uLensFlare.threshold, uLensFlare.softKnee);
}
`);
};

/**
 * Streak seed: the bright pass, thresholded again, copied into every band.
 *
 * Its own pass rather than folded into the first blur iteration because the
 * second threshold has to run per texel: thresholding a blurred image keeps
 * whatever the blur pulled above the cutoff, which is the opposite of
 * localising the spikes onto the few sources bright enough to diffract.
 */
export const lensFlareStreakSeedShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.TWO_PI}
${SHADERS.lensFlare.common}
${SHADERS.lensFlare.streak}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let band = lensFlareStreakBand(input.texCoord0.y);
  let local = lensFlareStreakLocal(input.texCoord0, band);

  // Clamped again rather than trusting the bright pass, which a bloom source
  // replaces with a texture that never saw the ceiling. A spike's visible length
  // is where its falloff still clears display white, so it grows with the
  // source's brightness without one.
  let color = min(
    textureSampleLevel(uTexture, uTextureSampler, saturate(local), 0.0).rgb,
    vec3f(uLensFlare.clamp)
  );

  // Scored on the largest channel rather than on luma: a spike is a diffraction
  // artifact of the source's peak, and a saturated red light diffracts as
  // readily as a white one of the same peak.
  let brightness = max(color.r, max(color.g, color.b));
  let keep = max(brightness - uLensFlare.streakThreshold, 0.0) / max(brightness, 1e-4);

  return vec4f(color * keep, 1.0);
}
`);
};

/** One iteration of every streak chain, each in its own band of the atlas. */
export const lensFlareStreakShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.TWO_PI}
${SHADERS.lensFlare.common}
${SHADERS.lensFlare.streak}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let band = lensFlareStreakBand(input.texCoord0.y);
  let local = lensFlareStreakLocal(input.texCoord0, band);

  // Band-local texels: one band spans the whole image, so its vertical texel is
  // the atlas' scaled by the band count. Both axes are then the same distance
  // on screen, which is what lets a direction be a plain unit vector.
  let texel = vec2f(
    uPostProcessing.texelSize.x,
    uPostProcessing.texelSize.y * f32(LENS_FLARE_STREAK_DIRECTIONS)
  );
  let stride = lensFlareStreakDirection(band, uLensFlare) * uLensFlare.streakStride * texel;

  return vec4f(
    lensFlareStreakBlur(uTexture, uTextureSampler, local, band, stride, uLensFlare.streakInset),
    1.0
  );
}
`);
};

/**
 * The composite: the three families summed, at the bright pass' resolution.
 *
 * Left scene-referred and handed to `combine` as one more additive term
 * alongside bloom, rather than chained into the colour: a flare is light that
 * reached the sensor, so it belongs above the tone map's input and not on top
 * of its output.
 */
export const lensFlareMainShader = (
  defines: Set<string> = new Set(),
): string => {
  const useGhosts = defines.has("USE_LENS_FLARE_GHOSTS");
  const useReversed = defines.has("USE_LENS_FLARE_REVERSED");
  const useWarped = defines.has("USE_LENS_FLARE_WARPED");
  const useHalo = defines.has("USE_LENS_FLARE_HALO");
  const useStreaks = defines.has("USE_LENS_FLARE_STREAKS");

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.TWO_PI}
${SHADERS.lensFlare.common}
${useGhosts || useReversed || useWarped ? SHADERS.lensFlare.ghosts : ""}
${useHalo ? SHADERS.lensFlare.halo : ""}
${useStreaks ? SHADERS.lensFlare.streak : ""}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${useStreaks ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uStreakTexture") : ""}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.texCoord0;

  var color = vec3f(0.0);

  ${
    useGhosts || useReversed || useWarped
      ? `// Ghosts and the halo converge on the optical axis; the streaks belong on
  // top of the source, so they are added after this.
  var ghosts = vec3f(0.0);
  ${useGhosts ? `ghosts += lensFlareGhosts(uTexture, uTextureSampler, uv, uLensFlare, -1.0, false) * uLensFlare.ghostIntensity;` : ""}
  ${useReversed ? `ghosts += lensFlareGhosts(uTexture, uTextureSampler, uv, uLensFlare, 1.0, false) * uLensFlare.ghostReversedIntensity;` : ""}
  ${
    useWarped
      ? `ghosts += lensFlareGhosts(uTexture, uTextureSampler, uv, uLensFlare, -1.0, true)
    * uLensFlare.ghostWarpedIntensity
    * lensFlareWarpSeam(uv, uLensFlare);`
      : ""
  }
  color += ghosts;`
      : ""
  }
  ${useHalo ? `color += lensFlareHalo(uTexture, uTextureSampler, uv, uLensFlare) * uLensFlare.haloIntensity;` : ""}

  color *= lensFlareVignette(uv, uLensFlare);

  ${
    useStreaks
      ? `// Every band is the same image blurred along a different spike axis, so the
  // spikes cross where they overlap instead of one filter smearing another's.
  let sweep = lensFlareDispersion(uv, uLensFlare);
  var streaks = vec3f(0.0);
  for (var band = 0; band < LENS_FLARE_STREAK_DIRECTIONS; band++) {
    streaks += lensFlareStreakSample(
      uStreakTexture,
      uStreakTextureSampler,
      uv,
      f32(band),
      sweep,
      uLensFlare.streakInset
    );
  }
  color += streaks * uLensFlare.streakIntensity;`
      : ""
  }

  return vec4f(color * uLensFlare.tint, 1.0);
}
`);
};
