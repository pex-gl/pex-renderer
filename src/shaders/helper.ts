import { chunks as SHADERS } from "pex-shaders";

import { vertexOutputStruct } from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

// Debug helper geometry (grids, gizmos, bounding boxes) is authored directly
// in world space, so unlike basic.js/standard.js there is no @group(3) Model
// (no modelMatrix). @location(5) for vertexColor still matches the shared
// mesh attribute convention, leaving 1-4 free for parity with other pipelines.

export const helperShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

  const useMSAA = defines.has("USE_MSAA");
  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;

  return /* wgsl */ `
struct Frame {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  inverseViewMatrix: mat4x4f,
  cameraPosition: vec3f,
  viewportSize: vec2f,
}
@group(0) @binding(0) var<uniform> uFrame: Frame;

struct VertexInput {
  @location(0) position: vec3f,
  @location(5) vertexColor: vec4f,
}

${vertexOutputStruct([{ name: "color", type: "vec4f" }])}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.color = input.vertexColor;
  output.position = uFrame.projectionMatrix * uFrame.viewMatrix * vec4f(input.position, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.encodeDecode}
${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  var color = decode(input.color, SRGB);

  ${useMSAA ? "color = vec4f(reversibleToneMap(color.xyz), color.w);" : ""}

  output.color = color;

  ${useNormalOutput ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
