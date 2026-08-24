import { chunks, toneMap } from "pex-shaders";

import { NAMESPACE } from "../../utils.js";
import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

// pex-shaders' generated types lag behind until it is rebuilt (same reason as
// the casts in shaders/standard.ts and shaders/sky.ts) — and its tone map types
// still describe the GLSL package, which lacks the operators the WGSL one added.
const SHADERS = chunks as any;
const TONE_MAP = toneMap as unknown as Record<string, string>;

// Where the frame stops being scene-referred: everything above the tonemap
// works in linear HDR radiance, everything below it in display-referred sRGB.
// The pass writes to an `-srgb` format target, so the encode/decode pair around
// the LDR effects is what puts them in the space they were authored for —
// hardware re-encodes the linear value on write.

/**
 * Operator name, as `postProcessing.toneMap` spells it, to the module that
 * declares it. Neither half is derivable from the other: one module can declare
 * several operators (AgX ships three looks besides the base curve), and the
 * export key is the module, not the function.
 *
 * Only the selected module is included. Concatenating all of them would work
 * today — no two share a symbol — but each carries module-scope constants
 * (`ACESInputMat`, `AgXInsetMatrix`, the Rec.2020 matrices), so one added
 * operator colliding with another module or with a chunk would break every
 * variant of this shader, not just the one that selected it.
 */
const TONE_MAP_SOURCES: Record<string, string | undefined> = {
  aces: TONE_MAP.ACES,
  acesHill: TONE_MAP.ACES_HILL,
  agx: TONE_MAP.AGX,
  agxGolden: TONE_MAP.AGX,
  agxNeedle: TONE_MAP.AGX,
  agxPunchy: TONE_MAP.AGX,
  filmic: TONE_MAP.FILMIC,
  hejl: TONE_MAP.HEJL,
  lottes: TONE_MAP.LOTTES,
  neutral: TONE_MAP.NEUTRAL,
  reinhard: TONE_MAP.REINHARD,
  reinhard2: TONE_MAP.REINHARD2,
  reinhardJodie: TONE_MAP.REINHARD_JODIE,
  uchimura: TONE_MAP.UCHIMURA,
  uncharted2: TONE_MAP.UNCHARTED2,
  unreal: TONE_MAP.UNREAL,
};

/** Selectable tone map operators, in `postProcessing.toneMap` terms. */
export const TONE_MAP_OPERATORS = Object.keys(TONE_MAP_SOURCES);

/**
 * Prefix that carries the selection through `defines` — `TONE_MAP_agxPunchy`.
 * A define with a value in its name, as `COLOR_FUNCTION_*` is: it keys the
 * pipeline variant like any other define, and what follows the prefix is
 * literally the WGSL function the pass calls.
 */
export const TONE_MAP_DEFINE = "TONE_MAP_";

/**
 * Composites the HDR chain — fog, ambient occlusion, bloom — then tonemaps and
 * applies the display-referred grade.
 *
 * Every `Combine` member is always written, whichever effects are on: gating
 * struct fields would make the packing depend on the define set, and the cost
 * of a few unread floats in one per-pass uniform buffer is nil.
 *
 * With no `TONE_MAP_*` define the chain is left scene-referred and only
 * encoded, matching `postProcessing.toneMap: null`.
 */
