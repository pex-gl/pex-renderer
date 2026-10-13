import { shaders as SHADERS } from "pex-shaders";

import {
  fragmentOutputStruct,
  sceneOutputMembers,
  frameStruct,
  modelStruct,
  vertexInputStruct,
  vertexOutputStruct,
  vertexTransform,
  getDefineFlags,
  vertexJitter,
  vertexVelocity,
  VELOCITY_MEMBERS,
  FRAGMENT_VELOCITY,
} from "./wgsl.js";

import type { PipelineShaderOptions } from "../types.js";

const VERTEX_DEFINE = {
  instancedOffset: "USE_INSTANCED_OFFSET",
  instancedScale: "USE_INSTANCED_SCALE",
  instancedRotation: "USE_INSTANCED_ROTATION",
  skin: "USE_SKIN",
} as const;

/**
 * Red fallback drawn in place of a failed pipeline. Hooks and material are
 * ignored.
 */
export const errorShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  // Hooks and material are the likeliest cause of the failure: keep only what
  // places the geometry.
  const outputs = options.outputs ?? {};
  const { skin, ...instancing } = getDefineFlags(VERTEX_DEFINE, defines);

  return /* wgsl */ `
${frameStruct()}

${modelStruct({
  previousModelMatrix: !!outputs.velocity,
  skin,
  ...(options.maxJoints && { maxJoints: options.maxJoints }),
})}

${vertexInputStruct({ ...instancing, skin })}

${vertexOutputStruct(outputs.velocity ? VELOCITY_MEMBERS : [])}

${fragmentOutputStruct(sceneOutputMembers(outputs))}

// Standard sets it per draw as a constant, basic keys it by define.
override USE_MSAA: bool = ${defines.has("USE_MSAA")};

${SHADERS.math.quatToMat4}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  var position = vec4f(input.position, 1.0);

  ${vertexTransform({ useSkin: skin, ...instancing })}

  let positionOut = uFrame.projectionMatrix * uFrame.viewMatrix * positionWorld;

  output.position = positionOut;
  ${outputs.velocity ? vertexVelocity(skin ? { previousWorld: "positionWorld" } : {}) : ""}
  ${vertexJitter()}

  return output;
}

${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = vec4f(1.0, 0.0, 0.0, 1.0);
  if (USE_MSAA) {
    output.color = vec4f(reversibleToneMap(output.color.rgb), 1.0);
  }

  ${outputs.normal ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${outputs.emissive ? "output.emissive = vec4f(0.0);" : ""}
  ${outputs.velocity ? FRAGMENT_VELOCITY : ""}
  ${outputs.responsive ? "output.responsive = vec4f(0.0);" : ""}

  return output;
}
`;
};
