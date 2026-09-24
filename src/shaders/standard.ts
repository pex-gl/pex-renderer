import { shaders as SHADERS } from "pex-shaders";

import { getRuntimeDefines, isFieldActive } from "../systems/renderer/base.js";
import {
  bindingDeclaration,
  createBindingAllocator,
  fragmentOutputStruct,
  sceneOutputMembers,
  frameStruct,
  modelStruct,
  textureMatrixField,
  textureSamplerDeclaration,
  samplerName,
  uniformName,
  getTexCoordGetter,
  getDefineFlags,
  vertexOutputStruct,
  vertexInputStruct,
  vertexTransform,
  vertexJitter,
  vertexVelocity,
  vertexPreviousWorld,
  VELOCITY_MEMBERS,
  FRAGMENT_VELOCITY,
  hookMembers,
  hookBindingsDeclaration,
} from "./wgsl.js";
import { ROUGHNESS_LEVELS, SH_COEFFICIENT_COUNT } from "./reflection-probe.js";
import { LIGHT_STRUCTS } from "./light.js";
import type { LightType } from "./light.js";
import type { FeatureField } from "../systems/renderer/base.js";
import type { MaterialTextureBinding } from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

const MATERIAL_DEFINE = {
  unlitWorkflow: "USE_UNLIT_WORKFLOW",
  metallicRoughnessWorkflow: "USE_METALLIC_ROUGHNESS_WORKFLOW",
  specularGlossinessWorkflow: "USE_SPECULAR_GLOSSINESS_WORKFLOW",
  alphaCutoff: "USE_ALPHA_CUTOFF",
  responsiveAA: "USE_RESPONSIVE_AA",
  emissive: "USE_EMISSIVE",
  specular: "USE_SPECULAR",
  clearcoat: "USE_CLEARCOAT",
  clearcoatRoughnessFromMainTexture:
    "USE_CLEARCOAT_ROUGHNESS_FROM_MAIN_TEXTURE",
  sheen: "USE_SHEEN",
  sheenRoughnessFromMainTexture: "USE_SHEEN_ROUGHNESS_FROM_MAIN_TEXTURE",
  transmission: "USE_TRANSMISSION",
  dispersion: "USE_DISPERSION",
  volume: "USE_VOLUME",
  diffuseTransmission: "USE_DIFFUSE_TRANSMISSION",

  baseColorTexture: "USE_BASE_COLOR_TEXTURE",
  alphaTexture: "USE_ALPHA_TEXTURE",
  emissiveTexture: "USE_EMISSIVE_TEXTURE",
  normalTexture: "USE_NORMAL_TEXTURE",
  metallicRoughnessTexture: "USE_METALLIC_ROUGHNESS_TEXTURE",
  metallicTexture: "USE_METALLIC_TEXTURE",
  roughnessTexture: "USE_ROUGHNESS_TEXTURE",
  specularTexture: "USE_SPECULAR_TEXTURE",
  specularColorTexture: "USE_SPECULAR_COLOR_TEXTURE",
  sgDiffuseTexture: "USE_SG_DIFFUSE_TEXTURE",
  sgSpecularGlossinessTexture: "USE_SG_SPECULAR_GLOSSINESS_TEXTURE",
  clearcoatTexture: "USE_CLEARCOAT_TEXTURE",
  clearcoatRoughnessTexture: "USE_CLEARCOAT_ROUGHNESS_TEXTURE",
  clearcoatNormalTexture: "USE_CLEARCOAT_NORMAL_TEXTURE",
  sheenColorTexture: "USE_SHEEN_COLOR_TEXTURE",
  sheenRoughnessTexture: "USE_SHEEN_ROUGHNESS_TEXTURE",
  transmissionTexture: "USE_TRANSMISSION_TEXTURE",
  thicknessTexture: "USE_THICKNESS_TEXTURE",
  diffuseTransmissionTexture: "USE_DIFFUSE_TRANSMISSION_TEXTURE",
  diffuseTransmissionColorTexture: "USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE",
  occlusionTexture: "USE_OCCLUSION_TEXTURE",
} as const;

const VERTEX_DEFINE = {
  tangent: "USE_TANGENTS",
  texCoord0: "USE_TEXCOORD_0",
  texCoord1: "USE_TEXCOORD_1",
  vertexColor: "USE_VERTEX_COLORS",
  instancedOffset: "USE_INSTANCED_OFFSET",
  instancedScale: "USE_INSTANCED_SCALE",
  instancedRotation: "USE_INSTANCED_ROTATION",
  instancedColor: "USE_INSTANCED_COLOR",
  skin: "USE_SKIN",
  previousPosition: "USE_PREVIOUS_POSITION",
  previousInstancedOffset: "USE_PREVIOUS_INSTANCED_OFFSET",
  previousInstancedScale: "USE_PREVIOUS_INSTANCED_SCALE",
  previousInstancedRotation: "USE_PREVIOUS_INSTANCED_ROTATION",
} as const;

// prettier-ignore
export const STANDARD_MATERIAL_COMMON_FIELDS: readonly FeatureField[] = [
  { key: "baseColorTexture", define: MATERIAL_DEFINE.baseColorTexture, texture: true },
  { key: "alphaTexture", define: MATERIAL_DEFINE.alphaTexture, texture: true },
  { key: "alphaCutoff", define: MATERIAL_DEFINE.alphaCutoff, wgslType: "f32", default: 0, runtime: true },
  { key: "responsiveAA", define: MATERIAL_DEFINE.responsiveAA, truthy: true },
];

