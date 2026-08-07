import { reversibleToneMapShader } from "../../shaders/reversible-tone-map.js";
import { CUBEMAP_SIDES } from "../../utils.js";

import type { GpuContext } from "../../types.js";

// Fullscreen-triangle blit: samples the linear HDR main pass target, applies
// the frame-wide tonemap, and encodes to sRGB for the canvas. WebGPU texture
// origin is top-left, so uv.y is flipped relative to the clip-space triangle.
const BLIT_WGSL = /* wgsl */ `
struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@location(0) position: vec2f) -> Varyings {
  var output: Varyings;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = vec2f(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return output;
}

@group(0) @binding(0) var uTexture: texture_2d<f32>;
@group(0) @binding(1) var uSampler: sampler;

// Narkowicz ACES filmic tonemap: linear HDR scene radiance to display range.
// Frame-wide interim home for tonemapping until post-processing (which will own
// exposure and operator selection) is ported.
fn aces(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

fn linearToSrgb(c: vec3f) -> vec3f {
  let lower = c * 12.92;
  let higher = 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055;
  return select(higher, lower, c < vec3f(0.0031308));
}

@fragment
fn fragmentMain(input: Varyings) -> @location(0) vec4f {
  let color = textureSample(uTexture, uSampler, input.uv);
  return vec4f(linearToSrgb(aces(color.rgb)), color.a);
}
`;

// Copies the main pass's color target into the (same-or-smaller,
// power-of-two) grab pass texture, top-left anchored. Both textures share the
// same origin, so the fragment position doubles directly as the source texel
// coordinate — an exact copy needs no sampler or UV remap.
const GRAB_PASS_COPY_WGSL = /* wgsl */ `
struct Varyings {
  @builtin(position) position: vec4f,
}

@vertex
fn vertexMain(@location(0) position: vec2f) -> Varyings {
  var output: Varyings;
  output.position = vec4f(position, 0.0, 1.0);
  return output;
}

@group(0) @binding(0) var uTexture: texture_2d<f32>;

@fragment
fn fragmentMain(input: Varyings) -> @location(0) vec4f {
  return textureLoad(uTexture, vec2i(input.position.xy), 0);
}
`;

export default (ctx: GpuContext) => ({
  directionalLightShadows: {
    colorMapDesc: {
      name: "directionalLightColorMap",
      width: 2048,
      height: 2048,
      pixelFormat: "rgba8unorm",
    },
    shadowMapDesc: {
      name: "directionalLightShadowMap",
      width: 2048,
      height: 2048,
      pixelFormat: "depth32float",
    },
    pass: {
      name: "directionalLightShadowMappingPass",
      color: [],
      depth: null,
      clearColor: [0, 0, 0, 1],
      clearDepth: 1,
    },
  },
  spotLightShadows: {
    colorMapDesc: {
      name: "spotLightColorMap",
      width: 2048,
      height: 2048,
      pixelFormat: "rgba8unorm",
    },
    shadowMapDesc: {
      name: "spotLightShadowMap",
      width: 2048,
      height: 2048,
      pixelFormat: "depth32float",
    },
    pass: {
      name: "spotLightShadowMappingPass",
      color: [],
      depth: null,
      clearColor: [0, 0, 0, 1],
      clearDepth: 1,
    },
  },
  pointLightShadows: {
    colorMapDesc: {
      name: "pointLightShadowCubemap",
      width: 2048,
      height: 2048,
      pixelFormat: "rgba8unorm",
    },
    shadowMapDesc: {
      name: "pointLightShadowMap",
      width: 2048,
      height: 2048,
      pixelFormat: "depth32float",
    },
    passes: CUBEMAP_SIDES.map((side, i) => ({
      name: `pointLightShadowMappingSide${i}`,
      color: [{ target: i }],
      depth: null,
      clearColor: side.color,
      clearDepth: 1,
    })),
  },
  mainPass: {
    outputTextureDesc: {
      name: "mainPassColorTexture",
      width: 1,
      height: 1,
      pixelFormat: "rgba16float",
    },
    outputDepthTextureDesc: {
      name: "mainPassDepthTexture",
      width: 1,
      height: 1,
      pixelFormat: "depth24plus",
    },
    pass: {
      color: [],
    },
  },
  grabPass: {
    colorCopyTextureDesc: {
      name: "grabPassColorCopyTexture",
      width: 1,
      height: 1,
      pixelFormat: "rgba16float",
      mipmap: true,
    },
    copyTexturePipelineDesc: {
      vertex: GRAB_PASS_COPY_WGSL,
      fragment: GRAB_PASS_COPY_WGSL,
      depthWriteEnabled: false,
    },
  },
  postProcessing: {
    outputTextureDesc: { pixelFormat: "rgba16float" },
    srgbOutputTextureDesc: { pixelFormat: "rgba8unorm-srgb" },
  },
  reversibleToneMap: {
    pipelineDesc: {
      // Legacy GLSL path, not yet ported to the WGSL reversibleToneMap generator.
      vert: BLIT_WGSL,
      frag: reversibleToneMapShader(),
    },
  },
  blit: {
    pipelineDesc: {
      vertex: BLIT_WGSL,
      fragment: BLIT_WGSL,
      depthWriteEnabled: false,
    },
  },
});
