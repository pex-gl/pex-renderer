import { chunks as SHADERS } from "pex-shaders";

import type { FeatureField } from "../systems/renderer/base.js";
import {
  bindingDeclaration,
  createBindingAllocator,
  frameStruct,
  getTexCoordGetter,
  modelStruct,
  textureMatrixField,
  textureSamplerDeclaration,
  vertexInputStruct,
  vertexOutputStruct,
  vertexTransform,
  getDefineFlags,
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
  skin: "USE_SKIN",
} as const;

const MATERIAL_DEFINE = {
  alphaTest: "USE_ALPHA_TEST",
  baseColorTexture: "USE_BASE_COLOR_TEXTURE",
  alphaTexture: "USE_ALPHA_TEXTURE",
} as const;

export const DEPTH_PASS_VERTEX_FIELDS: readonly FeatureField[] = [
  { key: "texCoord0", define: VERTEX_DEFINE.texCoord0 },
  { key: "offset", define: VERTEX_DEFINE.instancedOffset },
  { key: "scale", define: VERTEX_DEFINE.instancedScale },
  { key: "rotation", define: VERTEX_DEFINE.instancedRotation },
  { key: "joint", define: VERTEX_DEFINE.skin },
  { key: "weight", define: VERTEX_DEFINE.skin },
];

/**
 * Geometry attributes only an alpha test reads. Kept out of
 * {@link DEPTH_PASS_VERTEX_FIELDS} so an opaque shadow caster that happens to
 * carry vertex colors or a second UV set doesn't get its own pipeline variant
 * emitting identical WGSL.
 */
export const DEPTH_PASS_ALPHA_VERTEX_FIELDS: readonly FeatureField[] = [
  { key: "texCoord1", define: VERTEX_DEFINE.texCoord1 },
  { key: "vertexColor", define: VERTEX_DEFINE.vertexColor },
  { key: "instanceColor", define: VERTEX_DEFINE.instancedColor },
];

/**
 * Material state the alpha test needs, and nothing else. It mirrors every term
 * the main pass folds into `data.opacity` — base color alpha, its texture,
 * KHR_materials_alpha's separate map, vertex/instance color — because the two
 * have to agree exactly: a fragment kept here and discarded there leaves depth
 * in front of nothing to shade.
 */
export const DEPTH_PASS_MATERIAL_FIELDS: readonly FeatureField[] = [
  {
    key: "alphaTest",
    define: MATERIAL_DEFINE.alphaTest,
    wgslType: "f32",
    default: 0,
  },
  {
    key: "baseColor",
    wgslType: "vec4f",
    default: [1, 1, 1, 1],
    requires: MATERIAL_DEFINE.alphaTest,
  },
  {
    key: "baseColorTexture",
    define: MATERIAL_DEFINE.baseColorTexture,
    texture: true,
    requires: MATERIAL_DEFINE.alphaTest,
  },
  {
    key: "alphaTexture",
    define: MATERIAL_DEFINE.alphaTexture,
    texture: true,
    requires: MATERIAL_DEFINE.alphaTest,
  },
];