// Order here is significant (a field's requires/excludes can only see
// defines added earlier in the same pass).
// prettier-ignore
export const STANDARD_MATERIAL_LIT_FIELDS: readonly FeatureField[] = [
  { key: "normalTexture", define: MATERIAL_DEFINE.normalTexture, texture: true },
  { key: "normalTextureScale", requires: MATERIAL_DEFINE.normalTexture, wgslType: "f32", default: 1 },

  // Specular-glossiness workflow.
  { key: "sgDiffuseTexture", requires: MATERIAL_DEFINE.specularGlossinessWorkflow, define: MATERIAL_DEFINE.sgDiffuseTexture, texture: true },
  { key: "sgSpecularGlossinessTexture", requires: MATERIAL_DEFINE.specularGlossinessWorkflow, define: MATERIAL_DEFINE.sgSpecularGlossinessTexture, texture: true },
  { key: "sgDiffuse", requires: MATERIAL_DEFINE.specularGlossinessWorkflow, wgslType: "vec4f", default: [1, 1, 1, 1] },
  { key: "sgSpecular", requires: MATERIAL_DEFINE.specularGlossinessWorkflow, wgslType: "vec3f", default: [1, 1, 1] },
  { key: "sgGlossiness", requires: MATERIAL_DEFINE.specularGlossinessWorkflow, wgslType: "f32", default: 1 },

  // Metallic-roughness workflow.
  { key: "metallicRoughnessTexture", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, define: MATERIAL_DEFINE.metallicRoughnessTexture, texture: true },
  { key: "metallicTexture", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, excludes: MATERIAL_DEFINE.metallicRoughnessTexture, define: MATERIAL_DEFINE.metallicTexture, texture: true },
  { key: "roughnessTexture", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, excludes: MATERIAL_DEFINE.metallicRoughnessTexture, define: MATERIAL_DEFINE.roughnessTexture, texture: true },
  { key: "metallic", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, wgslType: "f32", default: 1 },
  { key: "roughness", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, wgslType: "f32", default: 1 },
  { key: "ior", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, wgslType: "f32", default: 1.5 },

  // OR-activated by either field sharing MATERIAL_DEFINE.specular.
  // `runtime: true` here (unlike clearcoat/sheen/etc.) still respects its
  // `requires` — metallicRoughnessWorkflow is a genuinely structural gate,
  // not an internal group link, so getFeatureFlags keeps enforcing it (see
  // the runtimeDefines check in base.ts).
  { key: "specular", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, define: MATERIAL_DEFINE.specular, wgslType: "f32", default: 1, runtime: true },
  { key: "specularColor", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, define: MATERIAL_DEFINE.specular, wgslType: "vec3f", default: [1, 1, 1], runtime: true },
  { key: "specularTexture", requires: MATERIAL_DEFINE.specular, define: MATERIAL_DEFINE.specularTexture, texture: true },
  { key: "specularColorTexture", requires: MATERIAL_DEFINE.specular, define: MATERIAL_DEFINE.specularColorTexture, texture: true },

  // `runtime: true` (also below for sheen/transmission/dispersion/volume/
  // diffuseTransmission): the scalar factor is always in the Material struct
  // and the shader body always evaluates the effect, gated by a same-named
  // `override` constant instead of by string presence — materials that differ
  // only by one of these effects being on/off then share one compiled shader
  // module (see FeatureField.runtime).
  { key: "clearcoat", define: MATERIAL_DEFINE.clearcoat, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "clearcoatRoughness", requires: MATERIAL_DEFINE.clearcoat, wgslType: "f32", default: 0, runtime: true },
  { key: "clearcoatTexture", requires: MATERIAL_DEFINE.clearcoat, define: MATERIAL_DEFINE.clearcoatTexture, texture: true },
  { key: "clearcoatRoughnessTexture", requires: MATERIAL_DEFINE.clearcoat, define: MATERIAL_DEFINE.clearcoatRoughnessTexture, texture: true },
  // No dedicated roughness texture: packed into the clearcoat texture's g channel.
  { key: "clearcoatTexture", requires: MATERIAL_DEFINE.clearcoat, excludes: MATERIAL_DEFINE.clearcoatRoughnessTexture, define: MATERIAL_DEFINE.clearcoatRoughnessFromMainTexture },
  { key: "clearcoatNormalTexture", requires: MATERIAL_DEFINE.clearcoat, define: MATERIAL_DEFINE.clearcoatNormalTexture, texture: true },
  { key: "clearcoatNormalTextureScale", requires: MATERIAL_DEFINE.clearcoatNormalTexture, wgslType: "f32", default: 1 },

  { key: "sheenColor", define: MATERIAL_DEFINE.sheen, wgslType: "vec4f", default: [0, 0, 0, 0], runtime: true },
  { key: "sheenRoughness", requires: MATERIAL_DEFINE.sheen, wgslType: "f32", default: 0, runtime: true },
  { key: "sheenColorTexture", requires: MATERIAL_DEFINE.sheen, define: MATERIAL_DEFINE.sheenColorTexture, texture: true },
  { key: "sheenRoughnessTexture", requires: MATERIAL_DEFINE.sheen, define: MATERIAL_DEFINE.sheenRoughnessTexture, texture: true },
  // No dedicated roughness texture: packed into the sheenColor texture's alpha.
  { key: "sheenColorTexture", requires: MATERIAL_DEFINE.sheen, excludes: MATERIAL_DEFINE.sheenRoughnessTexture, define: MATERIAL_DEFINE.sheenRoughnessFromMainTexture },

  // transmission: 0 behaves like unset.
  { key: "transmission", define: MATERIAL_DEFINE.transmission, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "transmissionTexture", requires: MATERIAL_DEFINE.transmission, define: MATERIAL_DEFINE.transmissionTexture, texture: true },
  { key: "dispersion", requires: MATERIAL_DEFINE.transmission, define: MATERIAL_DEFINE.dispersion, truthy: true, wgslType: "f32", default: 0, runtime: true },

  { key: "diffuseTransmission", define: MATERIAL_DEFINE.diffuseTransmission, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "diffuseTransmissionColor", requires: MATERIAL_DEFINE.diffuseTransmission, wgslType: "vec3f", default: [1, 1, 1], runtime: true },
  { key: "diffuseTransmissionTexture", requires: MATERIAL_DEFINE.diffuseTransmission, define: MATERIAL_DEFINE.diffuseTransmissionTexture, texture: true },
  { key: "diffuseTransmissionColorTexture", requires: MATERIAL_DEFINE.diffuseTransmission, define: MATERIAL_DEFINE.diffuseTransmissionColorTexture, texture: true },

  // Shared by transmission and diffuse transmission (Beer's law attenuation).
  { key: "thickness", define: MATERIAL_DEFINE.volume, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "attenuationColor", requires: MATERIAL_DEFINE.volume, wgslType: "vec3f", default: [1, 1, 1], runtime: true },
  { key: "attenuationDistance", requires: MATERIAL_DEFINE.volume, wgslType: "f32", default: Infinity, runtime: true },
  { key: "thicknessTexture", requires: MATERIAL_DEFINE.volume, define: MATERIAL_DEFINE.thicknessTexture, texture: true },

  { key: "occlusionTexture", define: MATERIAL_DEFINE.occlusionTexture, texture: true },
  { key: "occlusionTextureStrength", requires: MATERIAL_DEFINE.occlusionTexture, wgslType: "f32", default: 1 },
  // emissiveTexture is independent of emissive: the shader select()s a neutral
  // (1.0) factor when emissive isn't set and a texture is present, or a zeroed
  // one when there's no texture either — see the litBody template.
  { key: "emissive", define: MATERIAL_DEFINE.emissive, wgslType: "vec4f", default: [0, 0, 0, 0], runtime: true },
  { key: "emissiveStrength", requires: MATERIAL_DEFINE.emissive, wgslType: "f32", default: 1, runtime: true },
  { key: "emissiveExposure", requires: MATERIAL_DEFINE.emissive, wgslType: "f32", default: 0, runtime: true },
  { key: "emissiveTexture", define: MATERIAL_DEFINE.emissiveTexture, texture: true },
];

export const STANDARD_MATERIAL_FIELDS: readonly FeatureField[] = [
  ...STANDARD_MATERIAL_COMMON_FIELDS,
  ...STANDARD_MATERIAL_LIT_FIELDS,
];

// Precomputed once: which defines are owned by a `runtime` field's own
// activation, needed by isFieldActive() below to re-derive "is this field
// declared" the same way getFeatureFlags does.
const MATERIAL_RUNTIME_DEFINES = getRuntimeDefines(STANDARD_MATERIAL_FIELDS);

