import { chunks as SHADERS } from "pex-shaders";

import { vertexOutputStruct, textureSamplerDeclaration } from "./wgsl.js";
import { ROUGHNESS_LEVELS } from "./reflection-probe.js";
import type { PipelineShaderOptions } from "../types.js";

// Draws an equirectangular environment map (a baked analytic sky or a user
// envMap) as the scene background. A fullscreen triangle (attribute @location(0)
// position: vec2f, clip-space corners) is unprojected into a world-space view
// direction and used to sample the equirect map.
//
// The env map is already linear (a float HDR map, or the sky baked into an
// rgba8unorm-srgb texture that decodes on sample), so no decode is needed; the
// result feeds the linear HDR main pass.
//
// USE_BACKGROUND_BLUR swaps the equirect sample for the reflection-probe's
// prefiltered specular cubemap (see shaders/reflection-probe.ts), reusing the
// same GGX mip chain material shading samples instead of a dedicated blur
// pass. skybox.backgroundBlur (0-1) maps linearly to lod, matching
// getPrefilteredReflection's roughness->lod convention.

export const skyboxShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

  const useMSAA = defines.has("USE_MSAA");
  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;
  const useBackgroundBlur = defines.has("USE_BACKGROUND_BLUR");

  return /* wgsl */ `
struct Skybox {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  exposure: f32,
  backgroundBlur: f32,
  rotation: mat3x3f,
}
@group(0) @binding(0) var<uniform> uSkybox: Skybox;
@group(0) @binding(1) var uEnvMap: texture_2d<f32>;
@group(0) @binding(2) var uEnvMapSampler: sampler;
${useBackgroundBlur ? textureSamplerDeclaration(0, { texture: 3, sampler: 4 }, "uSpecularEnvMap", "texture_cube<f32>") : ""}
${useBackgroundBlur ? `override ROUGHNESS_LEVELS: f32 = ${ROUGHNESS_LEVELS}.0;` : ""}

struct VertexInput {
  @location(0) position: vec2f,
}

${vertexOutputStruct([{ name: "normal", type: "vec3f" }])}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
}

// Vertex includes
${SHADERS.math.inverseMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let inverseProjection = inverseMat4(uSkybox.projectionMatrix);
  let inverseModelView = transpose(mat3x3f(
    uSkybox.viewMatrix[0].xyz,
    uSkybox.viewMatrix[1].xyz,
    uSkybox.viewMatrix[2].xyz,
  ));
  let unprojected = (inverseProjection * vec4f(input.position, 0.0, 1.0)).xyz;
  output.normal = (uSkybox.modelMatrix * vec4f(inverseModelView * unprojected, 1.0)).xyz;

  // z = 1.0 sits at the ZO far plane so geometry (depthCompare less-equal) wins.
  output.position = vec4f(input.position, 1.0, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}
${SHADERS.math.max3}
${SHADERS.envMapEquirect}
${SHADERS.reversibleToneMap}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;

  let N = normalize(input.normal);
  ${
    useBackgroundBlur
      ? `let lod = uSkybox.backgroundBlur * (ROUGHNESS_LEVELS - 1.0);
  var color = textureSampleLevel(uSpecularEnvMap, uSpecularEnvMapSampler, uSkybox.rotation * N, lod);`
      : `var color = textureSample(uEnvMap, uEnvMapSampler, envMapEquirect(N));`
  }
  color = vec4f(color.rgb * uSkybox.exposure, color.a);

  ${useMSAA ? "color = vec4f(reversibleToneMap(color.xyz), color.w);" : ""}

  output.color = color;

  ${useNormalOutput ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
