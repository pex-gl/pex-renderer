import { chunks as SHADERS } from "pex-shaders";

// See depth-pass.js: same vertex-stage conventions (including the 1.3x
// displacement stretch), but this pass outputs the front-facing-corrected
// view-space normal instead of packed depth.

/**
 * @param {Set<string>} [defines=new Set()]
 * @param {object} [options={}]
 * @param {object} [options.hooks={}] Raw WGSL text injected at fixed points.
 * @param {number} [options.maxJoints=256] Size of the skinning joint matrix array.
 * @param {object} [options.texCoords={}] Per-texture texture coordinate set index (0 or 1), e.g. { alpha: 1 }.
 * @returns {string}
 * @alias module:pipeline.depthPrePass
 */
export default (defines = new Set(), options = {}) => {
  const hooks = options.hooks || {};
  const { maxJoints = 256 } = options;
  const texCoords = options.texCoords || {};

  const tc = (key) => texCoords[key] ?? 0;

  const useNormals = defines.has("USE_NORMALS");
  const useTexCoord0 = defines.has("USE_TEXCOORD_0");
  const useTexCoord1 = defines.has("USE_TEXCOORD_1");
  const useInstancedOffset = defines.has("USE_INSTANCED_OFFSET");
  const useInstancedScale = defines.has("USE_INSTANCED_SCALE");
  const useInstancedRotation = defines.has("USE_INSTANCED_ROTATION");
  const useInstancedColor = defines.has("USE_INSTANCED_COLOR");
  const useVertexColors = defines.has("USE_VERTEX_COLORS");
  const useColor = useVertexColors || useInstancedColor;
  const useDisplacementTexture = defines.has("USE_DISPLACEMENT_TEXTURE");
  const useSkin = defines.has("USE_SKIN");
  const useBaseColorTexture = defines.has("USE_BASE_COLOR_TEXTURE");
  const useAlphaTexture = defines.has("USE_ALPHA_TEXTURE");
  const useAlphaTest = defines.has("USE_ALPHA_TEST");

  const colorAssignment = useVertexColors && useInstancedColor
    ? "output.color = input.vertexColor * input.instanceColor;"
    : useInstancedColor
      ? "output.color = input.instanceColor;"
      : useVertexColors
        ? "output.color = input.vertexColor;"
        : "";

  const vColorExpr = useColor ? "input.color" : "vec4f(1.0)";

  // ---- @group(2) Material: binding numbers (0 is the Material uniform struct itself) ----
  let nextMaterialBinding = 1;
  const bindMaterialTexture = () => ({ tex: nextMaterialBinding++, samp: nextMaterialBinding++ });
  const matrixField = (name, binding) => (binding ? `${name}TextureMatrix: mat3x3f,` : "");
  const textureDecl = (varName, binding, kind = "texture_2d<f32>") =>
    binding
      ? `@group(2) @binding(${binding.tex}) var ${varName}: ${kind};\n@group(2) @binding(${binding.samp}) var ${varName}Sampler: sampler;`
      : "";

  const baseColorTex = useBaseColorTexture ? bindMaterialTexture() : null;
  const alphaTex = useAlphaTexture ? bindMaterialTexture() : null;

  const alphaBlock = () => {
    if (!useAlphaTexture && !useAlphaTest) return "";
    return /* wgsl */ `
  ${useAlphaTexture
    ? `let alphaTexCoord = getTextureCoordinatesTransformed(data, ${tc("alpha")}, uMaterial.alphaTextureMatrix);\n  data.opacity *= textureSample(uAlphaTexture, uAlphaTextureSampler, alphaTexCoord).x;`
    : ""}
  ${useAlphaTest ? "alphaTest(&data, uMaterial.alphaTest);" : ""}`;
  };

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
  ${useDisplacementTexture ? "displacement: f32," : ""}
}
@group(3) @binding(0) var<uniform> uModel: Model;
${useSkin ? `@group(3) @binding(1) var<uniform> uJointMatrices: array<mat4x4f, ${maxJoints}>;` : ""}
${useDisplacementTexture ? "@group(3) @binding(2) var uDisplacementTexture: texture_2d<f32>;\n@group(3) @binding(3) var uDisplacementTextureSampler: sampler;" : ""}

struct Material {
  baseColor: vec4f,
  ${matrixField("baseColor", baseColorTex)}
  ${matrixField("alpha", alphaTex)}
  ${useAlphaTest ? "alphaTest: f32," : ""}
}
@group(2) @binding(0) var<uniform> uMaterial: Material;
${textureDecl("uBaseColorTexture", baseColorTex)}
${textureDecl("uAlphaTexture", alphaTex)}

