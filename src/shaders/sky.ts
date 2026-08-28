import { chunks as SHADERS } from "pex-shaders";

import {
  fragmentOutputStruct,
  sceneOutputMembers,
  vertexOutputStruct,
} from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

// This shader bakes the analytic Preetham sky model (chunks.sky) into an
// equirectangular env map: a fullscreen quad, no Frame/Model bind groups.
// Attribute @location convention specific to this file: 0 position (vec2,
// clip-space quad corners).
//
// The env map stores linear HDR radiance (no tonemap/gamma here) so it matches
// other HDRIs.

export const skyShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const outputs = options.outputs ?? {};

  return /* wgsl */ `
struct Sky {
  sunPosition: vec3f,
  parameters: vec4f, // turbidity, rayleigh, mieCoefficient, mieDirectionalG
}
@group(0) @binding(0) var<uniform> uSky: Sky;

struct VertexInput {
  @location(0) position: vec2f,
}

${vertexOutputStruct([
  { name: "texCoord0", type: "vec2f" },
  { name: "sunDirection", type: "vec3f" },
  { name: "sunfade", type: "f32" },
  { name: "sunE", type: "f32" },
  { name: "betaR", type: "vec3f" },
  { name: "betaM", type: "vec3f" },
  { name: "mieDirectionalG", type: "f32" },
])}

${fragmentOutputStruct(sceneOutputMembers(outputs))}

// Vertex includes
${SHADERS.math.PI}
${SHADERS.math.saturate}
${(SHADERS as any).sky}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let sky = skyVertex(uSky.sunPosition, uSky.parameters);
  output.sunDirection = sky.sunDirection;
  output.sunfade = sky.sunfade;
  output.sunE = sky.sunE;
  output.betaR = sky.betaR;
  output.betaM = sky.betaM;
  output.mieDirectionalG = sky.mieDirectionalG;

  output.texCoord0 = input.position * 0.5 + 0.5;
  output.position = vec4f(input.position, 0.0, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;

  // Texture coordinates to direction:
  // https://web.archive.org/web/20170606085139/http://gl.ict.usc.edu/Data/HighResProbes/
  let theta = PI * (input.texCoord0.x * 2.0 - 1.0);
  let phi = PI * (1.0 - input.texCoord0.y);
  let direction = vec3f(sin(phi) * sin(theta), cos(phi), -sin(phi) * cos(theta));

  let sky = SkyData(
    input.sunDirection,
    input.sunfade,
    input.sunE,
    input.betaR,
    input.betaM,
    input.mieDirectionalG,
  );

  // Linear HDR; Clamp to the float16 max so the sun disk's radiance
  // (far above 65504) is never stored as Inf.
  let color = min(skyFrag(direction, sky), vec3f(65504.0));

  output.color = vec4f(color, 1.0);

  ${outputs.normal ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${outputs.emissive ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
