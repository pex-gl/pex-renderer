import { chunks as SHADERS } from "pex-shaders";

import type { PipelineShaderOptions } from "../types.js";

/** A material texture's uniform binding slot (texture + sampler). */
type MaterialTextureBinding = { tex: number; samp: number };

// See basic.js for the shared attribute @location, Frame/Model uniform
// struct, and single-module vertex+fragment conventions. @group(1) (Lights)
// and @group(2) (Material) bindings are allocated sequentially per active
// feature by this generator, since - unlike Frame/Model - there's no
// cross-pipeline reuse goal for either group. Joint matrices and the
// displacement texture live in @group(3) (Model) at bindings 1-3.
const MAX_LIGHTS = 4;

export default (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const {
    maxJoints = 256,
    locationNormal = -1,
    locationEmissive = -1,
  } = options;
  const texCoords = options.texCoords || {};
  const lights = options.lights || {};

  const tc = (key: string) => texCoords[key] ?? 0;

  const useNormals = defines.has("USE_NORMALS");
  const useTangents = defines.has("USE_TANGENTS");
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
  const useMSAA = defines.has("USE_MSAA");
  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;
  const useBlend = defines.has("USE_BLEND");

  const useUnlitWorkflow = defines.has("USE_UNLIT_WORKFLOW");
  const useMetallicRoughnessWorkflow = defines.has(
    "USE_METALLIC_ROUGHNESS_WORKFLOW",
  );
  const useSpecularGlossinessWorkflow = defines.has(
    "USE_SPECULAR_GLOSSINESS_WORKFLOW",
  );

  const useBaseColorTexture = defines.has("USE_BASE_COLOR_TEXTURE");
  const useAlphaTexture = defines.has("USE_ALPHA_TEXTURE");
  const useAlphaTest = defines.has("USE_ALPHA_TEST");
  const useNormalTexture = defines.has("USE_NORMAL_TEXTURE");
  const useMetallicRoughnessTexture = defines.has(
    "USE_METALLIC_ROUGHNESS_TEXTURE",
  );
  const useMetallicTexture = defines.has("USE_METALLIC_TEXTURE");
  const useRoughnessTexture = defines.has("USE_ROUGHNESS_TEXTURE");
  const useSpecular =
    defines.has("USE_SPECULAR") && !useSpecularGlossinessWorkflow;
  const useSpecularTexture = defines.has("USE_SPECULAR_TEXTURE");
  const useSpecularColorTexture = defines.has("USE_SPECULAR_COLOR_TEXTURE");
  const useDiffuseTexture = defines.has("USE_DIFFUSE_TEXTURE");
  const useSpecularGlossinessTexture = defines.has(
    "USE_SPECULAR_GLOSSINESS_TEXTURE",
  );
  const useClearCoat = defines.has("USE_CLEAR_COAT");
  const useClearCoatTexture = defines.has("USE_CLEAR_COAT_TEXTURE");
  const useClearCoatRoughnessTexture = defines.has(
    "USE_CLEAR_COAT_ROUGHNESS_TEXTURE",
  );
  const useClearCoatRoughnessFromMainTexture = defines.has(
    "USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE",
  );
  const useClearCoatNormalTexture = defines.has(
    "USE_CLEAR_COAT_NORMAL_TEXTURE",
  );
  const useSheen = defines.has("USE_SHEEN");
  const useSheenColorTexture = defines.has("USE_SHEEN_COLOR_TEXTURE");
  const useSheenRoughnessTexture = defines.has("USE_SHEEN_ROUGHNESS_TEXTURE");
  const useSheenRoughnessFromMainTexture = defines.has(
    "USE_SHEEN_ROUGHNESS_FROM_MAIN_TEXTURE",
  );
  const useTransmission = defines.has("USE_TRANSMISSION");
  const useTransmissionTexture = defines.has("USE_TRANSMISSION_TEXTURE");
  const useDispersion = defines.has("USE_DISPERSION");
  const useVolume = defines.has("USE_VOLUME");
  const useThicknessTexture = defines.has("USE_THICKNESS_TEXTURE");
  const useDiffuseTransmission = defines.has("USE_DIFFUSE_TRANSMISSION");
  const useDiffuseTransmissionTexture = defines.has(
    "USE_DIFFUSE_TRANSMISSION_TEXTURE",
  );
  const useDiffuseTransmissionColorTexture = defines.has(
    "USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE",
  );
  const useOcclusionTexture = defines.has("USE_OCCLUSION_TEXTURE");
  const useEmissiveColor = defines.has("USE_EMISSIVE_COLOR");
  const useEmissiveColorTexture = defines.has("USE_EMISSIVE_COLOR_TEXTURE");
  const useReflectionProbes =
    defines.has("USE_REFLECTION_PROBES") && !useUnlitWorkflow;

  const ambientLights = useUnlitWorkflow
    ? 0
    : Math.min(lights.ambient ?? 0, MAX_LIGHTS);
  const directionalLights = useUnlitWorkflow
    ? 0
    : Math.min(lights.directional ?? 0, MAX_LIGHTS);
  const pointLights = useUnlitWorkflow
    ? 0
    : Math.min(lights.point ?? 0, MAX_LIGHTS);
  const spotLights = useUnlitWorkflow
    ? 0
    : Math.min(lights.spot ?? 0, MAX_LIGHTS);
  const areaLights = useUnlitWorkflow
    ? 0
    : Math.min(lights.area ?? 0, MAX_LIGHTS);

  const colorAssignment =
    useVertexColors && useInstancedColor
      ? "output.color = input.vertexColor * input.instanceColor;"
      : useInstancedColor
        ? "output.color = input.instanceColor;"
        : useVertexColors
          ? "output.color = input.vertexColor;"
          : "";

  // vColor / texCoordTransform neutral defaults, matching the chunks-phase convention:
  // decode(vec4f(1), SRGB) is exactly vec3f(1), so passing a white vColor when
  // vertex colors are unused is an exact no-op, not an approximation.
  const vColorExpr = useColor ? "input.color" : "vec4f(1.0)";

  // ---- @group(2) Material: binding numbers (0 is the Material uniform struct itself) ----
  let nextMaterialBinding = 1;
  const bindMaterialTexture = (): MaterialTextureBinding => ({
    tex: nextMaterialBinding++,
    samp: nextMaterialBinding++,
  });
  const matrixField = (name: string, binding: MaterialTextureBinding | null) =>
    binding ? `${name}TextureMatrix: mat3x3f,` : "";
  const textureDecl = (
    varName: string,
    binding: MaterialTextureBinding | null,
    kind = "texture_2d<f32>",
  ) =>
    binding
      ? `@group(2) @binding(${binding.tex}) var ${varName}: ${kind};\n@group(2) @binding(${binding.samp}) var ${varName}Sampler: sampler;`
      : "";

  const baseColorTex = useBaseColorTexture ? bindMaterialTexture() : null;
  const alphaTex = useAlphaTexture ? bindMaterialTexture() : null;
  const emissiveColorTex = useEmissiveColorTexture
    ? bindMaterialTexture()
    : null;
  const normalTex = useNormalTexture ? bindMaterialTexture() : null;
  const metallicRoughnessTex =
    useMetallicRoughnessWorkflow && useMetallicRoughnessTexture
      ? bindMaterialTexture()
      : null;
  const metallicTex =
    useMetallicRoughnessWorkflow &&
    !useMetallicRoughnessTexture &&
    useMetallicTexture
      ? bindMaterialTexture()
      : null;
  const roughnessTex =
    useMetallicRoughnessWorkflow &&
    !useMetallicRoughnessTexture &&
    useRoughnessTexture
      ? bindMaterialTexture()
      : null;
  const specularTex =
    useMetallicRoughnessWorkflow && useSpecular && useSpecularTexture
      ? bindMaterialTexture()
      : null;
  const specularColorTex =
    useMetallicRoughnessWorkflow && useSpecular && useSpecularColorTexture
      ? bindMaterialTexture()
      : null;
  const diffuseTex =
    useSpecularGlossinessWorkflow && useDiffuseTexture
      ? bindMaterialTexture()
      : null;
  const specularGlossinessTex =
    useSpecularGlossinessWorkflow && useSpecularGlossinessTexture
      ? bindMaterialTexture()
      : null;
  const clearCoatTex =
    useClearCoat && useClearCoatTexture ? bindMaterialTexture() : null;
  const clearCoatRoughnessTex =
    useClearCoat && useClearCoatRoughnessTexture ? bindMaterialTexture() : null;
  const clearCoatNormalTex =
    useClearCoat && useClearCoatNormalTexture ? bindMaterialTexture() : null;
  const sheenColorTex =
    useSheen && useSheenColorTexture ? bindMaterialTexture() : null;
  const sheenRoughnessTex =
    useSheen && useSheenRoughnessTexture ? bindMaterialTexture() : null;
  const transmissionTex =
    useTransmission && useTransmissionTexture ? bindMaterialTexture() : null;
  const thicknessTex =
    useVolume && useThicknessTexture ? bindMaterialTexture() : null;
  const diffuseTransmissionTex =
    useDiffuseTransmission && useDiffuseTransmissionTexture
      ? bindMaterialTexture()
      : null;
  const diffuseTransmissionColorTex =
    useDiffuseTransmission && useDiffuseTransmissionColorTexture
      ? bindMaterialTexture()
      : null;
  const occlusionTex = useOcclusionTexture ? bindMaterialTexture() : null;

  const metallicRoughnessFields = useMetallicRoughnessWorkflow
    ? /* wgsl */ `
  metallic: f32,
  roughness: f32,
  ${
    metallicRoughnessTex
      ? matrixField("metallicRoughness", metallicRoughnessTex)
      : `${matrixField("metallic", metallicTex)}\n  ${matrixField("roughness", roughnessTex)}`
  }
  ior: f32,
  ${useSpecular ? `specular: f32,\n  specularColor: vec3f,\n  ${matrixField("specular", specularTex)}\n  ${matrixField("specularColor", specularColorTex)}` : ""}`
    : "";

  const specularGlossinessFields = useSpecularGlossinessWorkflow
    ? /* wgsl */ `
  sgDiffuse: vec4f,
  sgSpecular: vec3f,
  sgGlossiness: f32,
  ${matrixField("diffuse", diffuseTex)}
  ${matrixField("specularGlossiness", specularGlossinessTex)}`
    : "";

  const clearCoatFields = useClearCoat
    ? /* wgsl */ `
  clearCoat: f32,
  clearCoatRoughness: f32,
  ${matrixField("clearCoat", clearCoatTex)}
  ${matrixField("clearCoatRoughness", clearCoatRoughnessTex)}
  ${clearCoatNormalTex ? "clearCoatNormalTextureScale: f32,\n  clearCoatNormalTextureMatrix: mat3x3f," : ""}`
    : "";

  const sheenFields = useSheen
    ? /* wgsl */ `
  sheenColor: vec4f,
  sheenRoughness: f32,
  ${matrixField("sheenColor", sheenColorTex)}
  ${matrixField("sheenRoughness", sheenRoughnessTex)}`
    : "";

  const transmissionFields = useTransmission
    ? /* wgsl */ `
  transmission: f32,
  ${matrixField("transmission", transmissionTex)}
  ${useDispersion ? "dispersion: f32," : ""}`
    : "";

  const volumeFields = useVolume
    ? /* wgsl */ `
  thickness: f32,
  attenuationColor: vec3f,
  attenuationDistance: f32,
  ${matrixField("thickness", thicknessTex)}`
    : "";

  const diffuseTransmissionFields = useDiffuseTransmission
    ? /* wgsl */ `
  diffuseTransmission: f32,
  diffuseTransmissionColor: vec3f,
  ${matrixField("diffuseTransmission", diffuseTransmissionTex)}
  ${matrixField("diffuseTransmissionColor", diffuseTransmissionColorTex)}`
    : "";

  // ---- @group(1) Lights: fixed-size arrays sized to the active count + individually-bound shadow maps ----
  let nextLightBinding = 0;
  const bindLight = () => nextLightBinding++;
  const lightArrayDecl = (name: string, structName: string, count: number) =>
    count === 0
      ? ""
      : `@group(1) @binding(${bindLight()}) var<uniform> ${name}: array<${structName}, ${count}>;`;

  const ambientLightsDecl = lightArrayDecl(
    "uAmbientLights",
    "AmbientLight",
    ambientLights,
  );
  const directionalLightsDecl = lightArrayDecl(
    "uDirectionalLights",
    "DirectionalLight",
    directionalLights,
  );
  const pointLightsDecl = lightArrayDecl(
    "uPointLights",
    "PointLight",
    pointLights,
  );
  const spotLightsDecl = lightArrayDecl("uSpotLights", "SpotLight", spotLights);
  const areaLightsDecl = lightArrayDecl("uAreaLights", "AreaLight", areaLights);

  const ltcDecl =
    areaLights === 0
      ? ""
      : /* wgsl */ `
@group(1) @binding(${bindLight()}) var uLtc1: texture_2d<f32>;
@group(1) @binding(${bindLight()}) var uLtc1Sampler: sampler;
@group(1) @binding(${bindLight()}) var uLtc2: texture_2d<f32>;
@group(1) @binding(${bindLight()}) var uLtc2Sampler: sampler;`;

  const shadowMapNames = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => `u${prefix}ShadowMap${i}`);
  // 2D shadow maps use a comparison sampler (hardware PCF); cube maps use a
  // regular sampler and compare manually (textureLoad is unavailable on cubes).
  const shadowMapDecl = (
    names: string[],
    kind: string,
    samplerKind = "sampler_comparison",
  ) =>
    names
      .map(
        (name) =>
          `@group(1) @binding(${bindLight()}) var ${name}: ${kind};\n@group(1) @binding(${bindLight()}) var ${name}Sampler: ${samplerKind};`,
      )
      .join("\n");

  const directionalShadowMaps = shadowMapNames(
    "Directional",
    directionalLights,
  );
  const pointShadowMaps = shadowMapNames("Point", pointLights);
  const spotShadowMaps = shadowMapNames("Spot", spotLights);
  const areaShadowMaps = shadowMapNames("Area", areaLights);
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
@group(1) @binding(${bindLight()}) var uReflectionMap: texture_2d<f32>;
@group(1) @binding(${bindLight()}) var uReflectionMapSampler: sampler;
${useTransmission ? `@group(1) @binding(${bindLight()}) var uCaptureTexture: texture_2d<f32>;\n@group(1) @binding(${bindLight()}) var uCaptureTextureSampler: sampler;` : ""}`
    : "";

  const ambientLightsBlock = Array.from(
    { length: ambientLights },
    (_, i) => `EvaluateAmbientLight(&data, uAmbientLights[${i}], data.ao);`,
  ).join("\n  ");
  const directionalLightsBlock = directionalShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluateDirectionalLight(&data, uDirectionalLights[${i}], ${shadowMap}, ${shadowMap}Sampler, input.positionWorld, input.position.xy);`,
    )
    .join("\n  ");
  const pointLightsBlock = pointShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluatePointLight(&data, uPointLights[${i}], ${shadowMap}, ${shadowMap}Sampler, input.position.xy);`,
    )
    .join("\n  ");
  const spotLightsBlock = spotShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluateSpotLight(&data, uSpotLights[${i}], ${shadowMap}, ${shadowMap}Sampler, input.positionWorld, input.position.xy);`,
    )
    .join("\n  ");
  const areaLightsBlock = areaShadowMaps
    .map(
      (shadowMap, i) =>
        `EvaluateAreaLight(&data, uAreaLights[${i}], ${shadowMap}, ${shadowMap}Sampler, uLtc1, uLtc1Sampler, uLtc2, uLtc2Sampler, data.ao, input.positionWorld, uFrame.cameraPosition, input.position.xy);`,
    )
    .join("\n  ");

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

  const unlitBody = /* wgsl */ `
  ${
    useBaseColorTexture
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
  ${useTangents ? "data.tangentView = normalize(input.tangentView) * frontFacingSign;" : ""}
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
    useNormalTexture
      ? `getNormalTextured(&data, uNormalTexture, uNormalTextureSampler, uMaterial.normalTextureScale, ${tc("normal")}, uMaterial.normalTextureMatrix, frontFacing);`
      : "getNormal(&data);"
  }

  ${
    useEmissiveColorTexture
      ? `getEmissiveColorTextured(&data, ${useEmissiveColor ? "uMaterial.emissiveColor" : "vec4f(1.0)"}, ${useEmissiveColor ? "uMaterial.emissiveIntensity" : "1.0"}, uEmissiveColorTexture, uEmissiveColorTextureSampler, ${tc("emissiveColor")}, uMaterial.emissiveColorTextureMatrix, ${vColorExpr});`
      : useEmissiveColor
        ? `getEmissiveColorFactor(&data, uMaterial.emissiveColor, uMaterial.emissiveIntensity, ${vColorExpr});`
        : "getEmissiveColor(&data);"
  }

  ${
    useMetallicRoughnessWorkflow
      ? /* wgsl */ `
  ${
    useBaseColorTexture
      ? `getBaseColorTextured(&data, uMaterial.baseColor, uBaseColorTexture, uBaseColorTextureSampler, ${tc("baseColor")}, uMaterial.baseColorTextureMatrix, ${vColorExpr});`
      : `getBaseColor(&data, uMaterial.baseColor, ${vColorExpr});`
  }
  ${
    metallicRoughnessTex
      ? `getMetallicRoughnessTextured(&data, uMaterial.metallic, uMaterial.roughness, uMetallicRoughnessTexture, uMetallicRoughnessTextureSampler, ${tc("metallicRoughness")}, uMaterial.metallicRoughnessTextureMatrix);`
      : `${metallicTex ? `getMetallicTextured(&data, uMaterial.metallic, uMetallicTexture, uMetallicTextureSampler, ${tc("metallic")}, uMaterial.metallicTextureMatrix);` : "getMetallic(&data, uMaterial.metallic);"}
  ${roughnessTex ? `getRoughnessTextured(&data, uMaterial.roughness, uRoughnessTexture, uRoughnessTextureSampler, ${tc("roughness")}, uMaterial.roughnessTextureMatrix);` : "getRoughness(&data, uMaterial.roughness);"}`
  }
  data.roughness = clamp(data.roughness, MIN_ROUGHNESS, 1.0);`
      : ""
  }

  ${
    useSpecularGlossinessWorkflow
      ? /* wgsl */ `
  let sgDiffuseRGBA = ${diffuseTex ? `getDiffuseTextured(uMaterial.sgDiffuse, data, uDiffuseTexture, uDiffuseTextureSampler, ${tc("diffuse")}, uMaterial.diffuseTextureMatrix);` : "getDiffuse(uMaterial.sgDiffuse);"}
  let sgSpecGloss = ${specularGlossinessTex ? `getSpecularGlossinessTextured(uMaterial.sgSpecular, uMaterial.sgGlossiness, data, uSpecularGlossinessTexture, uSpecularGlossinessTextureSampler, ${tc("specularGlossiness")}, uMaterial.specularGlossinessTextureMatrix);` : "getSpecularGlossiness(uMaterial.sgSpecular, uMaterial.sgGlossiness);"}
  getBaseColorAndMetallicRoughnessFromSpecularGlossiness(&data, sgSpecGloss, sgDiffuseRGBA, ${vColorExpr});`
      : ""
  }

  ${alphaBlock()}

  ${
    useClearCoat
      ? /* wgsl */ `
  ${clearCoatTex ? `getClearCoatTextured(&data, uMaterial.clearCoat, uMaterial.clearCoatRoughness, uClearCoatTexture, uClearCoatTextureSampler, ${tc("clearCoat")}, uMaterial.clearCoatTextureMatrix);` : "getClearCoat(&data, uMaterial.clearCoat);"}
  ${
    clearCoatRoughnessTex
      ? `getClearCoatRoughnessTextured(&data, uMaterial.clearCoatRoughness, uClearCoatRoughnessTexture, uClearCoatRoughnessTextureSampler, ${tc("clearCoatRoughness")}, uMaterial.clearCoatRoughnessTextureMatrix);`
      : useClearCoatRoughnessFromMainTexture
        ? ""
        : "getClearCoatRoughness(&data, uMaterial.clearCoatRoughness);"
  }
  data.clearCoatLinearRoughness = data.clearCoatRoughness * data.clearCoatRoughness;
  data.f0 = mix(data.f0, f0ClearCoatToSurface(data.f0), data.clearCoat);
  data.roughness = max(data.roughness, data.clearCoatRoughness);
  ${
    clearCoatNormalTex
      ? `getClearCoatNormalTextured(&data, uClearCoatNormalTexture, uClearCoatNormalTextureSampler, uMaterial.clearCoatNormalTextureScale, ${tc("clearCoatNormal")}, uMaterial.clearCoatNormalTextureMatrix, frontFacing);`
      : "getClearCoatNormal(&data, input.normalWorld);"
  }`
      : ""
  }

  ${
    useSheen
      ? /* wgsl */ `
  ${sheenColorTex ? `getSheenColorTextured(&data, uMaterial.sheenColor, uMaterial.sheenRoughness, uSheenColorTexture, uSheenColorTextureSampler, ${tc("sheenColor")}, uMaterial.sheenColorTextureMatrix);` : "getSheenColor(&data, uMaterial.sheenColor);"}
  ${
    sheenRoughnessTex
      ? `getSheenRoughnessTextured(&data, uMaterial.sheenRoughness, uSheenRoughnessTexture, uSheenRoughnessTextureSampler, ${tc("sheenRoughness")}, uMaterial.sheenRoughnessTextureMatrix);`
      : useSheenRoughnessFromMainTexture
        ? ""
        : "getSheenRoughness(&data, uMaterial.sheenRoughness);"
  }
  getSheenAlbedoScaling(&data);
  data.sheenRoughness = max(data.sheenRoughness, MIN_ROUGHNESS);
  data.sheenLinearRoughness = data.sheenRoughness * data.sheenRoughness;`
      : ""
  }

  ${
    useTransmission
      ? /* wgsl */ `
  data.transmitted = vec3f(0.0);
  ${useDispersion ? "data.dispersion = uMaterial.dispersion;" : ""}
  ${transmissionTex ? `getTransmissionTextured(&data, uMaterial.transmission, uTransmissionTexture, uTransmissionTextureSampler, ${tc("transmission")}, uMaterial.transmissionTextureMatrix);` : "getTransmission(&data, uMaterial.transmission);"}`
      : ""
  }
  ${
    useVolume
      ? /* wgsl */ `
  ${thicknessTex ? `getThicknessTextured(&data, uMaterial.thickness, uThicknessTexture, uThicknessTextureSampler, ${tc("thickness")}, uMaterial.thicknessTextureMatrix);` : "getThickness(&data, uMaterial.thickness);"}
  getAttenuation(&data, uMaterial.attenuationColor, uMaterial.attenuationDistance);`
      : ""
  }
  ${
    useDiffuseTransmission
      ? useDiffuseTransmissionTexture || useDiffuseTransmissionColorTexture
        ? `getDiffuseTransmissionTextured(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, ${useDiffuseTransmissionTexture ? "uDiffuseTransmissionTexture, uDiffuseTransmissionTextureSampler" : "uDiffuseTransmissionColorTexture, uDiffuseTransmissionColorTextureSampler"}, ${tc("diffuseTransmission")}, ${useDiffuseTransmissionTexture ? "uMaterial.diffuseTransmissionTextureMatrix" : "uMaterial.diffuseTransmissionColorTextureMatrix"}, ${useDiffuseTransmissionColorTexture ? "uDiffuseTransmissionColorTexture, uDiffuseTransmissionColorTextureSampler" : "uDiffuseTransmissionTexture, uDiffuseTransmissionTextureSampler"}, ${tc("diffuseTransmissionColor")}, ${useDiffuseTransmissionColorTexture ? "uMaterial.diffuseTransmissionColorTextureMatrix" : "uMaterial.diffuseTransmissionTextureMatrix"}, uModel.modelMatrix);`
        : `getDiffuseTransmission(&data, uMaterial.diffuseTransmission, uMaterial.diffuseTransmissionColor, uModel.modelMatrix);`
      : ""
  }

  ${useOcclusionTexture ? `getAmbientOcclusion(&data, uOcclusionTexture, uOcclusionTextureSampler, ${tc("occlusion")}, uMaterial.occlusionTextureMatrix);` : ""}

  ${hooks.fragBeforeLighting ?? ""}

  data.diffuseColor = data.baseColor * (1.0 - data.metallic);
  data.linearRoughness = data.roughness * data.roughness;

  ${
    useMetallicRoughnessWorkflow
      ? /* wgsl */ `
  getIor(&data, uMaterial.ior);
  ${
    useSpecular
      ? useSpecularTexture || useSpecularColorTexture
        ? `getSpecularFactorTextured(&data, uMaterial.specular, uMaterial.specularColor, ${useSpecularTexture ? "uSpecularTexture, uSpecularTextureSampler" : "uSpecularColorTexture, uSpecularColorTextureSampler"}, ${tc("specular")}, ${useSpecularTexture ? "uMaterial.specularTextureMatrix" : "uMaterial.specularColorTextureMatrix"}, ${useSpecularColorTexture ? "uSpecularColorTexture, uSpecularColorTextureSampler" : "uSpecularTexture, uSpecularTextureSampler"}, ${tc("specularColor")}, ${useSpecularColorTexture ? "uMaterial.specularColorTextureMatrix" : "uMaterial.specularTextureMatrix"});`
        : "getSpecularFactor(&data, uMaterial.specular, uMaterial.specularColor);"
      : "getSpecular(&data);"
  }`
      : ""
  }

  ${
    useReflectionProbes
      ? /* wgsl */ `
  data.reflectionWorld = reflect(-data.eyeDirWorld, data.normalWorld);
  EvaluateLightProbe(&data, data.ao, uReflectionMap, uReflectionMapSampler, uFrame.viewportSize.x, ${useTransmission ? "uCaptureTexture, uCaptureTextureSampler" : "uReflectionMap, uReflectionMapSampler"}, uFrame.viewportSize, uModel.modelMatrix, uFrame.projectionMatrix, uFrame.viewMatrix);`
      : ""
  }

  ${ambientLightsBlock}
  ${directionalLightsBlock}
  ${pointLightsBlock}
  ${spotLightsBlock}
  ${areaLightsBlock}

  ${hooks.fragAfterLighting ?? ""}

  color = data.emissiveColor + data.indirectDiffuse + data.indirectSpecular + data.directColor + data.transmitted;`;

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
  ${useEmissiveColor ? "emissiveColor: vec4f,\n  emissiveIntensity: f32," : ""}
  ${matrixField("emissiveColor", emissiveColorTex)}
  ${normalTex ? "normalTextureScale: f32,\n  normalTextureMatrix: mat3x3f," : ""}
  ${metallicRoughnessFields}
  ${specularGlossinessFields}
  ${clearCoatFields}
  ${sheenFields}
  ${transmissionFields}
  ${volumeFields}
  ${diffuseTransmissionFields}
  ${occlusionTex ? "occlusionTextureMatrix: mat3x3f," : ""}
}
@group(2) @binding(0) var<uniform> uMaterial: Material;
${textureDecl("uBaseColorTexture", baseColorTex)}
${textureDecl("uAlphaTexture", alphaTex)}
${textureDecl("uEmissiveColorTexture", emissiveColorTex)}
${textureDecl("uNormalTexture", normalTex)}
${textureDecl("uMetallicRoughnessTexture", metallicRoughnessTex)}
${textureDecl("uMetallicTexture", metallicTex)}
${textureDecl("uRoughnessTexture", roughnessTex)}
${textureDecl("uSpecularTexture", specularTex)}
${textureDecl("uSpecularColorTexture", specularColorTex)}
${textureDecl("uDiffuseTexture", diffuseTex)}
${textureDecl("uSpecularGlossinessTexture", specularGlossinessTex)}
${textureDecl("uClearCoatTexture", clearCoatTex)}
${textureDecl("uClearCoatRoughnessTexture", clearCoatRoughnessTex)}
${textureDecl("uClearCoatNormalTexture", clearCoatNormalTex)}
${textureDecl("uSheenColorTexture", sheenColorTex)}
${textureDecl("uSheenRoughnessTexture", sheenRoughnessTex)}
${textureDecl("uTransmissionTexture", transmissionTex)}
${textureDecl("uThicknessTexture", thicknessTex)}
${textureDecl("uDiffuseTransmissionTexture", diffuseTransmissionTex)}
${textureDecl("uDiffuseTransmissionColorTexture", diffuseTransmissionColorTex)}
${textureDecl("uOcclusionTexture", occlusionTex)}

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

