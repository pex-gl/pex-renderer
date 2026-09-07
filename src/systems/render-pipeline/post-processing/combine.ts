import {
  combineShader,
  TONE_MAP_DEFINE,
} from "../../../shaders/post-processing/combine.js";

import type { PostProcessingEffect } from "../post-processing.js";

/**
 * Composites the HDR chain and tonemaps it. Always declared: the tone map is
 * not optional, it is what turns an exposed image into a displayable one.
 */
const combine: PostProcessingEffect = {
  name: "combine",
  srgb: true,
  declare({ cameraEntity, textures, samplers, pass }) {
    const camera = cameraEntity.camera!;
    const postProcessing = cameraEntity.postProcessing!;
    const { fog, bloom, lensFlare, vignette, lut, colorCorrection } =
      postProcessing;

    const depth = textures.get("depth");
    const glare = textures.get("bloom.threshold");
    const flare = textures.get("lensFlare.main");

    const addsBloom = !!bloom && !!glare;
    const addsLensFlare = !!lensFlare && !!flare;
    const showsFog = !!fog && !!depth;

    pass({
      name: "main",
      shader: combineShader,
      chain: true,
      defines: new Set([
        // Null leaves the image linear and un-mapped, which is what any
        // external grading expects.
        ...(postProcessing.toneMap
          ? [`${TONE_MAP_DEFINE}${postProcessing.toneMap}`]
          : []),
        ...(showsFog ? ["USE_FOG"] : []),
        ...(addsBloom ? ["USE_BLOOM"] : []),
        ...(addsLensFlare ? ["USE_LENS_FLARE"] : []),
        ...(vignette ? ["USE_VIGNETTE"] : []),
        ...(lut?.texture ? ["USE_LUT"] : []),
        ...(colorCorrection ? ["USE_COLOR_CORRECTION"] : []),
      ]),
      uniforms: {
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
          // Authored in stops, applied as a gain.
          exposure: 2 ** postProcessing.exposure!,
          bloomIntensity: bloom?.intensity ?? 0,
          lensFlareIntensity: lensFlare?.intensity ?? 0,
          vignetteRadius: vignette?.radius ?? 0,
          vignetteIntensity: vignette?.intensity ?? 0,
          lutTextureSize: lut?.texture?.width ?? 1,
          brightness: colorCorrection?.brightness ?? 0,
          contrast: colorCorrection?.contrast ?? 1,
          saturation: colorCorrection?.saturation ?? 1,
          hue: colorCorrection?.hue ?? 0,
        },
        ...(showsFog && {
          uDepthTexture: depth!,
          uDepthTextureSampler: samplers.nearest,
        }),
        ...(addsBloom && {
          uBloomTexture: glare!,
          uBloomTextureSampler: samplers.linear,
        }),
        ...(addsLensFlare && {
          uLensFlareTexture: flare!,
          uLensFlareTextureSampler: samplers.linear,
        }),
        ...(lut?.texture && {
          uLUTTexture: lut.texture,
          uLUTTextureSampler: samplers.linear,
        }),
      },
    });
  },
};

export default combine;
