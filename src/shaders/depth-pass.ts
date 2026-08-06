import { chunks as SHADERS } from "pex-shaders";

import type { PipelineShaderOptions } from "../types.js";

// See standard.js for the shared Frame/Model bind group and attribute @location
// conventions. 2D shadow maps (directional/spot/area) are depth textures sampled
// with a comparison sampler, so this pass is vertex-only: it writes clip-space
// depth into the depth attachment and needs no fragment stage or color output.
//
// USE_LINEAR_DEPTH switches to omni (point) shadows: a fragment stage overrides
// the depth attachment with the normalized radial distance from the light
// (length(viewPosition) / far). Radial distance is continuous across all six
// cube faces, so there is no perspective-depth seam or near-plane precision
// bunching. Because frag_depth is written explicitly, rasterizer depth bias no
// longer applies — bias is done in the light shader's compare instead.
//
// The displacement offset is stretched 1.3x relative to standard.js's to reduce
// acne/peter-panning from displaced surfaces. Alpha-tested shadows (a fragment
// with discard) are not handled yet.

export default (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { maxJoints = 256 } = options;

  const useNormals = defines.has("USE_NORMALS");
  const useTexCoord0 = defines.has("USE_TEXCOORD_0");
  const useInstancedOffset = defines.has("USE_INSTANCED_OFFSET");
  const useInstancedScale = defines.has("USE_INSTANCED_SCALE");
  const useInstancedRotation = defines.has("USE_INSTANCED_ROTATION");
  const useDisplacementTexture = defines.has("USE_DISPLACEMENT_TEXTURE");
  const useSkin = defines.has("USE_SKIN");
  const useLinearDepth = defines.has("USE_LINEAR_DEPTH");

  return /* wgsl */ `
struct Frame {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  inverseViewMatrix: mat4x4f,
  cameraPosition: vec3f,
  viewportSize: vec2f,
  ${useLinearDepth ? "far: f32," : ""}
}
@group(0) @binding(0) var<uniform> uFrame: Frame;

struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat3x3f,
  ${useDisplacementTexture ? "displacement: f32," : ""}
}
@group(3) @binding(0) var<uniform> uModel: Model;
${useSkin ? `@group(3) @binding(1) var<uniform> uJointMatrices: array<mat4x4f, ${maxJoints}>;` : ""}
${useDisplacementTexture ? "@group(3) @binding(2) var uDisplacementTexture: texture_2d<f32>;\n@group(3) @binding(3) var uDisplacementTextureSampler: sampler;" : ""}

struct VertexInput {
  @location(0) position: vec3f,
  ${useNormals ? "@location(1) normal: vec3f," : ""}
  ${useTexCoord0 || useDisplacementTexture ? "@location(3) texCoord0: vec2f," : ""}
  ${useInstancedOffset ? "@location(6) offset: vec3f," : ""}
  ${useInstancedScale ? "@location(7) scale: vec3f," : ""}
  ${useInstancedRotation ? "@location(8) rotation: vec4f," : ""}
  ${useSkin ? "@location(10) joint: vec4f,\n  @location(11) weight: vec4f," : ""}
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  ${useLinearDepth ? "@location(0) viewPosition: vec3f," : ""}
}

// Vertex includes
${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var position = vec4f(input.position, 1.0);
  var normal = vec3f(0.0, 0.0, 0.0);
  ${useNormals ? "normal = input.normal;" : ""}

  ${hooks.vertBeforeTransform ?? ""}

  ${
    useDisplacementTexture
      ? "let h = textureSampleLevel(uDisplacementTexture, uDisplacementTextureSampler, input.texCoord0, 0.0).x;\n  position = vec4f(position.xyz + uModel.displacement * h * normal * 1.3, position.w);"
      : ""
  }

  var positionWorld: vec4f;
  ${
    useSkin
      ? `let skinMat =
    input.weight.x * uJointMatrices[u32(input.joint.x)] +
    input.weight.y * uJointMatrices[u32(input.joint.y)] +
    input.weight.z * uJointMatrices[u32(input.joint.z)] +
    input.weight.w * uJointMatrices[u32(input.joint.w)];

  positionWorld = skinMat * position;

  ${useInstancedScale ? "positionWorld = vec4f(positionWorld.xyz * input.scale, positionWorld.w);" : ""}

  ${useInstancedRotation ? "let rotationMat = quatToMat4(input.rotation);\n  positionWorld = rotationMat * positionWorld;" : ""}

  ${useInstancedOffset ? "positionWorld = vec4f(positionWorld.xyz + input.offset, positionWorld.w);" : ""}`
      : `${useInstancedScale ? "position = vec4f(position.xyz * input.scale, position.w);\n  " : ""}${useInstancedRotation ? "let rotationMat = quatToMat4(input.rotation);\n  position = rotationMat * position;\n  " : ""}${useInstancedOffset ? "position = vec4f(position.xyz + input.offset, position.w);\n  " : ""}
  positionWorld = uModel.modelMatrix * position;`
  }

  ${hooks.vertEnd ?? ""}

  var output: VertexOutput;
  let viewPosition = uFrame.viewMatrix * positionWorld;
  output.position = uFrame.projectionMatrix * viewPosition;
  ${useLinearDepth ? "output.viewPosition = viewPosition.xyz;" : ""}
  return output;
}
${
  useLinearDepth
    ? `
@fragment
fn fragmentMain(input: VertexOutput) -> @builtin(frag_depth) f32 {
  // The shadow pass view origin is the light, so |viewPosition| is the radial
  // distance from the light; normalize to [0, 1] to store in a depth texture.
  return length(input.viewPosition) / uFrame.far;
}`
    : ""
}
`;
};
