import { blitShader } from "../../shaders/blit.js";
import { reversibleToneMapShader } from "../../shaders/reversible-tone-map.js";

// Built once: pex-gpu caches compiled pipelines by shader source identity.
const REVERSIBLE_TONE_MAP_WGSL = reversibleToneMapShader();

// Fullscreen-triangle blit: samples the linear HDR main pass target, applies
// the frame-wide tonemap, and encodes to sRGB for the canvas. WebGPU texture
// origin is top-left, so uv.y is flipped relative to the clip-space triangle.
const BLIT_WGSL = blitShader();

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

export default () => ({
  grabPass: {
    colorFormat: "rgba16float" as GPUTextureFormat,
    copyTexturePipelineDesc: {
      vertex: GRAB_PASS_COPY_WGSL,
      fragment: GRAB_PASS_COPY_WGSL,
      depthWriteEnabled: false,
    },
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
