import { chunks as SHADERS } from "pex-shaders";

import type { PipelineShaderOptions } from "../types.js";

// Vertex attribute @location convention shared across pipeline shaders:
// 0 position, 1 normal, 2 tangent, 3 texCoord0, 4 texCoord1, 5 vertexColor,
// 6 instanced offset, 7 instanced scale, 8 instanced rotation, 9 instanced color,
// 10 joint, 11 weight.
//
// @group(0) uFrame and @group(3) uModel use a struct shape shared across all
// pipeline shaders so their bind groups can be reused across draws/pipelines
// without rebuilding a new bind group layout.
//
// Vertex and fragment stages are compiled as a single WGSL module (two entry
// points) rather than two separate files: the inter-stage varyings only need
// one struct definition this way, and @builtin(position) on that struct
// doubles as clip position on the way out of the vertex stage and framebuffer
// position on the way into the fragment stage, so no separate fragCoord
// parameter is needed either.

export default (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

  const useInstancedOffset = defines.has("USE_INSTANCED_OFFSET");
  const useInstancedScale = defines.has("USE_INSTANCED_SCALE");
  const useInstancedRotation = defines.has("USE_INSTANCED_ROTATION");
  const useInstancedColor = defines.has("USE_INSTANCED_COLOR");
  const useVertexColors = defines.has("USE_VERTEX_COLORS");
  const useColor = useVertexColors || useInstancedColor;
  const useMSAA = defines.has("USE_MSAA");
  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;

  const colorAssignment =
    useVertexColors && useInstancedColor
      ? "output.color = input.vertexColor * input.instanceColor;"
      : useInstancedColor
        ? "output.color = input.instanceColor;"
        : useVertexColors
          ? "output.color = input.vertexColor;"
          : "";

  return /* wgsl */ `
struct Frame {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  inverseViewMatrix: mat4x4f,
  cameraPosition: vec3f,
  viewportSize: vec2f,
}
@group(0) @binding(0) var<uniform> uFrame: Frame;

struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat3x3f,
}
@group(3) @binding(0) var<uniform> uModel: Model;

struct Material {
  baseColor: vec4f,
}
@group(2) @binding(0) var<uniform> uMaterial: Material;

struct VertexInput {
  @location(0) position: vec3f,
  ${useInstancedOffset ? "@location(6) offset: vec3f," : ""}
  ${useInstancedScale ? "@location(7) scale: vec3f," : ""}
  ${useInstancedRotation ? "@location(8) rotation: vec4f," : ""}
  ${useInstancedColor ? "@location(9) instanceColor: vec4f," : ""}
  ${useVertexColors ? "@location(5) vertexColor: vec4f," : ""}
}

struct Varyings {
  @builtin(position) position: vec4f,
  ${useColor ? "@location(0) color: vec4f," : ""}
}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
}

// Vertex includes
${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;
  var position = vec4f(input.position, 1.0);

  ${hooks.vertBeforeTransform ?? ""}

  ${useInstancedScale ? "position = vec4f(position.xyz * input.scale, position.w);" : ""}

  ${useInstancedRotation ? "let rotationMat = quatToMat4(input.rotation);\n  position = rotationMat * position;" : ""}

  ${useInstancedOffset ? "position = vec4f(position.xyz + input.offset, position.w);" : ""}

  let positionWorld = uModel.modelMatrix * position;

  ${colorAssignment}

  let positionView = uFrame.viewMatrix * positionWorld;
  let positionOut = uFrame.projectionMatrix * positionView;

  output.position = positionOut;

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.encodeDecode}
${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: Varyings) -> FragmentOutput {
  var output: FragmentOutput;
  var color = decode(uMaterial.baseColor, SRGB);

  ${useColor ? "color *= decode(input.color, SRGB);" : ""}

  ${useMSAA ? "color = vec4f(reversibleToneMap(color.xyz), color.w);" : ""}

  color = vec4f(max(color.xyz, vec3f(0.0)), color.w);

  output.color = color;

  ${useNormalOutput ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
