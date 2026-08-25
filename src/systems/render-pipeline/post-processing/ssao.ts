import { createTexture } from "pex-gpu";
import random from "pex-random";

import {
  bilateralBlurShader,
  gtaoShader,
  saoShader,
  ssaoMixShader,
} from "../../../shaders/post-processing/ssao.js";
import { BlueNoiseGenerator } from "../../../utils/blue-noise.js";

import type { GpuContext, GpuTexture } from "../../../types.js";
import { isAOPreLighting } from "../post-processing.js";
import type { PostProcessingEffect } from "../post-processing.js";

// Noise textures are identical for every camera and never change, so they are
// memoized per context rather than cached per entity. Like the fullscreen
// geometry, they live for the context's lifetime.
const blueNoiseTextures = new WeakMap<GpuContext, GpuTexture>();
const noiseTextures = new WeakMap<GpuContext, GpuTexture>();
const dummyTextures = new WeakMap<GpuContext, GpuTexture>();

const BLUE_NOISE_SIZE = 32;
const NOISE_SIZE = 64;

/** Four channels of blue noise, one generated pattern each: GTAO reads .xy. */
function getBlueNoiseTexture(ctx: GpuContext): GpuTexture {
  return blueNoiseTextures.getOrInsertComputed(ctx, () => {
    const generator = new BlueNoiseGenerator();
    generator.size = BLUE_NOISE_SIZE;

    const data = new Uint8Array(BLUE_NOISE_SIZE ** 2 * 4);
    for (let channel = 0; channel < 4; channel++) {
      const { data: bin, maxValue } = generator.generate();
      for (let i = 0; i < bin.length; i++) {
        data[i * 4 + channel] = 255 * (bin[i]! / maxValue);
      }
    }

    return createTexture(ctx, {
      label: "ssaoBlueNoiseTexture",
      width: BLUE_NOISE_SIZE,
      height: BLUE_NOISE_SIZE,
      format: "rgba8unorm",
      data,
    });
  });
}

/**
 * White noise for SAO's rotation jitter. Values are [0, 1] rather than the
 * GLSL version's [-1, 1]: the analytic fallback the same shader uses is a
 * fract(), and 8 bit unorm is filterable where rg32float is not.
 */
function getNoiseTexture(ctx: GpuContext): GpuTexture {
  return noiseTextures.getOrInsertComputed(ctx, () => {
    const localPRNG = random.create("0");

    const data = new Uint8Array(NOISE_SIZE ** 2 * 4);
    for (let i = 0; i < NOISE_SIZE ** 2; i++) {
      data[i * 4] = 255 * localPRNG.float();
      data[i * 4 + 1] = 255 * localPRNG.float();
      data[i * 4 + 3] = 255;
    }

    return createTexture(ctx, {
      label: "ssaoNoiseTexture",
      width: NOISE_SIZE,
      height: NOISE_SIZE,
      format: "rgba8unorm",
      data,
    });
  });
}

/** The estimators sample a noise texture unconditionally, so the binding is
 * always declared; with the analytic hash selected it reads this instead. */
function getDummyTexture(ctx: GpuContext): GpuTexture {
  return dummyTextures.getOrInsertComputed(ctx, () =>
    createTexture(ctx, {
      label: "ssaoDummyNoiseTexture",
      width: 1,
      height: 1,
      format: "rgba8unorm",
      data: new Uint8Array([0, 0, 0, 255]),
    }),
  );
}

/**
 * Screen-space ambient occlusion.
 *
 * The estimator writes a visibility buffer at `ssao.main`, which the separable
 * bilateral blur cleans up in place. Applying it to the color is left to
 * combine unless depth of field runs first, since DoF must blur an image that
 * already has its occlusion.
 */