struct VertexInput {
  @location(0) position: vec3f,
  ${useNormals ? "@location(1) normal: vec3f," : ""}
  ${useTangents ? "@location(2) tangent: vec4f," : ""}
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
  @location(0) normalWorld: vec3f,
  @location(1) normalView: vec3f,
  @location(2) texCoord0: vec2f,
  ${useTexCoord1 ? "@location(3) texCoord1: vec2f," : ""}
  @location(4) positionWorld: vec3f,
  @location(5) positionView: vec3f,
  ${useTangents ? "@location(6) tangentView: vec4f," : ""}
  ${useColor ? "@location(7) color: vec4f," : ""}
}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
}

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
override USE_TEXCOORD_1: bool = ${useTexCoord1};
override USE_TANGENTS: bool = ${useTangents};
override USE_NORMAL_TEXTURE: bool = ${useNormalTexture};
override USE_CLEAR_COAT_NORMAL_TEXTURE: bool = ${useClearCoatNormalTexture};
override USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE: bool = ${useClearCoatRoughnessFromMainTexture};
override USE_SHEEN_ROUGHNESS_FROM_MAIN_TEXTURE: bool = ${useSheenRoughnessFromMainTexture};
override USE_SHEEN: bool = ${useSheen};
override USE_CLEAR_COAT: bool = ${useClearCoat};
override USE_DIFFUSE_TRANSMISSION: bool = ${useDiffuseTransmission};
override USE_VOLUME: bool = ${useVolume};
override USE_TRANSMISSION: bool = ${useTransmission};
override USE_DISPERSION: bool = ${useDispersion};
override USE_SSAO_COLORS: bool = false;
override DEPTH_PACK_FAR: f32 = 10.0;

