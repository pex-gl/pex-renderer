import { pipeline as SHADERS } from "pex-shaders";
import { CUBEMAP_SIDES } from "../../utils.js";

// Fullscreen-triangle blit: samples the linear HDR main pass target and encodes
// to sRGB for the canvas. WebGPU texture origin is top-left, so uv.y is flipped
// relative to the clip-space triangle.
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

fn linearToSrgb(c: vec3f) -> vec3f {
  let lower = c * 12.92;
  let higher = 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055;
  return select(higher, lower, c < vec3f(0.0031308));
}

@fragment
fn fragmentMain(input: Varyings) -> @location(0) vec4f {
  let color = textureSample(uTexture, uSampler, input.uv);
  return vec4f(linearToSrgb(color.rgb), color.a);
}
`;

export default (ctx) => ({
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
      pixelFormat: "depth24plus",
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
      pixelFormat: "depth24plus",
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
      pixelFormat: "depth24plus",
    },
    cubemapSides: structuredClone(CUBEMAP_SIDES),
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
      vert: SHADERS.blit.vert,
      frag: /* glsl */ `
precision highp float;

uniform vec4 uViewport;
uniform sampler2D uTexture;

varying vec2 vTexCoord0;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord0);
}`,
    },
  },
  postProcessing: {
    outputTextureDesc: { pixelFormat: "rgba16float" },
    srgbOutputTextureDesc: { pixelFormat: "rgba8unorm-srgb" },
  },
  reversibleToneMap: {
    pipelineDesc: {
      vert: SHADERS.blit.vert,
      frag: SHADERS.reversibleToneMap.frag,
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