const ssao: PostProcessingEffect = {
  name: "ssao",
  outputs: ["normal"],
  // Declared right after the depth/normal pre-pass, so the visibility buffer
  // exists before anything is shaded and the standard shader can fold it into
  // the indirect term. Without a pre-pass that stage never fires and the
  // pipeline falls back to running the effect after the scene, applying the
  // occlusion over the shaded image instead.
  stage: (cameraEntity) =>
    isAOPreLighting(cameraEntity) ? "prePass" : "postProcessing",
  declare({ ctx, cameraEntity, viewport, textures, samplers, pass }) {
    // Both estimators reconstruct view-space position from depth and read the
    // view-space normal target.
    const depth = textures.get("depth");
    const normal = textures.get("normal");
    if (!depth || !normal) return;

    const camera = cameraEntity.camera!;
    const component = cameraEntity.postProcessing!.ssao!;
    const gtao = component.type === "gtao";

    // Only reachable after shading, which is exactly what isAOPreLighting keys
    // the stage off — so this is the same condition, not a second one.
    const screenSpaceBounce = !isAOPreLighting(cameraEntity);

    // The gathered color needs the full HDR range; visibility alone does not.
    const format: GPUTextureFormat = screenSpaceBounce
      ? "rgba16float"
      : "r8unorm";

    const noise = component.noiseTexture
      ? gtao
        ? getBlueNoiseTexture(ctx)
        : getNoiseTexture(ctx)
      : getDummyTexture(ctx);
    const noiseTextureSize = component.noiseTexture
      ? gtao
        ? BLUE_NOISE_SIZE
        : NOISE_SIZE
      : 1;

    // Shared by both estimators: the AO buffer's own dimensions, which the
    // chunks use to walk the depth target in texel steps.
    const estimator = {
      near: camera.near!,
      far: camera.far!,
      fov: camera.fov!,
      viewportSize: [viewport[2]!, viewport[3]!],
      texelSize: [1 / viewport[2]!, 1 / viewport[3]!],
      intensity: component.intensity!,
      radius: component.radius!,
      bias: component.bias!,
      brightness: component.brightness!,
      contrast: component.contrast!,
      noiseTextureSize,
    };

    const geometry = {
      uDepthTexture: depth,
      uDepthTextureSampler: samplers.nearest,
      uNormalTexture: normal,
      uNormalTextureSampler: samplers.nearest,
      uNoiseTexture: noise,
      uNoiseTextureSampler: samplers.linearRepeat,
    };

    let ao = pass({
      name: "main",
      shader: gtao ? gtaoShader : saoShader,
      // SAO declares no uTexture at all, so binding the chain would be a read
      // edge on an image it never samples — and at the prePass stage, on one
      // the opaque pass has not written yet.
      ...(!gtao && { source: null }),
      constants: gtao
        ? {
            GTAO_NUM_SLICES: component.slices!,
            GTAO_NUM_SAMPLES: component.samples!,
            USE_GTAO_NOISE_TEXTURE: !!component.noiseTexture,
            USE_GTAO_COLOR_BOUNCE: screenSpaceBounce,
          }
        : {
            SAO_NUM_SAMPLES: component.samples!,
            SAO_NUM_SPIRAL_TURNS: component.spiralTurns!,
            USE_SAO_NOISE_TEXTURE: !!component.noiseTexture,
          },
      clearValue: [0, 0, 0, 1],
      format,
      uniforms: {
        ...(gtao
          ? {
              uGTAO: {
                ...estimator,
                colorBounceIntensity: component.colorBounceIntensity!,
              },
            }
          : { uSAO: estimator }),
        ...geometry,
      },
    });

    // A negative radius turns the blur off, leaving the raw estimate.
    if (component.blurRadius! >= 0) {
      const blur = (direction: number[]) => ({
        uBlur: {
          direction,
          near: camera.near!,
          far: camera.far!,
          sharpness: component.blurSharpness!,
        },
        uDepthTexture: depth,
        uDepthTextureSampler: samplers.nearest,
      });

      const horizontal = pass({
        name: "blurHorizontal",
        shader: bilateralBlurShader,
        source: ao,
        clearValue: [0, 0, 0, 1],
        format,
        uniforms: blur([component.blurRadius!, 0]),
      });

      // Back into the estimate: the write lands after the read that produced
      // the horizontal pass, so the graph orders them and nothing downstream
      // sees the unblurred image.
      ao = pass({
        name: "blurVertical",
        shader: bilateralBlurShader,
        source: horizontal,
        target: ao,
        uniforms: blur([0, component.blurRadius!]),
      });
    }

    // Without DoF, combine applies the same mix for free. Neither applies when
    // the standard shader already folded occlusion into indirect light.
    if (cameraEntity.postProcessing!.dof && screenSpaceBounce) {
      pass({
        name: "mix",
        shader: ssaoMixShader,
        chain: true,
        constants: {
          USE_SSAO_COLORS: screenSpaceBounce,
          USE_SSAO_MULTI_BOUNCE: !!component.multiBounce,
        },
        clearValue: [0, 0, 0, 1],
        uniforms: {
          uSSAO: { mix: component.mix! },
          uSSAOTexture: ao,
          uSSAOTextureSampler: samplers.linear,
        },
      });
    }
  },
};

export default ssao;
