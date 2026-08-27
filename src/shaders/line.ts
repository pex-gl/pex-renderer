import { chunks as SHADERS } from "pex-shaders";

import {
  frameStruct,
  modelStruct,
  fragmentOutputStruct,
  getDefineFlags,
  vertexJitter,
} from "./wgsl.js";

import type { FeatureField } from "../systems/renderer/base.js";
import type { PipelineShaderOptions } from "../types.js";

// Line feature defines. The vertex flags come off the geometry attributes, the
// material flags off the material component (see LINE_*_FIELDS below).
const VERTEX_DEFINE = {
  vertexColor: "USE_VERTEX_COLORS",
  instancedLineWidth: "USE_INSTANCED_LINE_WIDTH",
} as const;

const MATERIAL_DEFINE = {
  perspectiveScaling: "USE_PERSPECTIVE_SCALING",
} as const;

/** Walked against `_geometry.attributes` by the renderer's `getDefines`. */
export const LINE_VERTEX_FIELDS: readonly FeatureField[] = [
  { key: "vertexColor", define: VERTEX_DEFINE.vertexColor },
  { key: "lineWidth", define: VERTEX_DEFINE.instancedLineWidth },
];

/** Walked against the material by the renderer's `getDefines`. */
export const LINE_MATERIAL_FIELDS: readonly FeatureField[] = [
  // Boolean flag: `perspectiveScaling: false` must not activate the define,
  // and the material factory always sets the key.
  {
    key: "perspectiveScaling",
    define: MATERIAL_DEFINE.perspectiveScaling,
    truthy: true,
  },
];

// Path-break sentinel: an endpoint with any component this large marks a
// discontinuity (the segment is dropped, see vertexMain). A finite value an
// order of magnitude above LINE_BREAK_THRESHOLD, so real coordinates — [0,0,0]
// included — are never mistaken for a break. NaN/Inf are deliberately avoided:
// WGSL has no isNan/isInf and may fold them away under fast math.
export const LINE_BREAK = 1e34;
const LINE_BREAK_THRESHOLD = "1e33";

// Line-specific vertex @location convention (distinct from the mesh convention
// in basic.ts/standard.ts, so its VertexInput is declared inline rather than
// via vertexInputStruct): a line segment quad has no object-space attributes of
// its own. 0 position (quad-local corner, xy = signed width offset, z = 0 or 1
// selecting endpoint A/B), 1 pointA, 2 pointB, 3 colorA, 4 colorB,
// 5 lineWidth (per-instance). uFrame.viewportSize doubles as the old
// uResolution uniform.
export const lineShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const outputs = options.outputs ?? {};

  const vertexFlags = getDefineFlags(VERTEX_DEFINE, defines);
  const materialFlags = getDefineFlags(MATERIAL_DEFINE, defines);
  const useMSAA = defines.has("USE_MSAA");

  return /* wgsl */ `
${frameStruct()}

${modelStruct()}

struct Material {
  baseColor: vec4f,
  lineWidth: f32,
}
@group(2) @binding(0) var<uniform> uMaterial: Material;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) pointA: vec3f,
  @location(2) pointB: vec3f,
  ${vertexFlags.vertexColor ? "@location(3) colorA: vec4f,\n  @location(4) colorB: vec4f," : ""}
  ${vertexFlags.instancedLineWidth ? "@location(5) lineWidth: vec2f," : ""}
}

struct Varyings {
  @builtin(position) position: vec4f,
  ${vertexFlags.vertexColor ? "@location(0) color: vec4f," : ""}
}

${fragmentOutputStruct([
  outputs.normal && { name: "normal", type: "vec4f" },
  outputs.emissive && { name: "emissive", type: "vec4f" },
])}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  var lineWidthScale = vec2f(1.0);
  ${
    vertexFlags.vertexColor
      ? "output.color = mix(input.colorA, input.colorB, input.position.z);\n  lineWidthScale = vec2f(input.colorA.w, input.colorB.w);"
      : ""
  }

  // Drop the segment on a path break (endpoint at the LINE_BREAK sentinel).
  // Finite magnitude test only — see LINE_BREAK.
  let threshold = vec3f(${LINE_BREAK_THRESHOLD});
  if (any(abs(input.pointA) > threshold) || any(abs(input.pointB) > threshold)) {
    output.position = vec4f(0.0, 0.0, 0.0, 1.0);
  } else {
    let positionViewA = uFrame.viewMatrix * uModel.modelMatrix * vec4f(input.pointA, 1.0);
    let positionViewB = uFrame.viewMatrix * uModel.modelMatrix * vec4f(input.pointB, 1.0);

    let clip0 = uFrame.projectionMatrix * positionViewA;
    let clip1 = uFrame.projectionMatrix * positionViewB;

    let screen0 = uFrame.viewportSize * (0.5 * clip0.xy / clip0.w + 0.5);
    let screen1 = uFrame.viewportSize * (0.5 * clip1.xy / clip1.w + 0.5);

    let xBasis = normalize(screen1 - screen0);
    let yBasis = vec2f(-xBasis.y, xBasis.x);

    var width = uMaterial.lineWidth * (input.position.x * xBasis + input.position.y * yBasis);

    ${vertexFlags.instancedLineWidth ? "width *= input.lineWidth;" : ""}

    // Heuristic for resolution scaling to be relative to height / 1000
    width *= uFrame.viewportSize.y * 0.001;

    var pt0 = lineWidthScale.x * width;
    var pt1 = lineWidthScale.y * width;

    ${materialFlags.perspectiveScaling ? "pt0 /= -positionViewA.z;\n    pt1 /= -positionViewB.z;" : ""}

    pt0 += screen0;
    pt1 += screen1;

    let pt = mix(pt0, pt1, input.position.z);
    let clip = mix(clip0, clip1, input.position.z);

    output.position = vec4f(clip.w * ((2.0 * pt) / uFrame.viewportSize - 1.0), clip.z, clip.w);
  }

  ${vertexJitter()}

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

  ${vertexFlags.vertexColor ? "color *= decode(input.color, SRGB);" : ""}

  ${useMSAA ? "color = vec4f(reversibleToneMap(color.xyz), color.w);" : ""}

  color = vec4f(max(color.xyz, vec3f(0.0)), color.w);

  output.color = color;

  ${outputs.normal ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${outputs.emissive ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
