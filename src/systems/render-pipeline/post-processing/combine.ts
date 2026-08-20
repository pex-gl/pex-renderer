import {
  combineShader,
  TONE_MAP_DEFINE,
} from "../../../shaders/post-processing/combine.js";

import type { PostProcessingEffect } from "../post-processing.js";

/**
 * Composites the HDR chain and tonemaps it. Always declared: exposure and the
 * tonemap are not optional, they are what turns scene radiance into an image.
 *
 * Ambient occlusion is applied here rather than in its own pass whenever depth
 * of field is off, saving a fullscreen pass in the common case.
 */
const combine: PostProcessingEffect = {
  name: "combine",
  srgb: true,
  passes: ({ cameraEntity }) => {
    const camera = cameraEntity.camera!;
    const postProcessing = cameraEntity.postProcessing!;
    const { fog, ssao, bloom, vignette, lut, colorCorrection } = postProcessing;

    // Depth of field already consumed the occlusion when it ran. Both of these
    // check the target exists: an effect the component asks for still doesn't
    // run if its module failed to load or its inputs were missing.
    const mixesSSAO = (targets: Map<string, unknown>) =>
      !!ssao && !postProcessing.dof && targets.has("ssao.main");
    const addsBloom = (targets: Map<string, unknown>) =>
      !!bloom && targets.has("bloom.threshold");

    return [
      {
        name: "main",
        shader: combineShader,
        chain: true,
        getDefines: ({ depth, targets }) =>
          new Set([
            // Null leaves the image scene-referred, which is what the exposure
            // pickers and any external grading expect.
            ...(postProcessing.toneMap
              ? [`${TONE_MAP_DEFINE}${postProcessing.toneMap}`]
              : []),
            ...(fog && depth ? ["USE_FOG"] : []),
            ...(mixesSSAO(targets) ? ["USE_SSAO"] : []),
            ...(addsBloom(targets) ? ["USE_BLOOM"] : []),
            ...(vignette ? ["USE_VIGNETTE"] : []),
            ...(lut?.texture ? ["USE_LUT"] : []),
            ...(colorCorrection ? ["USE_COLOR_CORRECTION"] : []),
          ]),
        constants: () => ({
          USE_SSAO_COLORS: ssao?.type === "gtao" && !!ssao.colorBounce,
        }),
        uniforms: ({ depth, targets, samplers }) => ({
          uCombine: {
            viewMatrix: camera.viewMatrix!,
            fogColor: fog?.color ?? [0, 0, 0],
            fogStart: fog?.start ?? 0,
            sunPosition: fog?.sunPosition ?? [0, 1, 0],
            fogDensity: fog?.density ?? 0,
            sunColor: fog?.sunColor ?? [0, 0, 0],
            sunDispertion: fog?.sunDispertion ?? 0,
            inscatteringCoeffs: fog?.inscatteringCoeffs ?? [0, 0, 0],
            sunIntensity: fog?.sunIntensity ?? 0,
            near: camera.near!,
            far: camera.far!,
            fov: camera.fov!,
            exposure: postProcessing.exposure!,
            ssaoMix: ssao?.mix ?? 0,
            bloomIntensity: bloom?.intensity ?? 0,
            vignetteRadius: vignette?.radius ?? 0,
            vignetteIntensity: vignette?.intensity ?? 0,
            lutTextureSize: lut?.texture?.width ?? 1,
            brightness: colorCorrection?.brightness ?? 0,
            contrast: colorCorrection?.contrast ?? 1,
            saturation: colorCorrection?.saturation ?? 1,
            hue: colorCorrection?.hue ?? 0,
          },
          ...(fog &&
            depth && {
              uDepthTexture: depth,
              uDepthTextureSampler: samplers.nearest,
            }),
          ...(mixesSSAO(targets) && {
            uSSAOTexture: targets.get("ssao.main")!,
            uSSAOTextureSampler: samplers.linear,
          }),
          ...(addsBloom(targets) && {
            uBloomTexture: targets.get("bloom.threshold")!,
            uBloomTextureSampler: samplers.linear,
          }),
          ...(lut?.texture && {
            uLUTTexture: lut.texture,
            uLUTTextureSampler: samplers.linear,
          }),
        }),
      },
    ];
  },
};

export default combine;
