import { chunks as SHADERS } from "pex-shaders";

import { getRuntimeDefines, isFieldActive } from "../systems/renderer/base.js";
import {
  bindingDeclaration,
  createBindingAllocator,
  fragmentOutputStruct,
  frameStruct,
  lightArrayDeclaration,
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
} from "./wgsl.js";
import { ROUGHNESS_LEVELS, SH_COEFFICIENT_COUNT } from "./reflection-probe.js";
import type { FeatureField } from "../systems/renderer/base.js";
import type { MaterialTextureBinding } from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

const MATERIAL_DEFINE = {
  unlitWorkflow: "USE_UNLIT_WORKFLOW",
  metallicRoughnessWorkflow: "USE_METALLIC_ROUGHNESS_WORKFLOW",
  specularGlossinessWorkflow: "USE_SPECULAR_GLOSSINESS_WORKFLOW",
  alphaTest: "USE_ALPHA_TEST",
  emissive: "USE_EMISSIVE_COLOR",
  specular: "USE_SPECULAR",
  clearCoat: "USE_CLEAR_COAT",
  clearCoatRoughnessFromMainTexture:
    "USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE",
  sheen: "USE_SHEEN",
  sheenRoughnessFromMainTexture: "USE_SHEEN_ROUGHNESS_FROM_MAIN_TEXTURE",
  transmission: "USE_TRANSMISSION",
  dispersion: "USE_DISPERSION",
  volume: "USE_VOLUME",
  diffuseTransmission: "USE_DIFFUSE_TRANSMISSION",

  baseColorTexture: "USE_BASE_COLOR_TEXTURE",
  alphaTexture: "USE_ALPHA_TEXTURE",
  emissiveColorTexture: "USE_EMISSIVE_COLOR_TEXTURE",
  normalTexture: "USE_NORMAL_TEXTURE",
  metallicRoughnessTexture: "USE_METALLIC_ROUGHNESS_TEXTURE",
  metallicTexture: "USE_METALLIC_TEXTURE",
  roughnessTexture: "USE_ROUGHNESS_TEXTURE",
  specularTexture: "USE_SPECULAR_TEXTURE",
  specularColorTexture: "USE_SPECULAR_COLOR_TEXTURE",
  diffuseTexture: "USE_DIFFUSE_TEXTURE",
  specularGlossinessTexture: "USE_SPECULAR_GLOSSINESS_TEXTURE",
  clearCoatTexture: "USE_CLEAR_COAT_TEXTURE",
  clearCoatRoughnessTexture: "USE_CLEAR_COAT_ROUGHNESS_TEXTURE",
  clearCoatNormalTexture: "USE_CLEAR_COAT_NORMAL_TEXTURE",
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
} as const;

// prettier-ignore
export const STANDARD_MATERIAL_COMMON_FIELDS: readonly FeatureField[] = [
  { key: "baseColorTexture", define: MATERIAL_DEFINE.baseColorTexture, texture: true },
  { key: "alphaTexture", define: MATERIAL_DEFINE.alphaTexture, texture: true },
  { key: "alphaTest", define: MATERIAL_DEFINE.alphaTest, wgslType: "f32", default: 0, runtime: true },
];