/**
 * Geometry-only pass: write clip-space depth into the depth attachment, with no
 * fragment stage or color output unless one of the variants below asks for one.
 * Shared by shadow maps and the depth pre-pass, which differ only in what they
 * do with the fragment.
 *
 * USE_NORMAL_OUTPUT is the pre-pass variant: a fragment stage writes the
 * view-space normal to location 0 alongside the depth it already produces, so
 * anything needing geometry before shading (ambient occlusion as a lighting
 * input) has both.
 *
 * USE_LINEAR_DEPTH switches to omni (point) shadows: a fragment stage overrides
 * the depth attachment with the normalized radial distance from the light
 * (length(viewPosition) / far). Radial distance is continuous across all six
 * cube faces, so there is no perspective-depth seam or near-plane precision
 * bunching. Because frag_depth is written explicitly, rasterizer depth bias no
 * longer applies — bias is done in the light shader's compare instead.
 *
 * USE_ALPHA_TEST adds the fragment stage's other job: recompute opacity the way
 * the main pass does and discard below the threshold. It composes with either
 * variant above, and is the only reason this pass binds material state at all.
 *
 * The displacement offset is stretched 1.3x relative to standard.js's to reduce
 * acne/peter-panning from displaced surfaces.
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
  // A normal target with no normals to put in it still has to be written, so
  // the attachment and the real normal are two separate conditions.
  const useNormalOutput = defines.has("USE_NORMAL_OUTPUT");
  const writeNormal = useNormalOutput && useNormals;

  const useAlphaTest = defines.has(MATERIAL_DEFINE.alphaTest);
  const materialFlags = getDefineFlags(MATERIAL_DEFINE, defines);
  const useBaseColorTexture = useAlphaTest && materialFlags.baseColorTexture;
  const useAlphaTexture = useAlphaTest && materialFlags.alphaTexture;
  const useColor =
    useAlphaTest && (vertexFlags.vertexColor || vertexFlags.instancedColor);

  const tc = getTexCoordGetter(options.texCoords ?? {});
  // Only the sets the opacity terms actually sample are carried through, so a
  // second UV set on the geometry costs nothing unless something reads it.
  const texCoordSets = new Set<number>();
  if (useBaseColorTexture) texCoordSets.add(tc("baseColor"));
  if (useAlphaTexture) texCoordSets.add(tc("alpha"));

  const materialBindings = createBindingAllocator(1);
  const baseColorTextureBinding = useBaseColorTexture
    ? materialBindings.nextTextureSampler()
    : null;
  const alphaTextureBinding = useAlphaTexture
    ? materialBindings.nextTextureSampler()
    : null;

  const sampleAlpha = (
    key: string,
    varName: string,
    binding: typeof baseColorTextureBinding,
    channel: string,
  ) =>
    binding
      ? `opacity *= textureSample(${varName}, ${varName}Sampler, (uMaterial.${key}TextureMatrix * vec3f(input.texCoord${tc(key)}, 1.0)).xy).${channel};`
      : "";

  return /* wgsl */ `
${frameStruct({ extraFields: useLinearDepth ? "far: f32," : "" })}
${
  useAlphaTest
    ? `struct Material {
  baseColor: vec4f,
  ${textureMatrixField("baseColorTexture", baseColorTextureBinding)}
  ${textureMatrixField("alphaTexture", alphaTextureBinding)}
  alphaTest: f32,
}
${bindingDeclaration(2, 0, "uMaterial", "Material", "uniform")}
${textureSamplerDeclaration(2, baseColorTextureBinding, "uBaseColorTexture")}
${textureSamplerDeclaration(2, alphaTextureBinding, "uAlphaTexture")}`
    : ""
}

${modelStruct({
  displacementTexture: useDisplacementTexture,
  skin: useSkin,
  maxJoints,
})}

${vertexInputStruct({
  normal: useNormals,
  texCoord0: vertexFlags.texCoord0 || useDisplacementTexture,
  texCoord1: texCoordSets.has(1),
  vertexColor: useColor && vertexFlags.vertexColor,
  instancedOffset: vertexFlags.instancedOffset,
  instancedScale: vertexFlags.instancedScale,
  instancedRotation: vertexFlags.instancedRotation,
  instancedColor: useColor && vertexFlags.instancedColor,
  skin: useSkin,
})}

${vertexOutputStruct([
  useLinearDepth && { name: "viewPosition", type: "vec3f" },
  writeNormal && { name: "normalView", type: "vec3f" },
  texCoordSets.has(0) && { name: "texCoord0", type: "vec2f" },
  texCoordSets.has(1) && { name: "texCoord1", type: "vec2f" },
  useColor && { name: "color", type: "vec4f" },
])}

${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  // Declared up front: vertexTransform writes output.normalView itself when it
  // is transforming normals.
  var output: VertexOutput;
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
    transformNormal: writeNormal,
  })}

  ${hooks.vertEnd ?? ""}

  let viewPosition = uFrame.viewMatrix * positionWorld;
  output.position = uFrame.projectionMatrix * viewPosition;
  ${useLinearDepth ? "output.viewPosition = viewPosition.xyz;" : ""}
  ${texCoordSets.has(0) ? "output.texCoord0 = input.texCoord0;" : ""}
  ${texCoordSets.has(1) ? "output.texCoord1 = input.texCoord1;" : ""}
  ${
    useColor
      ? vertexFlags.vertexColor && vertexFlags.instancedColor
        ? "output.color = input.vertexColor * input.instanceColor;"
        : vertexFlags.vertexColor
          ? "output.color = input.vertexColor;"
          : "output.color = input.instanceColor;"
      : ""
  }
  return output;
}
${(() => {
  // The three fragment jobs are independent: discard below the alpha cutoff,
  // override depth with radial distance (omni shadows), write the view-space
  // normal (pre-pass). Only the last two produce a value, and they never
  // co-occur, so the stage is assembled rather than written out per variant.
  const discardBlock = useAlphaTest
    ? `var opacity = uMaterial.baseColor.w;
  ${useColor ? "opacity *= input.color.w;" : ""}
  ${sampleAlpha("baseColor", "uBaseColorTexture", baseColorTextureBinding, "w")}
  ${sampleAlpha("alpha", "uAlphaTexture", alphaTextureBinding, "x")}
  if (opacity < uMaterial.alphaTest) {
    discard;
  }`
    : "";

  if (useLinearDepth) {
    // The shadow pass view origin is the light, so |viewPosition| is the radial
    // distance from the light; normalize to [0, 1] to store in a depth texture.
    return `@fragment
fn fragmentMain(input: VertexOutput) -> @builtin(frag_depth) f32 {
  ${discardBlock}
  return length(input.viewPosition) / uFrame.far;
}`;
  }

  if (useNormalOutput) {
    // Same encoding the main pass uses for its normal target, so a reader
    // cannot tell which pass produced it.
    return `@fragment
fn fragmentMain(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {
  ${discardBlock}
  ${
    writeNormal
      ? `let frontFacingSign = select(-1.0, 1.0, frontFacing);
  let normalView = normalize(input.normalView) * frontFacingSign;`
      : "let normalView = vec3f(0.0, 0.0, 1.0);"
  }
  return vec4f(normalView * 0.5 + 0.5, 1.0);
}`;
  }

  // Depth comes out of the rasterizer; the stage exists only to reject.
  return useAlphaTest
    ? `@fragment
fn fragmentMain(input: VertexOutput) {
  ${discardBlock}
}`
    : "";
})()}
`;
};
