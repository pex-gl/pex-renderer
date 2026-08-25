import {
  combineShader,
  TONE_MAP_DEFINE,
} from "../../../shaders/post-processing/combine.js";

import { isAOPreLighting } from "../post-processing.js";
import type { PostProcessingEffect } from "../post-processing.js";
import type { RenderTextures } from "../render-textures.js";

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
    // Nothing to apply when the standard shader already folded occlusion into
    // the indirect term before shading.
    const mixesSSAO = (textures: RenderTextures) =>
      !!ssao &&
      !postProcessing.dof &&
      !isAOPreLighting(cameraEntity) &&
      !!textures.get("ssao.main");
    const addsBloom = (textures: RenderTextures) =>
      !!bloom && !!textures.get("bloom.threshold");

    return [
      {
        name: "main",
        shader: combineShader,
        chain: true,
        getDefines: ({ textures }) =>
          new Set([
            // Null leaves the image scene-referred, which is what the exposure
            // pickers and any external grading expect.
            ...(postProcessing.toneMap
              ? [`${TONE_MAP_DEFINE}${postProcessing.toneMap}`]
              : []),
            ...(fog && textures.get("depth") ? ["USE_FOG"] : []),
            ...(mixesSSAO(textures) ? ["USE_SSAO"] : []),
            ...(addsBloom(textures) ? ["USE_BLOOM"] : []),
            ...(vignette ? ["USE_VIGNETTE"] : []),
            ...(lut?.texture ? ["USE_LUT"] : []),
            ...(colorCorrection ? ["USE_COLOR_CORRECTION"] : []),
          ]),
        constants: () => ({
          USE_SSAO_COLORS: !isAOPreLighting(cameraEntity),
          USE_SSAO_MULTI_BOUNCE: !!ssao?.multiBounce,
        }),
        uniforms: ({ textures, samplers }) => ({
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
            textures.get("depth") && {
              uDepthTexture: textures.get("depth")!,
              uDepthTextureSampler: samplers.nearest,
            }),
          ...(mixesSSAO(textures) && {
            uSSAOTexture: textures.get("ssao.main")!,
            uSSAOTextureSampler: samplers.linear,
          }),
          ...(addsBloom(textures) && {
            uBloomTexture: textures.get("bloom.threshold")!,
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