struct VertexInput {
  @location(0) position: vec3f,
  ${useNormals ? "@location(1) normal: vec3f," : ""}
  ${useTexCoord0 || useDisplacementTexture ? "@location(3) texCoord0: vec2f," : ""}
  ${useTexCoord1 ? "@location(4) texCoord1: vec2f," : ""}
  ${useVertexColors ? "@location(5) vertexColor: vec4f," : ""}
  ${useInstancedOffset ? "@location(6) offset: vec3f," : ""}
  ${useInstancedScale ? "@location(7) scale: vec3f," : ""}
  ${useInstancedRotation ? "@location(8) rotation: vec4f," : ""}
  ${useInstancedColor ? "@location(9) instanceColor: vec4f," : ""}
  ${useSkin ? "@location(10) joint: vec4f,\n  @location(11) weight: vec4f," : ""}
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) normalView: vec3f,
  @location(1) texCoord0: vec2f,
  ${useTexCoord1 ? "@location(2) texCoord1: vec2f," : ""}
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
override USE_TEXCOORD_1: bool = ${useTexCoord1};

// Vertex includes
${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  var position = vec4f(input.position, 1.0);
  var normal = vec3f(0.0, 0.0, 0.0);
  ${useNormals ? "normal = input.normal;" : ""}

  var texCoord = vec2f(0.0, 0.0);
  ${useTexCoord0 ? "texCoord = input.texCoord0;" : ""}
  output.texCoord0 = texCoord;

  ${useTexCoord1 ? "output.texCoord1 = input.texCoord1;" : ""}

  ${hooks.vertBeforeTransform ?? ""}

  ${useDisplacementTexture
    ? "let h = textureSampleLevel(uDisplacementTexture, uDisplacementTextureSampler, input.texCoord0, 0.0).x;\n  position = vec4f(position.xyz + uModel.displacement * h * normal * 1.3, position.w);"
    : ""}

  var positionWorld: vec4f;
  ${useSkin
    ? `let skinMat =
    input.weight.x * uJointMatrices[u32(input.joint.x)] +
    input.weight.y * uJointMatrices[u32(input.joint.y)] +
    input.weight.z * uJointMatrices[u32(input.joint.z)] +
    input.weight.w * uJointMatrices[u32(input.joint.w)];

  normal = (skinMat * vec4f(normal, 0.0)).xyz;

  positionWorld = skinMat * position;

  ${useInstancedScale ? "positionWorld = vec4f(positionWorld.xyz * input.scale, positionWorld.w);" : ""}

  ${useInstancedRotation ? "let rotationMat = quatToMat4(input.rotation);\n  positionWorld = rotationMat * positionWorld;\n  normal = (rotationMat * vec4f(normal, 0.0)).xyz;" : ""}

  ${useInstancedOffset ? "positionWorld = vec4f(positionWorld.xyz + input.offset, positionWorld.w);" : ""}

  output.normalView = (uFrame.viewMatrix * vec4f(normal, 0.0)).xyz;`
    : `${useInstancedScale ? "position = vec4f(position.xyz * input.scale, position.w);\n  " : ""}${useInstancedRotation ? "let rotationMat = quatToMat4(input.rotation);\n  position = rotationMat * position;\n  normal = (rotationMat * vec4f(normal, 0.0)).xyz;\n  " : ""}${useInstancedOffset ? "position = vec4f(position.xyz + input.offset, position.w);\n  " : ""}
  positionWorld = uModel.modelMatrix * position;
  output.normalView = uModel.normalMatrix * normal;`}

  ${colorAssignment}

  let positionView = uFrame.viewMatrix * positionWorld;
  let positionOut = uFrame.projectionMatrix * positionView;

  output.positionView = positionView.xyz;
  output.position = positionOut;

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.encodeDecode}
${SHADERS.textureCoordinates}
${SHADERS.baseColor}
${SHADERS.alpha}

${hooks.fragDeclarationsEnd ?? ""}

struct FragmentOutput {
  @location(0) color: vec4f,
}

@fragment
fn fragmentMain(input: Varyings, @builtin(front_facing) frontFacing: bool) -> FragmentOutput {
  var output: FragmentOutput;

  var data: PBRData;
  data.texCoord0 = input.texCoord0;
  ${useTexCoord1 ? "data.texCoord1 = input.texCoord1;" : ""}

  ${useBaseColorTexture
    ? `getBaseColorTextured(&data, uMaterial.baseColor, uBaseColorTexture, uBaseColorTextureSampler, ${tc("baseColor")}, uMaterial.baseColorTextureMatrix, ${vColorExpr});`
    : `getBaseColor(&data, uMaterial.baseColor, ${vColorExpr});`}

  ${alphaBlock()}

  let frontFacingSign = select(-1.0, 1.0, frontFacing);
  let normal = input.normalView * frontFacingSign;

  output.color = vec4f(normal * 0.5 + 0.5, 1.0);

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
