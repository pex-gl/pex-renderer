import { reversibleToneMapShader } from "../../shaders/reversible-tone-map.js";

import type { GpuContext } from "../../types.js";

// Built once: pex-gpu caches compiled pipelines by shader source identity.
const REVERSIBLE_TONE_MAP_WGSL = reversibleToneMapShader();

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

// Linear-filtered downsample of one grab-pass mip into the next, building the
// mip chain the transmission pass samples for roughness-based refraction blur.
// uv keeps the grab's top-left origin (no flip) so every level stays aligned.
const GRAB_DOWNSAMPLE_WGSL = /* wgsl */ `
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

@fragment
fn fragmentMain(input: Varyings) -> @location(0) vec4f {
  return textureSample(uTexture, uSampler, input.uv);
}
`;

export default (_ctx: GpuContext) => ({
  mainPass: {
    colorFormat: "rgba16float" as GPUTextureFormat,
    depthFormat: "depth24plus" as GPUTextureFormat,
  },
  grabPass: {
    colorFormat: "rgba16float" as GPUTextureFormat,
    copyTexturePipelineDesc: {
      vertex: GRAB_PASS_COPY_WGSL,
      fragment: GRAB_PASS_COPY_WGSL,
      depthWriteEnabled: false,
    },
    downsamplePipelineDesc: {
      vertex: GRAB_DOWNSAMPLE_WGSL,
      fragment: GRAB_DOWNSAMPLE_WGSL,
      depthWriteEnabled: false,
    },
  },
  postProcessing: {
    /** Linear HDR working format for intermediate effect targets. */
    colorFormat: "rgba16float" as GPUTextureFormat,
    /** Display-referred format, from the tonemap onwards. */
    srgbColorFormat: "rgba8unorm-srgb" as GPUTextureFormat,
  },
  reversibleToneMap: {
    // The generator emits both stages, so one source serves as vertex and
    // fragment — same shape as the blit and grab pass descriptors.
    pipelineDesc: {
      vertex: REVERSIBLE_TONE_MAP_WGSL,
      fragment: REVERSIBLE_TONE_MAP_WGSL,
      depthWriteEnabled: false,
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
