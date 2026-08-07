import { chunks as SHADERS } from "pex-shaders";

import type { FeatureField } from "../systems/renderer/base.js";
import {
  frameStruct,
  modelStruct,
  vertexInputStruct,
  vertexTransform,
  getDefineFlags,
} from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

const VERTEX_DEFINE = {
  texCoord0: "USE_TEXCOORD_0",
  instancedOffset: "USE_INSTANCED_OFFSET",
  instancedScale: "USE_INSTANCED_SCALE",
  instancedRotation: "USE_INSTANCED_ROTATION",
} as const;

export const DEPTH_PASS_VERTEX_FIELDS: readonly FeatureField[] = [
  { key: "texCoord0", define: VERTEX_DEFINE.texCoord0 },
  { key: "offset", define: VERTEX_DEFINE.instancedOffset },
  { key: "scale", define: VERTEX_DEFINE.instancedScale },
  { key: "rotation", define: VERTEX_DEFINE.instancedRotation },
];

/**
 * Vertex-only pass: write clip-space depth into the depth attachment and needs
 * no fragment stage or color output.
 *
 * USE_LINEAR_DEPTH switches to omni (point) shadows: a fragment stage overrides
 * the depth attachment with the normalized radial distance from the light
 * (length(viewPosition) / far). Radial distance is continuous across all six
 * cube faces, so there is no perspective-depth seam or near-plane precision
 * bunching. Because frag_depth is written explicitly, rasterizer depth bias no
 * longer applies — bias is done in the light shader's compare instead.
 *
 * The displacement offset is stretched 1.3x relative to standard.js's to reduce
 * acne/peter-panning from displaced surfaces. Alpha-tested shadows (a fragment
 * with discard) are not handled yet.
 */
export const depthPassShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { maxJoints = 256 } = options;

  const useNormals = defines.has("USE_NORMALS");
  const vertexFlags = getDefineFlags(VERTEX_DEFINE, defines);
  const useDisplacementTexture = defines.has("USE_DISPLACEMENT_TEXTURE");
  const useSkin = defines.has("USE_SKIN");
  const useLinearDepth = defines.has("USE_LINEAR_DEPTH");

  return /* wgsl */ `
${frameStruct({ extraFields: useLinearDepth ? "far: f32," : "" })}

${modelStruct({
  displacementTexture: useDisplacementTexture,
  skin: useSkin,
  maxJoints,
})}

${vertexInputStruct({
  normal: useNormals,
  texCoord0: vertexFlags.texCoord0 || useDisplacementTexture,
  instancedOffset: vertexFlags.instancedOffset,
  instancedScale: vertexFlags.instancedScale,
  instancedRotation: vertexFlags.instancedRotation,
  skin: useSkin,
})}

struct VertexOutput {
  @builtin(position) position: vec4f,
  ${useLinearDepth ? "@location(0) viewPosition: vec3f," : ""}
}

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

  ${vertexTransform({
    useSkin,
    instancedScale: vertexFlags.instancedScale,
    instancedRotation: vertexFlags.instancedRotation,
    instancedOffset: vertexFlags.instancedOffset,
  })}

  ${hooks.vertEnd ?? ""}

  var output: VertexOutput;
  let viewPosition = uFrame.viewMatrix * positionWorld;
  output.position = uFrame.projectionMatrix * viewPosition;
  ${useLinearDepth ? "output.viewPosition = viewPosition.xyz;" : ""}
  return output;
}
${
  useLinearDepth
    ? // The shadow pass view origin is the light, so |viewPosition| is the radial
      // distance from the light; normalize to [0, 1] to store in a depth texture.
      `@fragment
fn fragmentMain(input: VertexOutput) -> @builtin(frag_depth) f32 {
  return length(input.viewPosition) / uFrame.far;
}`
    : ""
}
`;
};