export const combineShader = (defines: Set<string> = new Set()): string => {
  const operator = [...defines]
    .find((define) => define.startsWith(TONE_MAP_DEFINE))
    ?.slice(TONE_MAP_DEFINE.length);
  const toneMapSource = operator ? TONE_MAP_SOURCES[operator] : undefined;
  if (operator && !toneMapSource) {
    console.error(
      NAMESPACE,
      "post-processing",
      `unknown tone map "${operator}", expected one of ${TONE_MAP_OPERATORS.join(", ")}`,
    );
  }

  const useFog = defines.has("USE_FOG");
  const useSSAO = defines.has("USE_SSAO");
  const useBloom = defines.has("USE_BLOOM");
  const useVignette = defines.has("USE_VIGNETTE");
  const useLUT = defines.has("USE_LUT");
  const useColorCorrection = defines.has("USE_COLOR_CORRECTION");

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

struct Combine {
  viewMatrix: mat4x4f,
  fogColor: vec3f,
  fogStart: f32,
  sunPosition: vec3f,
  fogDensity: f32,
  sunColor: vec3f,
  sunDispertion: f32,
  inscatteringCoeffs: vec3f,
  sunIntensity: f32,
  near: f32,
  far: f32,
  fov: f32,
  exposure: f32,
  ssaoMix: f32,
  bloomIntensity: f32,
  vignetteRadius: f32,
  vignetteIntensity: f32,
  lutTextureSize: f32,
  brightness: f32,
  contrast: f32,
  saturation: f32,
  hue: f32,
}
@group(0) @binding(${alloc.next()}) var<uniform> uCombine: Combine;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${useFog ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d") : ""}
${useSSAO ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uSSAOTexture") : ""}
${useBloom ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uBloomTexture") : ""}
${useLUT ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uLUTTexture") : ""}

${fullscreenVertex()}

// Fragment includes
${SHADERS.math.PI}
${SHADERS.math.saturate}
${SHADERS.encodeDecode}
${toneMapSource ?? ""}
${useFog ? `${SHADERS.depthRead}\n${SHADERS.depthPosition}\n${SHADERS.fog}` : ""}
${
  useSSAO
    ? `override USE_SSAO_COLORS: bool = false;
override USE_SSAO_MULTI_BOUNCE: bool = false;
${SHADERS.ambientOcclusion.multiBounce}
${SHADERS.ambientOcclusion.mix}`
    : ""
}
${useVignette ? SHADERS.vignette : ""}
${useLUT ? SHADERS.lut : ""}
${useColorCorrection ? SHADERS.colorCorrection : ""}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.texCoord0;
  var color = textureSample(uTexture, uTextureSampler, uv);

  // HDR effects
  ${
    useFog
      ? `let z = readDepth(uDepthTexture, uDepthTextureSampler, uv, uCombine.near, uCombine.far);
  let position = reconstructPositionFromDepth(uv, z, uCombine.fov, uCombine.far, uPostProcessing.viewportSize);
  let rayLength = length(position);
  let sunDirection = normalize((uCombine.viewMatrix * vec4f(normalize(uCombine.sunPosition), 0.0)).xyz);
  color = vec4f(
    fog(
      color.rgb,
      rayLength - uCombine.fogStart,
      position / rayLength,
      sunDirection,
      uCombine.fogDensity,
      uCombine.sunColor,
      uCombine.sunDispertion,
      uCombine.sunIntensity,
      uCombine.inscatteringCoeffs,
      uCombine.fogColor
    ),
    color.a
  );`
      : ""
  }
  ${
    useSSAO
      ? "color = ssao(color, textureSample(uSSAOTexture, uSSAOTextureSampler, uv), uCombine.ssaoMix);"
      : ""
  }
  ${
    useBloom
      ? "color = vec4f(color.rgb + textureSample(uBloomTexture, uBloomTextureSampler, uv).rgb * uCombine.bloomIntensity, color.a);"
      : ""
  }

  // Tone mapping and gamma conversion
  color = vec4f(color.rgb * uCombine.exposure, color.a);
  ${toneMapSource ? `color = vec4f(saturateVec3(${operator}(color.rgb)), color.a);` : ""}

  var colorSRGB = encode(color, SRGB);

  // LDR effects
  ${
    useVignette
      ? "colorSRGB = vec4f(vignette(colorSRGB.rgb, uv, uCombine.vignetteRadius, uCombine.vignetteIntensity), colorSRGB.a);"
      : ""
  }
  ${
    useLUT
      ? "colorSRGB = vec4f(lut(vec4f(colorSRGB.rgb, 1.0), uLUTTexture, uLUTTextureSampler, uCombine.lutTextureSize).rgb, colorSRGB.a);"
      : ""
  }
  ${
    useColorCorrection
      ? `colorSRGB = vec4f(brightnessContrastVec3(colorSRGB.rgb, uCombine.brightness, uCombine.contrast), colorSRGB.a);
  colorSRGB = vec4f(saturation(colorSRGB.rgb, uCombine.saturation), colorSRGB.a);
  colorSRGB = vec4f(hue(colorSRGB.rgb, uCombine.hue / 180.0 * PI), colorSRGB.a);`
      : ""
  }

  return decode(colorSRGB, SRGB);
}
`);
};
