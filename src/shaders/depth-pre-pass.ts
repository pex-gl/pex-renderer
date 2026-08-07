import { chunks as SHADERS } from "pex-shaders";

import type { FeatureField } from "../systems/renderer/base.js";
import {
  createBindingAllocator,
  fragmentOutputStruct,
  frameStruct,
  modelStruct,
  getTexCoordGetter,
  getDefineFlags,
  textureMatrixField,
  textureSamplerDeclaration,
  vertexInputStruct,
  vertexTransform,
} from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

const VERTEX_DEFINE = {
  texCoord0: "USE_TEXCOORD_0",
  texCoord1: "USE_TEXCOORD_1",
  vertexColor: "USE_VERTEX_COLORS",
  instancedOffset: "USE_INSTANCED_OFFSET",
  instancedScale: "USE_INSTANCED_SCALE",
  instancedRotation: "USE_INSTANCED_ROTATION",
  instancedColor: "USE_INSTANCED_COLOR",
} as const;

export const DEPTH_PRE_PASS_VERTEX_FIELDS: readonly FeatureField[] = [
  { key: "texCoord0", define: VERTEX_DEFINE.texCoord0 },
  { key: "texCoord1", define: VERTEX_DEFINE.texCoord1 },
  { key: "vertexColor", define: VERTEX_DEFINE.vertexColor },
  { key: "offset", define: VERTEX_DEFINE.instancedOffset },
  { key: "scale", define: VERTEX_DEFINE.instancedScale },
  { key: "rotation", define: VERTEX_DEFINE.instancedRotation },
  { key: "instanceColor", define: VERTEX_DEFINE.instancedColor },
];

export const depthPrePassShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { maxJoints = 256 } = options;
  const texCoords = options.texCoords || {};

  const tc = getTexCoordGetter(texCoords);

  const useNormals = defines.has("USE_NORMALS");
  const vertexFlags = getDefineFlags(VERTEX_DEFINE, defines);
  const useColor = vertexFlags.vertexColor || vertexFlags.instancedColor;
  const useDisplacementTexture = defines.has("USE_DISPLACEMENT_TEXTURE");
  const useSkin = defines.has("USE_SKIN");
  const useBaseColorTexture = defines.has("USE_BASE_COLOR_TEXTURE");
  const useAlphaTexture = defines.has("USE_ALPHA_TEXTURE");
  const useAlphaTest = defines.has("USE_ALPHA_TEST");

  const colorAssignment =
    vertexFlags.vertexColor && vertexFlags.instancedColor
      ? "output.color = input.vertexColor * input.instanceColor;"
      : vertexFlags.instancedColor
        ? "output.color = input.instanceColor;"
        : vertexFlags.vertexColor
          ? "output.color = input.vertexColor;"
          : "";

  const vColorExpr = useColor ? "input.color" : "vec4f(1.0)";

  const materialBindings = createBindingAllocator(1);

  const baseColorTex = useBaseColorTexture
    ? materialBindings.nextTextureSampler()
    : null;
  const alphaTex = useAlphaTexture
    ? materialBindings.nextTextureSampler()
    : null;

  const alphaBlock = () => {
    if (!useAlphaTexture && !useAlphaTest) return "";
    return /* wgsl */ `
  ${
    useAlphaTexture
      ? `let alphaTexCoord = getTextureCoordinatesTransformed(data, ${tc("alpha")}, uMaterial.alphaTextureMatrix);\n  data.opacity *= textureSample(uAlphaTexture, uAlphaTextureSampler, alphaTexCoord).x;`
      : ""
  }
  ${useAlphaTest ? "alphaTest(&data, uMaterial.alphaTest);" : ""}`;
  };

  return /* wgsl */ `
${frameStruct()}

${modelStruct({
  displacementTexture: useDisplacementTexture,
  skin: useSkin,
  maxJoints,
})}

struct Material {
  baseColor: vec4f,
  ${textureMatrixField("baseColorTexture", baseColorTex)}
  ${textureMatrixField("alphaTexture", alphaTex)}
  ${useAlphaTest ? "alphaTest: f32," : ""}
}
@group(2) @binding(0) var<uniform> uMaterial: Material;
${textureSamplerDeclaration(2, baseColorTex, "uBaseColorTexture")}
${textureSamplerDeclaration(2, alphaTex, "uAlphaTexture")}

${vertexInputStruct({
  normal: useNormals,
  texCoord0: vertexFlags.texCoord0 || useDisplacementTexture,
  texCoord1: vertexFlags.texCoord1,
  vertexColor: vertexFlags.vertexColor,
  instancedOffset: vertexFlags.instancedOffset,
  instancedScale: vertexFlags.instancedScale,
  instancedRotation: vertexFlags.instancedRotation,
  instancedColor: vertexFlags.instancedColor,
  skin: useSkin,
})}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) normalView: vec3f,
  @location(1) texCoord0: vec2f,
  ${vertexFlags.texCoord1 ? "@location(2) texCoord1: vec2f," : ""}
  @location(3) positionView: vec3f,
  ${useColor ? "@location(4) color: vec4f," : ""}
}

struct PBRData {
  texCoord0: vec2f,
  texCoord1: vec2f,
  baseColor: vec3f,
  opacity: f32,
}

// Feature toggles the included chunks expect this pipeline shader to declare.
override DEPTH_PASS_ONLY: bool = false;
override DEPTH_PRE_PASS_ONLY: bool = true;
override USE_TEXCOORD_1: bool = ${vertexFlags.texCoord1};

${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  var position = vec4f(input.position, 1.0);
  var normal = vec3f(0.0, 0.0, 0.0);
  ${useNormals ? "normal = input.normal;" : ""}

  var texCoord = vec2f(0.0, 0.0);
  ${vertexFlags.texCoord0 ? "texCoord = input.texCoord0;" : ""}
  output.texCoord0 = texCoord;

  ${vertexFlags.texCoord1 ? "output.texCoord1 = input.texCoord1;" : ""}

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
    transformNormal: true,
  })}

  ${colorAssignment}

  let positionView = uFrame.viewMatrix * positionWorld;
  let positionOut = uFrame.projectionMatrix * positionView;

  output.positionView = positionView.xyz;
  output.position = positionOut;

  ${hooks.vertEnd ?? ""}

  return output;
}

${SHADERS.encodeDecode}
${SHADERS.textureCoordinates}
${SHADERS.baseColor}
${SHADERS.alpha}

${hooks.fragDeclarationsEnd ?? ""}

${fragmentOutputStruct()}

@fragment
fn fragmentMain(input: Varyings, @builtin(front_facing) frontFacing: bool) -> FragmentOutput {
  var output: FragmentOutput;

  var data: PBRData;
  data.texCoord0 = input.texCoord0;
  ${vertexFlags.texCoord1 ? "data.texCoord1 = input.texCoord1;" : ""}

  ${
    useBaseColorTexture
      ? `getBaseColorTextured(&data, uMaterial.baseColor, uBaseColorTexture, uBaseColorTextureSampler, ${tc("baseColor")}, uMaterial.baseColorTextureMatrix, ${vColorExpr});`
      : `getBaseColor(&data, uMaterial.baseColor, ${vColorExpr});`
  }

  ${alphaBlock()}

  let frontFacingSign = select(-1.0, 1.0, frontFacing);
  let normal = input.normalView * frontFacingSign;

  output.color = vec4f(normal * 0.5 + 0.5, 1.0);

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