export const STANDARD_VERTEX_FIELDS: readonly FeatureField[] = [
  { key: "tangent", define: VERTEX_DEFINE.tangent },
  { key: "texCoord0", define: VERTEX_DEFINE.texCoord0 },
  { key: "texCoord1", define: VERTEX_DEFINE.texCoord1 },
  { key: "vertexColor", define: VERTEX_DEFINE.vertexColor },
  { key: "offset", define: VERTEX_DEFINE.instancedOffset },
  { key: "scale", define: VERTEX_DEFINE.instancedScale },
  { key: "rotation", define: VERTEX_DEFINE.instancedRotation },
  { key: "color", define: VERTEX_DEFINE.instancedColor },
  { key: "joint", define: VERTEX_DEFINE.skin },
  { key: "weight", define: VERTEX_DEFINE.skin },
  // Present only once the geometry system has seen the attribute change, which
  // is what makes a deforming surface differ from a static one.
  { key: "previousPosition", define: VERTEX_DEFINE.previousPosition },
  { key: "previousOffset", define: VERTEX_DEFINE.previousInstancedOffset },
  { key: "previousScale", define: VERTEX_DEFINE.previousInstancedScale },
  { key: "previousRotation", define: VERTEX_DEFINE.previousInstancedRotation },
];

export const STANDARD_WORKFLOW = {
  unlit: MATERIAL_DEFINE.unlitWorkflow,
  metallicRoughness: MATERIAL_DEFINE.metallicRoughnessWorkflow,
  specularGlossiness: MATERIAL_DEFINE.specularGlossinessWorkflow,
} as const;

/**
 * The surface description every hook, chunk and debug view reads. Module level
 * so `PBR_DATA_TYPES` derives from the same text the shader compiles.
 */
const PBR_DATA_STRUCT = /* wgsl */ `struct PBRData {
  inverseViewMatrix: mat4x4f,
  texCoord0: vec2f,
  texCoord1: vec2f,
  normalView: vec3f,
  tangentView: vec4f,
  positionWorld: vec3f,
  positionView: vec3f,
  eyeDirView: vec3f,
  eyeDirWorld: vec3f,
  normalWorld: vec3f, // N, world space
  bentNormalWorld: vec3f, // average unoccluded direction, world space; N without one
  viewWorld: vec3f, // V, view vector from position to camera, world space
  NdotV: f32,

  baseColor: vec3f,
  emissive: vec3f,
  opacity: f32,
  roughness: f32, // roughness value, as authored by the model creator (input to shader)
  metallic: f32, // metallic value at the surface
  linearRoughness: f32, // roughness mapped to a more linear change in the roughness (proposed by [2])
  f0: vec3f, // Reflectance at normal incidence, specular color
  f90: vec3f, // Specular response at grazing incidence
  clearcoat: f32,
  clearcoatRoughness: f32,
  clearcoatLinearRoughness: f32,
  clearcoatNormal: vec3f,
  reflectionWorld: vec3f,
  directColor: vec3f,
  diffuseColor: vec3f, // color contribution from diffuse lighting
  indirectDiffuse: vec3f, // contribution from IBL light probe and Ambient Light
  indirectSpecular: vec3f, // contribution from IBL light probe
  sheenColor: vec3f,
  sheenRoughness: f32,
  sheenLinearRoughness: f32,
  sheenAlbedoScaling: f32,
  transmitted: vec3f,
  transmission: f32,
  diffuseTransmission: f32,
  diffuseTransmissionColor: vec3f,
  diffuseTransmissionThickness: f32,
  thickness: f32,
  attenuationColor: vec3f,
  attenuationDistance: f32,
  dispersion: f32,
  ior: f32,
  ao: f32,
}
`;

/** PBRData member name to WGSL type, for typing a `debugRender` expression. */
const PBR_DATA_TYPES: Record<string, string> = Object.fromEntries(
  [...PBR_DATA_STRUCT.matchAll(/^\s+(\w+): (\w+),/gm)].map((match) => [
    match[1]!,
    match[2]!,
  ]),
);

/**
 * A debug expression as a colour written over the shaded result.
 *
 * Named PBRData members are coerced by their declared type — a scalar splats, a
 * vec2 pads, a vec4 drops its alpha — and anything else is left to `vec3f()`,
 * which covers a vec3 inter-stage variable and a scalar alike. Direction-valued
 * members are remapped from [-1, 1], the only transform that would otherwise
 * clip to black.
 *
 * The value is written linear and pre-tone-map, so it reads exactly only with
 * post-processing off; through a tone curve it is still ordered, just
 * compressed.
 */
function debugRenderAssignment(expression: string): string {
  const member = expression.startsWith("data.")
    ? PBR_DATA_TYPES[expression.slice("data.".length)]
    : undefined;
  const value =
    member === "vec2f"
      ? `vec3f(${expression}, 0.0)`
      : member === "vec4f"
        ? `${expression}.xyz`
        : `vec3f(${expression})`;
  const signed = /normal|tangent|reflection/i.test(expression);

  return `output.color = vec4f(${signed ? `${value} * 0.5 + 0.5` : value}, 1.0);`;
}