// Vertex includes
${SHADERS.math.quatToMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  var position = vec4f(input.position, 1.0);
  var normal = vec3f(0.0, 0.0, 0.0);
  ${useNormals ? "normal = input.normal;" : ""}
  ${useTangents ? "var tangent = input.tangent;" : ""}

  var texCoord = vec2f(0.0, 0.0);
  ${useTexCoord0 ? "texCoord = input.texCoord0;" : ""}
  output.texCoord0 = texCoord;

  ${useTexCoord1 ? "output.texCoord1 = input.texCoord1;" : ""}

  ${hooks.vertBeforeTransform ?? ""}

  ${
    useDisplacementTexture
      ? "let h = textureSampleLevel(uDisplacementTexture, uDisplacementTextureSampler, input.texCoord0, 0.0).x;\n  position = vec4f(position.xyz + uModel.displacement * h * normal, position.w);"
      : ""
  }

  var positionWorld: vec4f;
  ${
    useSkin
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

  ${useTangents ? "tangent = skinMat * vec4f(tangent.xyz, 0.0);" : ""}

  output.normalView = (uFrame.viewMatrix * vec4f(normal, 0.0)).xyz;`
      : `${useInstancedScale ? "position = vec4f(position.xyz * input.scale, position.w);\n  " : ""}${useInstancedRotation ? "let rotationMat = quatToMat4(input.rotation);\n  position = rotationMat * position;\n  normal = (rotationMat * vec4f(normal, 0.0)).xyz;\n  " : ""}${useInstancedOffset ? "position = vec4f(position.xyz + input.offset, position.w);\n  " : ""}
  positionWorld = uModel.modelMatrix * position;
  output.normalView = uModel.normalMatrix * normal;`
  }

  ${colorAssignment}

  output.normalWorld = normalize((uFrame.inverseViewMatrix * vec4f(output.normalView, 0.0)).xyz);

  let positionView = uFrame.viewMatrix * positionWorld;
  let positionOut = uFrame.projectionMatrix * positionView;

  output.positionWorld = positionWorld.xyz / positionWorld.w;
  output.positionView = positionView.xyz / positionView.w;
  output.position = positionOut;

  ${useTangents ? "output.tangentView = vec4f((uModel.normalMatrix * tangent.xyz), tangent.w);" : ""}

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
${SHADERS.ambientOcclusion}
${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

${
  useUnlitWorkflow
    ? ""
    : `
  // Lighting
  ${SHADERS.octMap}
  ${SHADERS.depthUnpack}
  ${SHADERS.depthRead}
  ${SHADERS.normalPerturb}
  ${SHADERS.irradiance}
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
  input: Varyings,
  @builtin(front_facing) frontFacing: bool
) -> FragmentOutput {
  var output: FragmentOutput;
  var color: vec3f;

  var data: PBRData;
  data.texCoord0 = input.texCoord0;
  ${useTexCoord1 ? "data.texCoord1 = input.texCoord1;" : ""}

  ${useUnlitWorkflow ? unlitBody : litBody}

  ${useMSAA ? "color = reversibleToneMap(color);" : ""}

  color = max(color, vec3f(0.0));

  output.color = vec4f(color, 1.0);

  ${useNormalOutput ? "output.normal = vec4f(data.normalView * 0.5 + 0.5, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(data.emissiveColor, 1.0);" : ""}
  ${useBlend || useTransmission ? "output.color.w = data.opacity;" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
