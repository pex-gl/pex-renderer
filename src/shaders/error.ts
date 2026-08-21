// See basic.js for the shared Frame/Model bind group conventions.

import { fragmentOutputStruct, vertexOutputStruct } from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

export const errorShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const outputs = options.outputs ?? {};

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

struct VertexInput {
  @location(0) position: vec3f,
}

${vertexOutputStruct([])}

${fragmentOutputStruct([
  outputs.normal && { name: "normal", type: "vec4f" },
  outputs.emissive && { name: "emissive", type: "vec4f" },
])}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uFrame.projectionMatrix * uFrame.viewMatrix * uModel.modelMatrix * vec4f(input.position, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = vec4f(1.0, 0.0, 0.0, 1.0);

  ${outputs.normal ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${outputs.emissive ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