export const standardShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { maxJoints = 256 } = options;
  const outputs = options.outputs ?? {};
  const texCoords = options.texCoords || {};

  const tc = getTexCoordGetter(texCoords);

  const useNormals = defines.has("USE_NORMALS");
  const materialFlags = getDefineFlags(MATERIAL_DEFINE, defines);
  const vertexFlags = getDefineFlags(VERTEX_DEFINE, defines);
  const useColor = vertexFlags.vertexColor || vertexFlags.instancedColor;
  const useDisplacementTexture = defines.has("USE_DISPLACEMENT_TEXTURE");
  const useSkin = defines.has("USE_SKIN");
  const lit = !materialFlags.unlitWorkflow;
  const useReflectionProbes = defines.has("USE_REFLECTION_PROBES") && lit;

  // One binding per distinct shadow map size, not per light: a light is a layer.
  // The only light data left that shapes the WGSL — how many lights of which
  // type the scene holds is uniform data (see shaders/light.ts).
  const shadow2DBuckets = lit ? (options.shadow2DBuckets ?? 0) : 0;
  const shadowCubeBuckets = lit ? (options.shadowCubeBuckets ?? 0) : 0;

  const colorAssignment =
    vertexFlags.vertexColor && vertexFlags.instancedColor
      ? "output.color = input.vertexColor * input.color;"
      : vertexFlags.instancedColor
        ? "output.color = input.color;"
        : vertexFlags.vertexColor
          ? "output.color = input.vertexColor;"
          : "";

  // vColor / texCoordTransform neutral defaults, matching the chunks-phase convention:
  // decode(vec4f(1), SRGB) is exactly vec3f(1), so passing a white vColor when
  // vertex colors are unused is an exact no-op, not an approximation.
  const vColorExpr = useColor ? "input.color" : "vec4f(1.0)";

  // Material
  const materialBindings = createBindingAllocator(1);
  const textures: Record<string, MaterialTextureBinding | null> = {};
  for (const field of STANDARD_MATERIAL_FIELDS) {
    if (!field.texture) continue;
    textures[field.key] = defines.has(field.define!)
      ? materialBindings.nextTextureSampler()
      : null;
  }

  // Struct field order doesn't matter for pex-gpu's uniform packing (it
  // resolves by name, see bind-groups.ts/pack.ts) — so every active scalar
  // and texture-matrix field can be emitted from one schema-driven filter
  // instead of hand-written per-feature templates.
  const scalarStructFields = STANDARD_MATERIAL_FIELDS.filter(
    (field) =>
      !field.texture &&
      field.wgslType &&
      isFieldActive(field, MATERIAL_RUNTIME_DEFINES, defines),
  )
    .map((field) => `${field.key}: ${field.wgslType},`)
    .join("\n  ");

  const textureMatrixFields = STANDARD_MATERIAL_FIELDS.filter(
    (field) => field.texture && textures[field.key],
  )
    .map((field) => textureMatrixField(field.key, textures[field.key] ?? null))
    .join("\n  ");

  // Lights
  const lightBindings = createBindingAllocator(0);

  // Every lit material declares the same lighting bindings whatever the scene
  // holds, the LTC lookup tables included — the renderer binds a dummy for
  // those until an area light asks for them. Gating any of it on what is in
  // the scene would make adding a light regenerate and recompile the WGSL of
  // every material, synchronously, mid-frame.
  const lightsDecl = lit
    ? /* wgsl */ `
${bindingDeclaration(1, lightBindings.next(), "uLights", "array<SceneLight>", "storage, read")}
${bindingDeclaration(1, lightBindings.next(), "uLightRanges", "LightRanges", "uniform")}
${textureSamplerDeclaration(1, lightBindings.nextTextureSampler(), "uLtc1")}
${textureSamplerDeclaration(1, lightBindings.nextTextureSampler(), "uLtc2")}`
    : "";

  // 2D shadow maps use a comparison sampler (hardware PCF); cube maps use a
  // regular sampler and compare manually (textureLoad is unavailable on cubes).
  const shadowBucketName = (cube: boolean, i: number) =>
    uniformName(`shadowMaps${cube ? "Cube" : "2D"}${i}`);

  const shadowBucketDecls = (count: number, cube: boolean) =>
    Array.from({ length: count }, (_, i) =>
      textureSamplerDeclaration(
        1,
        lightBindings.nextTextureSampler(),
        shadowBucketName(cube, i),
        cube ? "texture_depth_cube_array" : "texture_depth_2d_array",
        cube ? "sampler" : "sampler_comparison",
      ),
    ).join("\n");

  const shadow2DDecls = shadowBucketDecls(shadow2DBuckets, false);
  const shadowCubeDecls = shadowBucketDecls(shadowCubeBuckets, true);

  /**
   * Which binding a light samples is runtime data — the size it asked for — so
   * the bucket is dispatched rather than baked per light. Collapses to a single
   * call whenever every light shares a size, which is the usual case.
   */
  const shadowDispatch = (
    count: number,
    cube: boolean,
    name: string,
    signature: string,
    args: string,
    callee: string,
  ) => /* wgsl */ `
fn ${name}(bucket: u32, layer: u32, ${signature}) -> f32 {
${
  count === 0
    ? "  return 1.0;"
    : Array.from(
        { length: count },
        (_, i) =>
          `  if (bucket == ${i}u) { return ${callee}(${shadowBucketName(cube, i)}, ${samplerName(shadowBucketName(cube, i))}, layer, ${args}); }`,
      ).join("\n") + "\n  return 1.0;"
}
}`;

  const shadowDispatchDecls = materialFlags.unlitWorkflow
    ? ""
    : [
        shadowDispatch(
          shadow2DBuckets,
          false,
          "sampleShadowMap2D",
          "size: vec2f, uv: vec2f, compare: f32, near: f32, far: f32, radiusUV: vec2f, dzDuv: vec2f, ortho: bool, fragCoord: vec2f",
          "size, uv, compare, near, far, radiusUV, dzDuv, ortho, fragCoord",
          "getShadow",
        ),
        shadowDispatch(
          shadowCubeBuckets,
          true,
          "sampleShadowMapCube",
          "size: vec2f, direction: vec3f, compare: f32, radius: f32, far: f32, fragCoord: vec2f",
          "size, direction, compare, radius, far, fragCoord",
          "getPunctualShadow",
        ),
      ].join("\n");

  const reflectionProbeDecl = useReflectionProbes
    ? /* wgsl */ `
struct ReflectionProbe {
  rotation: mat3x3f,
  intensity: f32,
}
${bindingDeclaration(1, lightBindings.next(), "uReflectionProbe", "ReflectionProbe", "uniform")}
${textureSamplerDeclaration(1, lightBindings.nextTextureSampler(), "uSpecularEnvMap", "texture_cube<f32>")}
${bindingDeclaration(1, lightBindings.next(), "uIrradianceCoefficients", `array<vec4f, ${SH_COEFFICIENT_COUNT}>`, "storage, read")}`
    : "";

  // uCaptureTexture (the grabbed opaque color for refraction) is declared for
  // every lit material, decoupled from the reflection probe: transmission runs
  // via EvaluateTransmission regardless of whether a probe is present. It's also
  // unconditional w.r.t. USE_TRANSMISSION (a runtime override) so transmissive
  // and non-transmissive materials share one module; the renderer binds a dummy
  // 2D texture when there's nothing to refract.
  const captureDecl = materialFlags.unlitWorkflow
    ? ""
    : textureSamplerDeclaration(
        1,
        lightBindings.nextTextureSampler(),
        "uCaptureTexture",
      );

  // Screen-space ambient occlusion computed before shading, so it can modulate
  // indirect light rather than multiply the shaded result. Declared on the same
  // terms as uCaptureTexture — always present for a lit material, with a white
  // dummy bound when there is none — so enabling it costs a pipeline constant
  // rather than a new shader module.
  const ssaoDecl = materialFlags.unlitWorkflow
    ? ""
    : textureSamplerDeclaration(
        1,
        lightBindings.nextTextureSampler(),
        "uAOTexture",
      );

  // One loop per type over its slice of the shared buffer, scoped so the five
  // ranges don't collide. A type the scene has none of has a count of 0.
  const lightsLoop = (type: LightType, call: string) => /* wgsl */ `{
    let range = uLightRanges.${type};
    for (var i = range.offset; i < range.offset + range.count; i++) {
      ${call}
    }
  }`;

  const ambientLightsBlock = lightsLoop(
    "ambient",
    "EvaluateAmbientLight(&data, uLights[i], data.ao);",
  );
  const directionalLightsBlock = lightsLoop(
    "directional",
    "EvaluateDirectionalLight(&data, uLights[i], input.positionWorld, input.position.xy);",
  );
  const pointLightsBlock = lightsLoop(
    "point",
    "EvaluatePointLight(&data, uLights[i], input.position.xy);",
  );
  const spotLightsBlock = lightsLoop(
    "spot",
    "EvaluateSpotLight(&data, uLights[i], input.positionWorld, input.position.xy);",
  );
  // Behind an override rather than always compiled: linearly transformed
  // cosines is by far the largest of the five evaluations, and a scene without
  // an area light should not carry its register pressure. Toggling it rebuilds
  // pipelines from the one shader module, not the module.
  const areaLightsBlock = /* wgsl */ `if (USE_AREA_LIGHTS) ${lightsLoop(
    "area",
    `EvaluateAreaLight(&data, uLights[i], uLtc1, ${samplerName("uLtc1")}, uLtc2, ${samplerName("uLtc2")}, input.positionWorld, uFrame.cameraPosition, input.position.xy);`,
  )}`;

  const alphaBlock = () => /* wgsl */ `
  ${
    materialFlags.alphaTexture
      ? `let alphaTexCoord = getTextureCoordinatesTransformed(data, ${tc("alpha")}, uMaterial.alphaTextureMatrix);\n  data.opacity *= textureSample(uAlphaTexture, uAlphaTextureSampler, alphaTexCoord).x;`
      : ""
  }
  if (USE_ALPHA_CUTOFF && !USE_ALPHA_TO_COVERAGE) {
  alphaTest(&data, uMaterial.alphaCutoff);
  }`;

  const unlitBody = /* wgsl */ `
  ${
    materialFlags.baseColorTexture
      ? `getBaseColorTextured(&data, uMaterial.baseColor, uBaseColorTexture, uBaseColorTextureSampler, ${tc("baseColor")}, uMaterial.baseColorTextureMatrix, ${vColorExpr});`
      : `getBaseColor(&data, uMaterial.baseColor, ${vColorExpr});`
  }
  // Display-referred, not metered: an unlit material declares its output
  // colour, and baseColor is an sRGB value capped at 1 with no way to express
  // a luminance, so metering it for daylight would render it black.
  color = data.baseColor;
  ${alphaBlock()}`;

  const litBody = /* wgsl */ `
  data.inverseViewMatrix = uFrame.inverseViewMatrix;
  data.positionWorld = input.positionWorld;
  data.positionView = input.positionView;
  let frontFacingSign = select(-1.0, 1.0, frontFacing);
  data.normalView = normalize(input.normalView) * frontFacingSign;
  ${vertexFlags.tangent ? "data.tangentView = normalize(input.tangentView) * frontFacingSign;" : ""}
  data.normalWorld = normalize(input.normalWorld) * frontFacingSign;
  data.bentNormalWorld = data.normalWorld;
  data.eyeDirView = normalize(-input.positionView);
  data.eyeDirWorld = (uFrame.inverseViewMatrix * vec4f(data.eyeDirView, 0.0)).xyz;
  data.indirectDiffuse = vec3f(0.0);
  data.indirectSpecular = vec3f(0.0);
  data.ao = 1.0;
  data.opacity = 1.0;
  data.viewWorld = normalize(uFrame.cameraPosition - input.positionWorld);
  data.NdotV = saturateF32(abs(dot(data.normalWorld, data.viewWorld)) + FLT_EPS);

  ${hooks.fragBeforeTextures ?? ""}

  ${
    materialFlags.normalTexture
      ? `getNormalTextured(&data, uNormalTexture, uNormalTextureSampler, uMaterial.normalTextureScale, ${tc("normal")}, uMaterial.normalTextureMatrix, frontFacing);`
      : "getNormal(&data);"
  }

  ${
    materialFlags.emissiveTexture
      ? // Neutral multiplier (1.0) when the factor isn't set, so the texture
        // passes through untinted — select() picks it at pipeline-creation
        // time instead of this being a separate JS-generated code path.
        `getEmissiveTextured(&data, select(vec4f(1.0), uMaterial.emissive, USE_EMISSIVE), select(1.0, uMaterial.emissiveStrength, USE_EMISSIVE), uEmissiveTexture, uEmissiveTextureSampler, ${tc("emissive")}, uMaterial.emissiveTextureMatrix, ${vColorExpr});`
      : // Zeroed multiplier leaves the term at 0 when the factor isn't set.
        `getEmissive(&data, select(vec4f(0.0), uMaterial.emissive, USE_EMISSIVE), select(0.0, uMaterial.emissiveStrength, USE_EMISSIVE), ${vColorExpr});`
  }

  // Emissive is display-referred by default: the value authored is the value
  // that reaches the exposed buffer, so it reads the same whether or not the
  // camera is metering physically. emissiveExposure dials it towards being a
  // luminance the camera meters like anything else.
  data.emissive *= mix(1.0, uFrame.exposure, uMaterial.emissiveExposure);

  ${
    materialFlags.metallicRoughnessWorkflow
      ? /* wgsl */ `
  ${
    materialFlags.baseColorTexture
      ? `getBaseColorTextured(&data, uMaterial.baseColor, uBaseColorTexture, uBaseColorTextureSampler, ${tc("baseColor")}, uMaterial.baseColorTextureMatrix, ${vColorExpr});`
      : `getBaseColor(&data, uMaterial.baseColor, ${vColorExpr});`
  }
  ${
    textures.metallicRoughnessTexture
      ? `getMetallicRoughnessTextured(&data, uMaterial.metallic, uMaterial.roughness, uMetallicRoughnessTexture, uMetallicRoughnessTextureSampler, ${tc("metallicRoughness")}, uMaterial.metallicRoughnessTextureMatrix);`
      : `${textures.metallicTexture ? `getMetallicTextured(&data, uMaterial.metallic, uMetallicTexture, uMetallicTextureSampler, ${tc("metallic")}, uMaterial.metallicTextureMatrix);` : "getMetallic(&data, uMaterial.metallic);"}
  ${textures.roughnessTexture ? `getRoughnessTextured(&data, uMaterial.roughness, uRoughnessTexture, uRoughnessTextureSampler, ${tc("roughness")}, uMaterial.roughnessTextureMatrix);` : "getRoughness(&data, uMaterial.roughness);"}`
  }
  data.roughness = clamp(data.roughness, MIN_ROUGHNESS, 1.0);`
      : ""
  }

  ${
    materialFlags.specularGlossinessWorkflow
      ? /* wgsl */ `
  let sgDiffuseRGBA = ${textures.sgDiffuseTexture ? `getDiffuseTextured(uMaterial.sgDiffuse, data, uSgDiffuseTexture, uSgDiffuseTextureSampler, ${tc("sgDiffuse")}, uMaterial.sgDiffuseTextureMatrix);` : "getDiffuse(uMaterial.sgDiffuse);"}
  let sgSpecGloss = ${textures.sgSpecularGlossinessTexture ? `getSpecularGlossinessTextured(uMaterial.sgSpecular, uMaterial.sgGlossiness, data, uSgSpecularGlossinessTexture, uSgSpecularGlossinessTextureSampler, ${tc("sgSpecularGlossiness")}, uMaterial.sgSpecularGlossinessTextureMatrix);` : "getSpecularGlossiness(uMaterial.sgSpecular, uMaterial.sgGlossiness);"}
  getBaseColorAndMetallicRoughnessFromSpecularGlossiness(&data, sgSpecGloss, sgDiffuseRGBA, ${vColorExpr});`
      : ""
  }

  ${alphaBlock()}

  if (USE_CLEARCOAT) {
  ${textures.clearcoatTexture ? `getClearcoatTextured(&data, uMaterial.clearcoat, uMaterial.clearcoatRoughness, uClearcoatTexture, uClearcoatTextureSampler, ${tc("clearcoat")}, uMaterial.clearcoatTextureMatrix);` : "getClearcoat(&data, uMaterial.clearcoat);"}
  ${
    textures.clearcoatRoughnessTexture
      ? `getClearcoatRoughnessTextured(&data, uMaterial.clearcoatRoughness, uClearcoatRoughnessTexture, uClearcoatRoughnessTextureSampler, ${tc("clearcoatRoughness")}, uMaterial.clearcoatRoughnessTextureMatrix);`
      : materialFlags.clearcoatRoughnessFromMainTexture
        ? ""
        : "getClearcoatRoughness(&data, uMaterial.clearcoatRoughness);"
  }
  data.clearcoatLinearRoughness = data.clearcoatRoughness * data.clearcoatRoughness;
  data.f0 = mix(data.f0, f0ClearcoatToSurface(data.f0), data.clearcoat);
  data.roughness = max(data.roughness, data.clearcoatRoughness);
  ${
    textures.clearcoatNormalTexture
      ? `getClearcoatNormalTextured(&data, uClearcoatNormalTexture, uClearcoatNormalTextureSampler, uMaterial.clearcoatNormalTextureScale, ${tc("clearcoatNormal")}, uMaterial.clearcoatNormalTextureMatrix, frontFacing);`
      : "getClearcoatNormal(&data, input.normalView);"
  }
  }

  if (USE_SHEEN) {
  ${textures.sheenColorTexture ? `getSheenColorTextured(&data, uMaterial.sheenColor, uMaterial.sheenRoughness, uSheenColorTexture, uSheenColorTextureSampler, ${tc("sheenColor")}, uMaterial.sheenColorTextureMatrix);` : "getSheenColor(&data, uMaterial.sheenColor);"}
  ${
    textures.sheenRoughnessTexture
      ? `getSheenRoughnessTextured(&data, uMaterial.sheenRoughness, uSheenRoughnessTexture, uSheenRoughnessTextureSampler, ${tc("sheenRoughness")}, uMaterial.sheenRoughnessTextureMatrix);`
      : materialFlags.sheenRoughnessFromMainTexture
        ? ""
        : "getSheenRoughness(&data, uMaterial.sheenRoughness);"
  }
  getSheenAlbedoScaling(&data);
  data.sheenRoughness = max(data.sheenRoughness, MIN_ROUGHNESS);
  data.sheenLinearRoughness = data.sheenRoughness * data.sheenRoughness;
  }

  if (USE_TRANSMISSION) {
  data.transmitted = vec3f(0.0);
  if (USE_DISPERSION) {
  data.dispersion = uMaterial.dispersion;
  }
  ${textures.transmissionTexture ? `getTransmissionTextured(&data, uMaterial.transmission, uTransmissionTexture, uTransmissionTextureSampler, ${tc("transmission")}, uMaterial.transmissionTextureMatrix);` : "getTransmission(&data, uMaterial.transmission);"}
  }
  if (USE_VOLUME) {
  ${textures.thicknessTexture ? `getThicknessTextured(&data, uMaterial.thickness, uThicknessTexture, uThicknessTextureSampler, ${tc("thickness")}, uMaterial.thicknessTextureMatrix);` : "getThickness(&data, uMaterial.thickness);"}
  getAttenuation(&data, uMaterial.attenuationColor, uMaterial.attenuationDistance);
  }
  if (USE_DIFFUSE_TRANSMISSION) {
  ${
    // The two textures are independently optional (like clearcoat/
    // clearcoatRoughness above) — each dispatches to the variant that only
    // samples the texture(s) actually bound, so a material with just one of
    // the two doesn't get the other's factor tinted by an unrelated texture.
    materialFlags.diffuseTransmissionTexture &&
    materialFlags.diffuseTransmissionColorTexture
      ? `getDiffuseTransmissionTextured(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uDiffuseTransmissionTexture, uDiffuseTransmissionTextureSampler, ${tc("diffuseTransmission")}, uMaterial.diffuseTransmissionTextureMatrix, uDiffuseTransmissionColorTexture, uDiffuseTransmissionColorTextureSampler, ${tc("diffuseTransmissionColor")}, uMaterial.diffuseTransmissionColorTextureMatrix, uModel.modelMatrix);`
      : materialFlags.diffuseTransmissionTexture
        ? `getDiffuseTransmissionStrengthTextured(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uDiffuseTransmissionTexture, uDiffuseTransmissionTextureSampler, ${tc("diffuseTransmission")}, uMaterial.diffuseTransmissionTextureMatrix, uModel.modelMatrix);`
        : materialFlags.diffuseTransmissionColorTexture
          ? `getDiffuseTransmissionColorTextured(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uDiffuseTransmissionColorTexture, uDiffuseTransmissionColorTextureSampler, ${tc("diffuseTransmissionColor")}, uMaterial.diffuseTransmissionColorTextureMatrix, uModel.modelMatrix);`
          : `getDiffuseTransmission(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uModel.modelMatrix);`
  }
  }

  ${materialFlags.occlusionTexture ? `getAmbientOcclusion(&data, uMaterial.occlusionTextureStrength, uOcclusionTexture, uOcclusionTextureSampler, ${tc("occlusion")}, uMaterial.occlusionTextureMatrix);` : ""}

  // Folded into the same term the material's occlusion texture feeds, so every
  // consumer of ao — ambient, area lights, the light probe, and the analytic
  // multi-bounce inside it — picks it up without knowing where it came from.
  if (USE_SSAO_TEXTURE) {
    let aoTerm = textureSampleLevel(uAOTexture, uAOTextureSampler, input.position.xy / uFrame.viewportSize, 0.0);
    data.ao *= aoTerm.x;
    if (USE_BENT_NORMALS) {
      // The estimator works in view space; the indirect term is world space.
      data.bentNormalWorld = normalize((uFrame.inverseViewMatrix * vec4f(aoTerm.yzw * 2.0 - 1.0, 0.0)).xyz);
    }
  }

  ${hooks.fragBeforeLighting ?? ""}

  data.diffuseColor = data.baseColor * (1.0 - data.metallic);
  data.linearRoughness = data.roughness * data.roughness;

  ${
    materialFlags.metallicRoughnessWorkflow
      ? /* wgsl */ `
  getIor(&data, uMaterial.ior);
  if (USE_SPECULAR) {
  ${
    // The two textures are independently optional: each dispatches to the
    // variant that only samples the texture(s) actually bound, so a material
    // with just specularTexture doesn't get its RGB — reserved for
    // specularColorTexture since ratification — tinting f0.
    textures.specularTexture && textures.specularColorTexture
      ? `getSpecularTextured(&data, uMaterial.specular, uMaterial.specularColor, uSpecularTexture, uSpecularTextureSampler, ${tc("specular")}, uMaterial.specularTextureMatrix, uSpecularColorTexture, uSpecularColorTextureSampler, ${tc("specularColor")}, uMaterial.specularColorTextureMatrix);`
      : textures.specularTexture
        ? `getSpecularStrengthTextured(&data, uMaterial.specular, uMaterial.specularColor, uSpecularTexture, uSpecularTextureSampler, ${tc("specular")}, uMaterial.specularTextureMatrix);`
        : textures.specularColorTexture
          ? `getSpecularColorTextured(&data, uMaterial.specular, uMaterial.specularColor, uSpecularColorTexture, uSpecularColorTextureSampler, ${tc("specularColor")}, uMaterial.specularColorTextureMatrix);`
          : "getSpecular(&data, uMaterial.specular, uMaterial.specularColor);"
  }
  } else {
  getSpecularFromIor(&data);
  }`
      : ""
  }

  ${
    useReflectionProbes
      ? /* wgsl */ `
  data.reflectionWorld = reflect(-data.eyeDirWorld, data.normalWorld);
  EvaluateLightProbe(&data, data.ao, uReflectionProbe.rotation, uReflectionProbe.intensity, uSpecularEnvMap, uSpecularEnvMapSampler, ROUGHNESS_LEVELS, uIrradianceCoefficients);`
      : ""
  }

  ${
    // Refraction is independent of the probe: always emitted for lit materials,
    // gated at runtime by the USE_TRANSMISSION override.
    materialFlags.unlitWorkflow
      ? ""
      : /* wgsl */ `
  if (USE_TRANSMISSION) {
    EvaluateTransmission(&data, uCaptureTexture, uCaptureTextureSampler, uFrame.viewportSize, uModel.modelMatrix, uFrame.projectionMatrix, uFrame.viewMatrix);
  }`
  }

  ${ambientLightsBlock}
  ${directionalLightsBlock}
  ${pointLightsBlock}
  ${spotLightsBlock}
  ${areaLightsBlock}

  ${hooks.fragAfterLighting ?? ""}

  // Only the terms that are scene radiance get metered. data.transmitted is
  // already exposed (it samples the grab texture this same multiply wrote), and
  // data.emissive carries its own exposure treatment from above.
  color = (data.indirectDiffuse + data.indirectSpecular + data.directColor) * uFrame.exposure + data.emissive + data.transmitted;`;

  return /* wgsl */ `
${frameStruct()}

${modelStruct({
  previousModelMatrix: !!outputs.velocity,
  displacementTexture: useDisplacementTexture,
  skin: useSkin,
  previousSkin: !!outputs.velocity,
  maxJoints,
})}

struct Material {
  baseColor: vec4f,
  ${scalarStructFields}
  ${textureMatrixFields}
}
@group(2) @binding(0) var<uniform> uMaterial: Material;
${STANDARD_MATERIAL_FIELDS.filter((field) => field.texture)
  .map((field) =>
    textureSamplerDeclaration(
      2,
      textures[field.key] ?? null,
      uniformName(field.key),
    ),
  )
  .join("\n")}
${hookBindingsDeclaration(2, materialBindings, hooks.bindings)}

${lightsDecl}
${shadow2DDecls}
${shadowCubeDecls}
${reflectionProbeDecl}
${captureDecl}
${ssaoDecl}

${vertexInputStruct(
  {
    normal: useNormals,
    tangent: vertexFlags.tangent,
    texCoord0: vertexFlags.texCoord0 || useDisplacementTexture,
    texCoord1: vertexFlags.texCoord1,
    vertexColor: vertexFlags.vertexColor,
    instancedOffset: vertexFlags.instancedOffset,
    instancedScale: vertexFlags.instancedScale,
    instancedRotation: vertexFlags.instancedRotation,
    instancedColor: vertexFlags.instancedColor,
    skin: useSkin,
    // Only where they are read: a variant not writing motion vectors has no use
    // for last frame's values, and binding them would cost a vertex fetch each.
    previousPosition: !!outputs.velocity && vertexFlags.previousPosition,
    previousInstancedOffset:
      !!outputs.velocity && vertexFlags.previousInstancedOffset,
    previousInstancedScale:
      !!outputs.velocity && vertexFlags.previousInstancedScale,
    previousInstancedRotation:
      !!outputs.velocity && vertexFlags.previousInstancedRotation,
  },
  hookMembers(hooks.attributes),
)}

${vertexOutputStruct([
  { name: "normalWorld", type: "vec3f" },
  { name: "normalView", type: "vec3f" },
  { name: "texCoord0", type: "vec2f" },
  vertexFlags.texCoord1 && { name: "texCoord1", type: "vec2f" },
  { name: "positionWorld", type: "vec3f" },
  { name: "positionView", type: "vec3f" },
  vertexFlags.tangent && { name: "tangentView", type: "vec4f" },
  useColor && { name: "color", type: "vec4f" },
  ...(outputs.velocity ? VELOCITY_MEMBERS : []),
  ...hookMembers(hooks.interStage),
])}

${fragmentOutputStruct(sceneOutputMembers(outputs))}

${PBR_DATA_STRUCT}

// Feature toggles the included shaders expect this pipeline shader to declare.
override DEPTH_PASS_ONLY: bool = false;
override DEPTH_PRE_PASS_ONLY: bool = false;
override USE_TEXCOORD_1: bool = ${vertexFlags.texCoord1};
override USE_TANGENTS: bool = ${vertexFlags.tangent};
override USE_NORMAL_TEXTURE: bool = ${materialFlags.normalTexture};
override USE_CLEARCOAT_NORMAL_TEXTURE: bool = ${materialFlags.clearcoatNormalTexture};
override USE_CLEARCOAT_ROUGHNESS_FROM_MAIN_TEXTURE: bool = ${materialFlags.clearcoatRoughnessFromMainTexture};
override USE_SHEEN_ROUGHNESS_FROM_MAIN_TEXTURE: bool = ${materialFlags.sheenRoughnessFromMainTexture};
override DEPTH_PACK_FAR: f32 = 10.0;
// Genuinely overridable (unlike the toggles above, which change bind group
// layout/struct fields and so must be baked per-variant): none of these gate
// a binding or struct field — their scalar uMaterial fields are always
// declared (see the runtime FeatureField flag in systems/renderer/base.ts)
// — only a body branch, so materials that differ only by one of these
// effects being on/off share one compiled shader module. Real per-material
// values are supplied via the pipeline's constants (getPipelineOptions() in
// systems/renderer/standard.ts).
override USE_MSAA: bool = false;
override USE_BLEND: bool = false;
override USE_SSAO_TEXTURE: bool = false;
// The AO texture's remaining channels hold a bent normal, which then drives the
// irradiance lookup and the specular occlusion cone instead of the surface
// normal and the flat visibility term.
override USE_BENT_NORMALS: bool = false;
// Only meaningful alongside USE_BLEND: scales color by opacity before output,
// matching a premultiplied blend equation (see BLEND_MODES and
// getPipelineBlend in systems/renderer/base.ts).
override PREMULTIPLY_ALPHA: bool = false;
override USE_ALPHA_CUTOFF: bool = false;
// Alpha testing against a multisampled attachment: the cutout becomes a
// coverage mask rather than a discard, so its edges antialias like geometry.
// Set by the renderer when the pass is multisampled, paired with the pipeline's
// alphaToCoverage (see systems/renderer/standard.ts).
override USE_ALPHA_TO_COVERAGE: bool = false;
override USE_SPECULAR: bool = false;
override USE_EMISSIVE: bool = false;
override USE_CLEARCOAT: bool = false;
override USE_SHEEN: bool = false;
override USE_AREA_LIGHTS: bool = false;
override USE_TRANSMISSION: bool = false;
override USE_DISPERSION: bool = false;
override USE_VOLUME: bool = false;
override USE_DIFFUSE_TRANSMISSION: bool = false;
// Mip levels in the bound specular cubemap: baked probes always match
// ROUGHNESS_LEVELS (shaders/reflection-probe.ts), but a pre-baked
// EXT_lights_image_based probe reports its own native mip count, so this is
// swapped per-draw via the pipeline's constants rather than hardcoded here
// (see systems/renderer/standard.ts getPipelineOptions).
override ROUGHNESS_LEVELS: f32 = ${ROUGHNESS_LEVELS}.0;

// Vertex includes
${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  var position = vec4f(input.position, 1.0);
  var normal = vec3f(0.0, 0.0, 0.0);
  ${useNormals ? "normal = input.normal;" : ""}
  ${vertexFlags.tangent ? "var tangent = input.tangent;" : ""}

  var texCoord = vec2f(0.0, 0.0);
  ${vertexFlags.texCoord0 ? "texCoord = input.texCoord0;" : ""}
  output.texCoord0 = texCoord;

  ${vertexFlags.texCoord1 ? "output.texCoord1 = input.texCoord1;" : ""}

  ${hooks.vertBeforeTransform ?? ""}

  ${
    useDisplacementTexture
      ? "let h = textureSampleLevel(uDisplacementTexture, uDisplacementTextureSampler, input.texCoord0, 0.0).x;\n  position = vec4f(position.xyz + uModel.displacement * h * normal, position.w);"
      : ""
  }

  ${vertexTransform({
    useSkin,
    instancedScale: vertexFlags.instancedScale,
    instancedRotation: vertexFlags.instancedRotation,
    instancedOffset: vertexFlags.instancedOffset,
    transformNormal: true,
    transformTangent: vertexFlags.tangent,
  })}

  ${colorAssignment}

  output.normalWorld = normalize((uFrame.inverseViewMatrix * vec4f(output.normalView, 0.0)).xyz);

  let positionView = uFrame.viewMatrix * positionWorld;
  let positionOut = uFrame.projectionMatrix * positionView;

  output.positionWorld = positionWorld.xyz / positionWorld.w;
  output.positionView = positionView.xyz / positionView.w;
  output.position = positionOut;
  ${
    outputs.velocity
      ? `${vertexPreviousWorld({
          useSkin,
          instancedScale: vertexFlags.instancedScale,
          instancedRotation: vertexFlags.instancedRotation,
          instancedOffset: vertexFlags.instancedOffset,
          previousPosition: vertexFlags.previousPosition,
          previousInstancedScale: vertexFlags.previousInstancedScale,
          previousInstancedRotation: vertexFlags.previousInstancedRotation,
          previousInstancedOffset: vertexFlags.previousInstancedOffset,
        })}
  ${vertexVelocity({ previousWorld: "previousPositionWorld" })}`
      : ""
  }
  ${vertexJitter()}

  ${vertexFlags.tangent ? "output.tangentView = vec4f((uModel.normalMatrix * tangent.xyz), tangent.w);" : ""}

  // Note: WebGPU has no gl_PointSize equivalent; point-primitive sizing is
  // not supported and must be done via instanced/billboarded quads instead.

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}
${SHADERS.math.saturate}
${SHADERS.math.multQuat}
${SHADERS.math.random}
${SHADERS.math.glslMod}
${SHADERS.encodeDecode}
${SHADERS.textureCoordinates}
${SHADERS.baseColor}
${SHADERS.alpha}
${SHADERS.ambientOcclusion.multiBounce}
${SHADERS.ambientOcclusion.specular}
${SHADERS.ambientOcclusion.texture}
${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

${
  materialFlags.unlitWorkflow
    ? ""
    : `
  // Lighting
  ${LIGHT_STRUCTS}
  ${SHADERS.depthUnpack}
  ${SHADERS.depthRead}
  ${SHADERS.normalPerturb}
  ${SHADERS.shadowing}
  ${shadowDispatchDecls}
  ${SHADERS.brdf}
  ${SHADERS.specular}
  ${SHADERS.clearcoat}
  ${SHADERS.sheenColor}
  ${SHADERS.transmission}
  ${SHADERS.indirect}
  ${SHADERS.direct}
  ${SHADERS.lightAmbient}
  ${SHADERS.lightDirectional}
  ${SHADERS.lightPoint}
  ${SHADERS.lightSpot}
  ${SHADERS.lightArea}

  // Material and geometric context
  ${SHADERS.emissive}
  ${SHADERS.normal}
  ${SHADERS.metallicRoughness}
  ${SHADERS.specularGlossiness}