// Order here is significant (a field's requires/excludes can only see
// defines added earlier in the same pass).
// prettier-ignore
export const STANDARD_MATERIAL_LIT_FIELDS: readonly FeatureField[] = [
  { key: "normalTexture", define: MATERIAL_DEFINE.normalTexture, texture: true },
  { key: "normalTextureScale", requires: MATERIAL_DEFINE.normalTexture, wgslType: "f32", default: 1 },

  // Specular-glossiness workflow.
  { key: "diffuseTexture", requires: MATERIAL_DEFINE.specularGlossinessWorkflow, define: MATERIAL_DEFINE.diffuseTexture, texture: true },
  { key: "specularGlossinessTexture", requires: MATERIAL_DEFINE.specularGlossinessWorkflow, define: MATERIAL_DEFINE.specularGlossinessTexture, texture: true },
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

  // KHR_materials_specular: OR-activated by either field sharing MATERIAL_DEFINE.specular.
  // `runtime: true` here (unlike clearCoat/sheen/etc.) still respects its
  // `requires` — metallicRoughnessWorkflow is a genuinely structural gate,
  // not an internal group link, so getFeatureFlags keeps enforcing it (see
  // the runtimeDefines check in base.ts).
  { key: "specular", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, define: MATERIAL_DEFINE.specular, wgslType: "f32", default: 1, runtime: true },
  { key: "specularColor", requires: MATERIAL_DEFINE.metallicRoughnessWorkflow, define: MATERIAL_DEFINE.specular, wgslType: "vec3f", default: [1, 1, 1], runtime: true },
  { key: "specularTexture", requires: MATERIAL_DEFINE.specular, define: MATERIAL_DEFINE.specularTexture, texture: true },
  { key: "specularColorTexture", requires: MATERIAL_DEFINE.specular, define: MATERIAL_DEFINE.specularColorTexture, texture: true },

  // KHR_materials_clearcoat. `runtime: true` (also below for sheen/
  // transmission/dispersion/volume/diffuseTransmission): the scalar factor
  // is always in the Material struct and the shader body always evaluates
  // the effect, gated by a same-named `override` constant instead of by
  // string presence — materials that differ only by one of these effects
  // being on/off then share one compiled shader module (see FeatureField.runtime).
  { key: "clearCoat", define: MATERIAL_DEFINE.clearCoat, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "clearCoatRoughness", requires: MATERIAL_DEFINE.clearCoat, wgslType: "f32", default: 0, runtime: true },
  { key: "clearCoatTexture", requires: MATERIAL_DEFINE.clearCoat, define: MATERIAL_DEFINE.clearCoatTexture, texture: true },
  { key: "clearCoatRoughnessTexture", requires: MATERIAL_DEFINE.clearCoat, define: MATERIAL_DEFINE.clearCoatRoughnessTexture, texture: true },
  // No dedicated roughness texture: packed into the clearCoat texture's g channel.
  { key: "clearCoatTexture", requires: MATERIAL_DEFINE.clearCoat, excludes: MATERIAL_DEFINE.clearCoatRoughnessTexture, define: MATERIAL_DEFINE.clearCoatRoughnessFromMainTexture },
  { key: "clearCoatNormalTexture", requires: MATERIAL_DEFINE.clearCoat, define: MATERIAL_DEFINE.clearCoatNormalTexture, texture: true },
  { key: "clearCoatNormalTextureScale", requires: MATERIAL_DEFINE.clearCoatNormalTexture, wgslType: "f32", default: 1 },

  // KHR_materials_sheen.
  { key: "sheenColor", define: MATERIAL_DEFINE.sheen, wgslType: "vec4f", default: [0, 0, 0, 0], runtime: true },
  { key: "sheenRoughness", requires: MATERIAL_DEFINE.sheen, wgslType: "f32", default: 0, runtime: true },
  { key: "sheenColorTexture", requires: MATERIAL_DEFINE.sheen, define: MATERIAL_DEFINE.sheenColorTexture, texture: true },
  { key: "sheenRoughnessTexture", requires: MATERIAL_DEFINE.sheen, define: MATERIAL_DEFINE.sheenRoughnessTexture, texture: true },
  // No dedicated roughness texture: packed into the sheenColor texture's alpha.
  { key: "sheenColorTexture", requires: MATERIAL_DEFINE.sheen, excludes: MATERIAL_DEFINE.sheenRoughnessTexture, define: MATERIAL_DEFINE.sheenRoughnessFromMainTexture },

  // KHR_materials_transmission/dispersion. transmission: 0 behaves like unset.
  { key: "transmission", define: MATERIAL_DEFINE.transmission, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "transmissionTexture", requires: MATERIAL_DEFINE.transmission, define: MATERIAL_DEFINE.transmissionTexture, texture: true },
  { key: "dispersion", requires: MATERIAL_DEFINE.transmission, define: MATERIAL_DEFINE.dispersion, truthy: true, wgslType: "f32", default: 0, runtime: true },

  // KHR_materials_diffuse_transmission.
  { key: "diffuseTransmission", define: MATERIAL_DEFINE.diffuseTransmission, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "diffuseTransmissionColor", requires: MATERIAL_DEFINE.diffuseTransmission, wgslType: "vec3f", default: [1, 1, 1], runtime: true },
  { key: "diffuseTransmissionTexture", requires: MATERIAL_DEFINE.diffuseTransmission, define: MATERIAL_DEFINE.diffuseTransmissionTexture, texture: true },
  { key: "diffuseTransmissionColorTexture", requires: MATERIAL_DEFINE.diffuseTransmission, define: MATERIAL_DEFINE.diffuseTransmissionColorTexture, texture: true },

  // KHR_materials_volume — shared by transmission and diffuse transmission
  // (Beer's law attenuation).
  { key: "thickness", define: MATERIAL_DEFINE.volume, truthy: true, wgslType: "f32", default: 0, runtime: true },
  { key: "attenuationColor", requires: MATERIAL_DEFINE.volume, wgslType: "vec3f", default: [1, 1, 1], runtime: true },
  { key: "attenuationDistance", requires: MATERIAL_DEFINE.volume, wgslType: "f32", default: Infinity, runtime: true },
  { key: "thicknessTexture", requires: MATERIAL_DEFINE.volume, define: MATERIAL_DEFINE.thicknessTexture, texture: true },

  { key: "occlusionTexture", define: MATERIAL_DEFINE.occlusionTexture, texture: true },
  // emissiveColorTexture is independent of emissiveColor: the shader
  // select()s a neutral (1.0) factor when emissiveColor isn't set and a
  // texture is present, or a zeroed one when there's no texture either
  // (matching getEmissiveColor()'s hardcoded 0) — see the litBody template.
  { key: "emissiveColor", define: MATERIAL_DEFINE.emissive, wgslType: "vec4f", default: [0, 0, 0, 0], runtime: true },
  { key: "emissiveIntensity", requires: MATERIAL_DEFINE.emissive, wgslType: "f32", default: 1, runtime: true },
  { key: "emissiveColorTexture", define: MATERIAL_DEFINE.emissiveColorTexture, texture: true },
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
  { key: "instanceColor", define: VERTEX_DEFINE.instancedColor },
  { key: "joint", define: VERTEX_DEFINE.skin },
  { key: "weight", define: VERTEX_DEFINE.skin },
];

