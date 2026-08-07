import { chunks as SHADERS } from "pex-shaders";

import {
  fragmentOutputStruct,
  frameStruct,
  modelStruct,
  vertexInputStruct,
  vertexTransform,
  getDefineFlags,
} from "./wgsl.js";

import type { FeatureField } from "../systems/renderer/base.js";
import type { PipelineShaderOptions } from "../types.js";

const VERTEX_DEFINE = {
  vertexColor: "USE_VERTEX_COLORS",
  instancedOffset: "USE_INSTANCED_OFFSET",
  instancedScale: "USE_INSTANCED_SCALE",
  instancedRotation: "USE_INSTANCED_ROTATION",
  instancedColor: "USE_INSTANCED_COLOR",
} as const;

export const BASIC_VERTEX_FIELDS: readonly FeatureField[] = [
  { key: "vertexColor", define: VERTEX_DEFINE.vertexColor },
  { key: "offset", define: VERTEX_DEFINE.instancedOffset },
  { key: "scale", define: VERTEX_DEFINE.instancedScale },
  { key: "rotation", define: VERTEX_DEFINE.instancedRotation },
  { key: "instanceColor", define: VERTEX_DEFINE.instancedColor },
];

export const basicShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

  const vertexFlags = getDefineFlags(VERTEX_DEFINE, defines);
  const useColor = vertexFlags.vertexColor || vertexFlags.instancedColor;
  const useMSAA = defines.has("USE_MSAA");
  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;

  const colorAssignment =
    vertexFlags.vertexColor && vertexFlags.instancedColor
      ? "output.color = input.vertexColor * input.instanceColor;"
      : vertexFlags.instancedColor
        ? "output.color = input.instanceColor;"
        : vertexFlags.vertexColor
          ? "output.color = input.vertexColor;"
          : "";

  return /* wgsl */ `
${frameStruct()}

${modelStruct()}

struct Material {
  baseColor: vec4f,
}
@group(2) @binding(0) var<uniform> uMaterial: Material;

${vertexInputStruct({
  vertexColor: vertexFlags.vertexColor,
  instancedOffset: vertexFlags.instancedOffset,
  instancedScale: vertexFlags.instancedScale,
  instancedRotation: vertexFlags.instancedRotation,
  instancedColor: vertexFlags.instancedColor,
})}

struct Varyings {
  @builtin(position) position: vec4f,
  ${useColor ? "@location(0) color: vec4f," : ""}
}

${fragmentOutputStruct({
  normal: useNormalOutput ? locationNormal : -1,
  emissive: useEmissiveOutput ? locationEmissive : -1,
})}

${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;
  var position = vec4f(input.position, 1.0);

  ${hooks.vertBeforeTransform ?? ""}

  ${vertexTransform({
    instancedScale: vertexFlags.instancedScale,
    instancedRotation: vertexFlags.instancedRotation,
    instancedOffset: vertexFlags.instancedOffset,
  })}

  ${colorAssignment}

  let positionView = uFrame.viewMatrix * positionWorld;
  let positionOut = uFrame.projectionMatrix * positionView;

  output.position = positionOut;

  ${hooks.vertEnd ?? ""}

  return output;
}

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