`
}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(
  input: VertexOutput,
  @builtin(front_facing) frontFacing: bool
) -> FragmentOutput {
  var output: FragmentOutput;
  var color: vec3f;

  var data: PBRData;
  data.texCoord0 = input.texCoord0;
  ${vertexFlags.texCoord1 ? "data.texCoord1 = input.texCoord1;" : ""}

  ${materialFlags.unlitWorkflow ? unlitBody : litBody}

  if (USE_MSAA) {
    color = reversibleToneMap(color);
  }

  color = max(color, vec3f(0.0));

  output.color = vec4f(color, 1.0);

  ${outputs.normal ? "output.normal = vec4f(data.normalView * 0.5 + 0.5, 1.0);" : ""}
  ${outputs.emissive ? "output.emissive = vec4f(data.emissive, 1.0);" : ""}
  ${outputs.velocity ? FRAGMENT_VELOCITY : ""}
  ${
    outputs.responsive
      ? `// Blended and transmissive surfaces mark themselves without being asked:
  // neither is drawn in the pass that writes motion vectors, so the history
  // behind them belongs to whatever they are in front of. The opacity rides
  // along as alpha, so a surface covering part of a pixel claims that part.
  output.responsive = vec4f(
    ${defines.has(MATERIAL_DEFINE.responsiveAA) ? "1.0" : "select(0.0, 1.0, USE_BLEND || USE_TRANSMISSION)"},
    0.0,
    0.0,
    data.opacity
  );`
      : ""
  }
  if (USE_TRANSMISSION || USE_BLEND) {
    output.color.w = data.opacity;
    if (PREMULTIPLY_ALPHA) {
      output.color = vec4f(output.color.rgb * data.opacity, data.opacity);
    }
  }

  if (USE_ALPHA_CUTOFF && USE_ALPHA_TO_COVERAGE) {
    // Alpha drives the coverage mask, so it has to be a coverage value rather
    // than the mask texture's own gradient: rescaled by its screen-space rate
    // of change, it saturates to 0 or 1 everywhere except the pixel straddling
    // the cutoff. Without this, every partially transparent texel in the
    // interior would thin out the surface instead of only its silhouette.
    output.color.w = saturateF32(
      (data.opacity - uMaterial.alphaCutoff) / max(fwidth(data.opacity), 1e-4) + 0.5
    );
  }

  ${hooks.fragEnd ?? ""}
  ${options.debugRender ? debugRenderAssignment(options.debugRender) : ""}

  return output;
}
`;
};