export const STANDARD_WORKFLOW = {
  unlit: MATERIAL_DEFINE.unlitWorkflow,
  metallicRoughness: MATERIAL_DEFINE.metallicRoughnessWorkflow,
  specularGlossiness: MATERIAL_DEFINE.specularGlossinessWorkflow,
} as const;

export const standardShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { maxJoints = 256 } = options;
  const outputs = options.outputs ?? {};
  const texCoords = options.texCoords || {};
  const lights = options.lights || {};

  const tc = getTexCoordGetter(texCoords);

  const useNormals = defines.has("USE_NORMALS");
  const materialFlags = getDefineFlags(MATERIAL_DEFINE, defines);
  const vertexFlags = getDefineFlags(VERTEX_DEFINE, defines);
  const useColor = vertexFlags.vertexColor || vertexFlags.instancedColor;
  const useDisplacementTexture = defines.has("USE_DISPLACEMENT_TEXTURE");
  const useSkin = defines.has("USE_SKIN");
  const useReflectionProbes =
    defines.has("USE_REFLECTION_PROBES") && !materialFlags.unlitWorkflow;

  const ambientLights = materialFlags.unlitWorkflow ? 0 : (lights.ambient ?? 0);
  const directionalLights = materialFlags.unlitWorkflow
    ? 0
    : (lights.directional ?? 0);
  const pointLights = materialFlags.unlitWorkflow ? 0 : (lights.point ?? 0);
  const spotLights = materialFlags.unlitWorkflow ? 0 : (lights.spot ?? 0);
  const areaLights = materialFlags.unlitWorkflow ? 0 : (lights.area ?? 0);

  const colorAssignment =
    vertexFlags.vertexColor && vertexFlags.instancedColor
      ? "output.color = input.vertexColor * input.instanceColor;"
      : vertexFlags.instancedColor
        ? "output.color = input.instanceColor;"
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

  const ambientLightsDecl = lightArrayDeclaration(
    1,
    lightBindings,
    "uAmbientLights",
    "AmbientLight",
    ambientLights,
  );
  const directionalLightsDecl = lightArrayDeclaration(
    1,
    lightBindings,
    "uDirectionalLights",
    "DirectionalLight",
    directionalLights,
  );
  const pointLightsDecl = lightArrayDeclaration(
    1,
    lightBindings,
    "uPointLights",
    "PointLight",
    pointLights,
  );
  const spotLightsDecl = lightArrayDeclaration(
    1,
    lightBindings,
    "uSpotLights",
    "SpotLight",
    spotLights,
  );
  const areaLightsDecl = lightArrayDeclaration(
    1,
    lightBindings,
    "uAreaLights",
    "AreaLight",
    areaLights,
  );

  const ltcDecl =
    areaLights === 0
      ? ""
      : /* wgsl */ `
${textureSamplerDeclaration(1, lightBindings.nextTextureSampler(), "uLtc1")}
${textureSamplerDeclaration(1, lightBindings.nextTextureSampler(), "uLtc2")}`;

  const shadowMapNames = (type: string, count: number) =>
    Array.from({ length: count }, (_, i) =>
      uniformName(`${type}ShadowMap${i}`),
    );
  // 2D shadow maps use a comparison sampler (hardware PCF); cube maps use a
  // regular sampler and compare manually (textureLoad is unavailable on cubes).
  const shadowMapDecl = (
    names: string[],
    kind: string,
    samplerKind = "sampler_comparison",
  ) =>
    names
      .map((name) =>
        textureSamplerDeclaration(
          1,
          lightBindings.nextTextureSampler(),
          name,
          kind,
          samplerKind,
        ),
      )
      .join("\n");

  const directionalShadowMaps = shadowMapNames(
    "directional",
    directionalLights,
  );
  const pointShadowMaps = shadowMapNames("point", pointLights);
  const spotShadowMaps = shadowMapNames("spot", spotLights);
  const areaShadowMaps = shadowMapNames("area", areaLights);
  const directionalShadowMapDecls = shadowMapDecl(
    directionalShadowMaps,
    "texture_depth_2d",
  );
  const pointShadowMapDecls = shadowMapDecl(
    pointShadowMaps,
    "texture_depth_cube",
    "sampler",
  );
  const spotShadowMapDecls = shadowMapDecl(spotShadowMaps, "texture_depth_2d");
  const areaShadowMapDecls = shadowMapDecl(areaShadowMaps, "texture_depth_2d");

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

  const ambientLightsBlock = Array.from(
    { length: ambientLights },
    (_, i) => `EvaluateAmbientLight(&data, uAmbientLights[${i}], data.ao);`,
  ).join("\n  ");
  const directionalLightsBlock = directionalShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluateDirectionalLight(&data, uDirectionalLights[${i}], ${shadowMap}, ${samplerName(shadowMap)}, input.positionWorld, input.position.xy);`,
    )
    .join("\n  ");
  const pointLightsBlock = pointShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluatePointLight(&data, uPointLights[${i}], ${shadowMap}, ${samplerName(shadowMap)}, input.position.xy);`,
    )
    .join("\n  ");
  const spotLightsBlock = spotShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluateSpotLight(&data, uSpotLights[${i}], ${shadowMap}, ${samplerName(shadowMap)}, input.positionWorld, input.position.xy);`,
    )
    .join("\n  ");
  const areaLightsBlock = areaShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluateAreaLight(&data, uAreaLights[${i}], ${shadowMap}, ${samplerName(shadowMap)}, uLtc1, ${samplerName("uLtc1")}, uLtc2, ${samplerName("uLtc2")}, data.ao, input.positionWorld, uFrame.cameraPosition, input.position.xy);`,
    )
    .join("\n  ");

  const alphaBlock = () => /* wgsl */ `
  ${
    materialFlags.alphaTexture
      ? `let alphaTexCoord = getTextureCoordinatesTransformed(data, ${tc("alpha")}, uMaterial.alphaTextureMatrix);\n  data.opacity *= textureSample(uAlphaTexture, uAlphaTextureSampler, alphaTexCoord).x;`
      : ""
  }
  if (USE_ALPHA_TEST) {
  alphaTest(&data, uMaterial.alphaTest);
  }`;

  const unlitBody = /* wgsl */ `
  ${
    materialFlags.baseColorTexture
      ? `getBaseColorTextured(&data, uMaterial.baseColor, uBaseColorTexture, uBaseColorTextureSampler, ${tc("baseColor")}, uMaterial.baseColorTextureMatrix, ${vColorExpr});`
      : `getBaseColor(&data, uMaterial.baseColor, ${vColorExpr});`
  }
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
    materialFlags.emissiveColorTexture
      ? // Neutral multiplier (1.0) when the factor isn't set, so the texture
        // passes through untinted — select() picks it at pipeline-creation
        // time instead of this being a separate JS-generated code path.
        `getEmissiveColorTextured(&data, select(vec4f(1.0), uMaterial.emissiveColor, USE_EMISSIVE_COLOR), select(1.0, uMaterial.emissiveIntensity, USE_EMISSIVE_COLOR), uEmissiveColorTexture, uEmissiveColorTextureSampler, ${tc("emissiveColor")}, uMaterial.emissiveColorTextureMatrix, ${vColorExpr});`
      : // Zeroed multiplier reproduces getEmissiveColor()'s hardcoded 0 when
        // the factor isn't set.
        `getEmissiveColorFactor(&data, select(vec4f(0.0), uMaterial.emissiveColor, USE_EMISSIVE_COLOR), select(0.0, uMaterial.emissiveIntensity, USE_EMISSIVE_COLOR), ${vColorExpr});`
  }

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
  let sgDiffuseRGBA = ${textures.diffuseTexture ? `getDiffuseTextured(uMaterial.sgDiffuse, data, uDiffuseTexture, uDiffuseTextureSampler, ${tc("diffuse")}, uMaterial.diffuseTextureMatrix);` : "getDiffuse(uMaterial.sgDiffuse);"}
  let sgSpecGloss = ${textures.specularGlossinessTexture ? `getSpecularGlossinessTextured(uMaterial.sgSpecular, uMaterial.sgGlossiness, data, uSpecularGlossinessTexture, uSpecularGlossinessTextureSampler, ${tc("specularGlossiness")}, uMaterial.specularGlossinessTextureMatrix);` : "getSpecularGlossiness(uMaterial.sgSpecular, uMaterial.sgGlossiness);"}
  getBaseColorAndMetallicRoughnessFromSpecularGlossiness(&data, sgSpecGloss, sgDiffuseRGBA, ${vColorExpr});`
      : ""
  }

  ${alphaBlock()}

  if (USE_CLEAR_COAT) {
  ${textures.clearCoatTexture ? `getClearCoatTextured(&data, uMaterial.clearCoat, uMaterial.clearCoatRoughness, uClearCoatTexture, uClearCoatTextureSampler, ${tc("clearCoat")}, uMaterial.clearCoatTextureMatrix);` : "getClearCoat(&data, uMaterial.clearCoat);"}
  ${
    textures.clearCoatRoughnessTexture
      ? `getClearCoatRoughnessTextured(&data, uMaterial.clearCoatRoughness, uClearCoatRoughnessTexture, uClearCoatRoughnessTextureSampler, ${tc("clearCoatRoughness")}, uMaterial.clearCoatRoughnessTextureMatrix);`
      : materialFlags.clearCoatRoughnessFromMainTexture
        ? ""
        : "getClearCoatRoughness(&data, uMaterial.clearCoatRoughness);"
  }
  data.clearCoatLinearRoughness = data.clearCoatRoughness * data.clearCoatRoughness;
  data.f0 = mix(data.f0, f0ClearCoatToSurface(data.f0), data.clearCoat);
  data.roughness = max(data.roughness, data.clearCoatRoughness);
  ${
    textures.clearCoatNormalTexture
      ? `getClearCoatNormalTextured(&data, uClearCoatNormalTexture, uClearCoatNormalTextureSampler, uMaterial.clearCoatNormalTextureScale, ${tc("clearCoatNormal")}, uMaterial.clearCoatNormalTextureMatrix, frontFacing);`
      : "getClearCoatNormal(&data, input.normalView);"
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
    // The two textures are independently optional (like clearCoat/
    // clearCoatRoughness above) — each dispatches to the variant that only
    // samples the texture(s) actually bound, so a material with just one of
    // the two doesn't get the other's factor tinted by an unrelated texture.
    materialFlags.diffuseTransmissionTexture &&
    materialFlags.diffuseTransmissionColorTexture
      ? `getDiffuseTransmissionTextured(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uDiffuseTransmissionTexture, uDiffuseTransmissionTextureSampler, ${tc("diffuseTransmission")}, uMaterial.diffuseTransmissionTextureMatrix, uDiffuseTransmissionColorTexture, uDiffuseTransmissionColorTextureSampler, ${tc("diffuseTransmissionColor")}, uMaterial.diffuseTransmissionColorTextureMatrix, uModel.modelMatrix);`
      : materialFlags.diffuseTransmissionTexture
        ? `getDiffuseTransmissionFactorTextured(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uDiffuseTransmissionTexture, uDiffuseTransmissionTextureSampler, ${tc("diffuseTransmission")}, uMaterial.diffuseTransmissionTextureMatrix, uModel.modelMatrix);`
        : materialFlags.diffuseTransmissionColorTexture
          ? `getDiffuseTransmissionColorTextured(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uDiffuseTransmissionColorTexture, uDiffuseTransmissionColorTextureSampler, ${tc("diffuseTransmissionColor")}, uMaterial.diffuseTransmissionColorTextureMatrix, uModel.modelMatrix);`
          : `getDiffuseTransmission(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uModel.modelMatrix);`
  }
  }

  ${materialFlags.occlusionTexture ? `getAmbientOcclusion(&data, uOcclusionTexture, uOcclusionTextureSampler, ${tc("occlusion")}, uMaterial.occlusionTextureMatrix);` : ""}

  ${hooks.fragBeforeLighting ?? ""}

  data.diffuseColor = data.baseColor * (1.0 - data.metallic);
  data.linearRoughness = data.roughness * data.roughness;

  ${
    materialFlags.metallicRoughnessWorkflow
      ? /* wgsl */ `
  getIor(&data, uMaterial.ior);
  if (USE_SPECULAR) {
  ${
    textures.specularTexture || textures.specularColorTexture
      ? `getSpecularFactorTextured(&data, uMaterial.specular, uMaterial.specularColor, ${textures.specularTexture ? "uSpecularTexture, uSpecularTextureSampler" : "uSpecularColorTexture, uSpecularColorTextureSampler"}, ${tc("specular")}, ${textures.specularTexture ? "uMaterial.specularTextureMatrix" : "uMaterial.specularColorTextureMatrix"}, ${textures.specularColorTexture ? "uSpecularColorTexture, uSpecularColorTextureSampler" : "uSpecularTexture, uSpecularTextureSampler"}, ${tc("specularColor")}, ${textures.specularColorTexture ? "uMaterial.specularColorTextureMatrix" : "uMaterial.specularTextureMatrix"});`
      : "getSpecularFactor(&data, uMaterial.specular, uMaterial.specularColor);"
  }
  } else {
  getSpecular(&data);
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

  color = data.emissiveColor + data.indirectDiffuse + data.indirectSpecular + data.directColor + data.transmitted;`;

  return /* wgsl */ `
${frameStruct()}

${modelStruct({
  displacementTexture: useDisplacementTexture,
  skin: useSkin,
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

${ambientLightsDecl}
${directionalLightsDecl}
${pointLightsDecl}
${spotLightsDecl}
${areaLightsDecl}
${ltcDecl}
${directionalShadowMapDecls}
${pointShadowMapDecls}
${spotShadowMapDecls}
${areaShadowMapDecls}
${reflectionProbeDecl}
${captureDecl}

${vertexInputStruct({
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
})}

${vertexOutputStruct([
  { name: "normalWorld", type: "vec3f" },
  { name: "normalView", type: "vec3f" },
  { name: "texCoord0", type: "vec2f" },
  vertexFlags.texCoord1 && { name: "texCoord1", type: "vec2f" },
  { name: "positionWorld", type: "vec3f" },
  { name: "positionView", type: "vec3f" },
  vertexFlags.tangent && { name: "tangentView", type: "vec4f" },
  useColor && { name: "color", type: "vec4f" },
])}

${fragmentOutputStruct([
  outputs.normal && { name: "normal", type: "vec4f" },
  outputs.emissive && { name: "emissive", type: "vec4f" },
])}

struct PBRData {
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
  viewWorld: vec3f, // V, view vector from position to camera, world space
  NdotV: f32,

  baseColor: vec3f,
  emissiveColor: vec3f,
  opacity: f32,
  roughness: f32, // roughness value, as authored by the model creator (input to shader)
  metallic: f32, // metallic value at the surface
  linearRoughness: f32, // roughness mapped to a more linear change in the roughness (proposed by [2])
  f0: vec3f, // Reflectance at normal incidence, specular color
  f90: vec3f, // Specular response at grazing incidence
  clearCoat: f32,
  clearCoatRoughness: f32,
  clearCoatLinearRoughness: f32,
  clearCoatNormal: vec3f,
  reflectionWorld: vec3f,
  directColor: vec3f,
  diffuseColor: vec3f, // color contribution from diffuse lighting
  indirectDiffuse: vec3f, // contribution from IBL light probe and Ambient Light
  indirectSpecular: vec3f, // contribution from IBL light probe and Area Light
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

// Feature toggles the included chunks expect this pipeline shader to declare.
override DEPTH_PASS_ONLY: bool = false;
override DEPTH_PRE_PASS_ONLY: bool = false;
override USE_TEXCOORD_1: bool = ${vertexFlags.texCoord1};
override USE_TANGENTS: bool = ${vertexFlags.tangent};
override USE_NORMAL_TEXTURE: bool = ${materialFlags.normalTexture};
override USE_CLEAR_COAT_NORMAL_TEXTURE: bool = ${materialFlags.clearCoatNormalTexture};
override USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE: bool = ${materialFlags.clearCoatRoughnessFromMainTexture};
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
// Only meaningful alongside USE_BLEND: scales color by opacity before output,
// matching the "premultiplied" blendMode's GPUBlendComponent pair (see
// BLEND_MODES in systems/renderer/base.ts).
override PREMULTIPLY_ALPHA: bool = false;
override USE_ALPHA_TEST: bool = false;
override USE_SPECULAR: bool = false;
override USE_EMISSIVE_COLOR: bool = false;
override USE_CLEAR_COAT: bool = false;
override USE_SHEEN: bool = false;
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
${(SHADERS.math as any).glslMod}
${SHADERS.encodeDecode}
${SHADERS.textureCoordinates}
${SHADERS.baseColor}
${SHADERS.alpha}
${(SHADERS.ambientOcclusion as any).multiBounce}
${(SHADERS.ambientOcclusion as any).texture}
${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

${
  materialFlags.unlitWorkflow
    ? ""
    : `
  // Lighting
  ${SHADERS.depthUnpack}
  ${SHADERS.depthRead}
  ${SHADERS.normalPerturb}
  ${SHADERS.shadowing}
  ${SHADERS.brdf}
  ${SHADERS.specular}
  ${SHADERS.clearCoat}
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
  ${SHADERS.emissiveColor}
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
  ${outputs.emissive ? "output.emissive = vec4f(data.emissiveColor, 1.0);" : ""}
  if (USE_TRANSMISSION || USE_BLEND) {
    output.color.w = data.opacity;
    if (PREMULTIPLY_ALPHA) {
      output.color = vec4f(output.color.rgb * data.opacity, data.opacity);
    }
  }

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
