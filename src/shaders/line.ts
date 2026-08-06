import { chunks as SHADERS } from "pex-shaders";

import type { PipelineShaderOptions } from "../types.js";

// Line-specific vertex attribute @location convention (distinct from the
// mesh convention in basic.js/standard.js, since a line segment quad has no
// object-space position/normal/texCoord of its own): 0 position (quad-local
// corner, xy = signed width offset, z = 0 or 1 selecting endpoint A/B),
// 1 pointA, 2 pointB, 3 colorA, 4 colorB, 5 lineWidth (per-instance).
//
// uFrame.viewportSize doubles as the old uResolution uniform.

export default (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

  const useVertexColors = defines.has("USE_VERTEX_COLORS");
  const useInstancedLineWidth = defines.has("USE_INSTANCED_LINE_WIDTH");
  const usePerspectiveScaling = defines.has("USE_PERSPECTIVE_SCALING");
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

struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat3x3f,
}
@group(3) @binding(0) var<uniform> uModel: Model;

struct Material {
  baseColor: vec4f,
  lineWidth: f32,
}
@group(2) @binding(0) var<uniform> uMaterial: Material;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) pointA: vec3f,
  @location(2) pointB: vec3f,
  ${useVertexColors ? "@location(3) colorA: vec4f,\n  @location(4) colorB: vec4f," : ""}
  ${useInstancedLineWidth ? "@location(5) lineWidth: vec2f," : ""}
}

struct Varyings {
  @builtin(position) position: vec4f,
  ${useVertexColors ? "@location(0) color: vec4f," : ""}
}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  var lineWidthScale = vec2f(1.0);
  ${
    useVertexColors
      ? "output.color = mix(input.colorA, input.colorB, input.position.z);\n  lineWidthScale = vec2f(input.colorA.w, input.colorB.w);"
      : ""
  }

  if (length(input.pointA) == 0.0 || length(input.pointB) == 0.0) {
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

    ${useInstancedLineWidth ? "width *= input.lineWidth;" : ""}

    // Heuristic for resolution scaling to be relative to height / 1000
    width *= uFrame.viewportSize.y * 0.001;

    var pt0 = lineWidthScale.x * width;
    var pt1 = lineWidthScale.y * width;

    ${usePerspectiveScaling ? "pt0 /= -positionViewA.z;\n    pt1 /= -positionViewB.z;" : ""}

    pt0 += screen0;
    pt1 += screen1;

    let pt = mix(pt0, pt1, input.position.z);
    let clip = mix(clip0, clip1, input.position.z);

    output.position = vec4f(clip.w * ((2.0 * pt) / uFrame.viewportSize - 1.0), clip.z, clip.w);
  }

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

  ${useVertexColors ? "color *= decode(input.color, SRGB);" : ""}

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
