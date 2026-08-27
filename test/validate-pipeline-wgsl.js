// Compiles representative option combinations of the WGSL pipeline shaders
// (shaders/*.js) through Dawn's real WGSL front-end, the same way pex-shaders'
// test/validate-wgsl.js does for its chunks.
//
// Pipeline shaders are self-contained generator functions -
// (defines, options) => wgslString - each producing one module with both a
// @vertex and a @fragment entry point, so each variant below is compiled as
// a single complete module, no stub types/overrides needed.
//
// Imported from lib/, so it needs a build first (like test/frame-graph.js).

import { create, globals } from "webgpu";

// Before importing the shaders: they reach pex-gpu, which reads WebGPU
// constants (GPUBufferUsage and friends) at module evaluation time.
Object.assign(globalThis, globals);

const shaders = await import("../lib/shaders/index.js");

const {
  basic,
  standard,
  blit,
  reversibleToneMap,
  depthPass,
  depthResolve,
  line,
  overlay,
  helper,
  error,
  sky,
  postProcessing,
} = shaders;

const gpu = create([]);
const adapter = await gpu.requestAdapter();
if (!adapter) {
  console.error("No WebGPU adapter available in this environment.");
  process.exit(1);
}
const device = await adapter.requestDevice();

let errorCount = 0;
let warningCount = 0;

async function check(label, code) {
  const module = device.createShaderModule({ code });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === "error");
  const warnings = info.messages.filter((m) => m.type === "warning");
  errorCount += errors.length;
  warningCount += warnings.length;

  if (errors.length === 0) {
    console.log(`ok - ${label}`);
    return;
  }

  console.log(`FAIL - ${label}`);
  const lines = code.split("\n");
  for (const message of info.messages) {
    console.log(`  [${message.type}] ${message.lineNum}:${message.linePos} ${message.message}`);
    if (message.lineNum) {
      const start = Math.max(0, message.lineNum - 2);
      const end = Math.min(lines.length, message.lineNum + 1);
      for (let i = start; i < end; i++) console.log(`    ${i + 1}: ${lines[i]}`);
    }
  }
}

const basicVariants = [
  { name: "default", defines: new Set() },
  { name: "vertex+instanced color", defines: new Set(["USE_VERTEX_COLORS", "USE_INSTANCED_COLOR"]) },
  { name: "full instancing", defines: new Set(["USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION", "USE_INSTANCED_COLOR"]) },
  { name: "MSAA + draw buffers", defines: new Set(["USE_MSAA"]), options: { outputs: { normal: true, emissive: true, velocity: true } } },
  { name: "hooks", defines: new Set(["USE_VERTEX_COLORS"]), options: { hooks: { vertBeforeTransform: "// hook", fragEnd: "// hook" } } },
];

const VELOCITY = { outputs: { normal: true, emissive: true, velocity: true } };
const standardVariants = [
  { name: "minimal unlit", defines: new Set(["USE_UNLIT_WORKFLOW"]) },
  // Motion vectors, once per way a vertex can move. Each takes a different
  // route through vertexPreviousWorld, and a route that does not compile is a
  // whole class of geometry silently ghosting.
  { name: "velocity [rigid]", defines: new Set(["USE_NORMALS"]), options: VELOCITY },
  { name: "velocity [skinned]", defines: new Set(["USE_NORMALS", "USE_SKIN"]), options: { ...VELOCITY, maxJoints: 64 } },
  { name: "velocity [morphed]", defines: new Set(["USE_NORMALS", "USE_PREVIOUS_POSITION"]), options: VELOCITY },
  { name: "velocity [static instancing]", defines: new Set(["USE_NORMALS", "USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION"]), options: VELOCITY },
  { name: "velocity [animated instancing]", defines: new Set(["USE_NORMALS", "USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION", "USE_PREVIOUS_INSTANCED_OFFSET", "USE_PREVIOUS_INSTANCED_SCALE", "USE_PREVIOUS_INSTANCED_ROTATION"]), options: VELOCITY },
  { name: "velocity [skinned + morphed + animated instancing]", defines: new Set(["USE_NORMALS", "USE_SKIN", "USE_PREVIOUS_POSITION", "USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION", "USE_PREVIOUS_INSTANCED_OFFSET", "USE_PREVIOUS_INSTANCED_SCALE", "USE_PREVIOUS_INSTANCED_ROTATION"]), options: { ...VELOCITY, maxJoints: 64 } },
  { name: "unlit + basecolor tex + alpha test", defines: new Set(["USE_UNLIT_WORKFLOW", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEXTURE", "USE_ALPHA_TEST"]) },
  { name: "metallic-roughness no textures no lights", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW"]) },
  { name: "mr + basecolor + normal + 1 directional", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_NORMAL_TEXTURE", "USE_TANGENTS"]), options: { lights: { directional: 1 } } },
  { name: "all light types at max", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS"]), options: { lights: { ambient: 4, directional: 4, point: 4, spot: 4, area: 4 } } },
  // Shadow buckets: one binding per distinct map size, dispatched at runtime.
  // The no-bucket case matters as much as the rest — the dispatchers still have
  // to compile when nothing casts.
  { name: "shadows, single bucket", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS"]), options: { lights: { directional: 1, spot: 1, area: 1, point: 1, shadow2DBuckets: 1, shadowCubeBuckets: 1 } } },
  { name: "shadows, mixed sizes", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS"]), options: { lights: { directional: 2, spot: 2, point: 2, shadow2DBuckets: 3, shadowCubeBuckets: 2 } } },
  { name: "shadows, casters absent", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS"]), options: { lights: { directional: 2, point: 1, shadow2DBuckets: 0, shadowCubeBuckets: 0 } } },
  { name: "reflection probes + transmission", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_REFLECTION_PROBES", "USE_TRANSMISSION", "USE_TRANSMISSION_TEXTURE", "USE_DISPERSION", "USE_TEXCOORD_0"]), options: { lights: { directional: 1 } } },
  { name: "clear coat + sheen + tangents", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_CLEAR_COAT", "USE_CLEAR_COAT_TEXTURE", "USE_CLEAR_COAT_NORMAL_TEXTURE", "USE_SHEEN", "USE_SHEEN_COLOR_TEXTURE", "USE_TANGENTS"]), options: { lights: { point: 2 } } },
  { name: "clear coat roughness from main texture", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_CLEAR_COAT", "USE_CLEAR_COAT_TEXTURE", "USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE"]) },
  { name: "specular-glossiness", defines: new Set(["USE_SPECULAR_GLOSSINESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_DIFFUSE_TEXTURE", "USE_SPECULAR_GLOSSINESS_TEXTURE"]), options: { lights: { directional: 1 } } },
  { name: "specular workflow (KHR)", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_SPECULAR", "USE_SPECULAR_TEXTURE", "USE_SPECULAR_COLOR_TEXTURE"]) },
  { name: "volume + diffuse transmission", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_TRANSMISSION", "USE_VOLUME", "USE_THICKNESS_TEXTURE", "USE_DIFFUSE_TRANSMISSION", "USE_DIFFUSE_TRANSMISSION_TEXTURE", "USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE"]) },
  { name: "emissive + occlusion + msaa + drawbuffers", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_EMISSIVE_COLOR", "USE_EMISSIVE_COLOR_TEXTURE", "USE_OCCLUSION_TEXTURE", "USE_MSAA"]), options: { outputs: { normal: true, emissive: true, velocity: true } } },
  { name: "vertex colors + blend", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_VERTEX_COLORS", "USE_BLEND"]) },
  { name: "texcoord1 everywhere", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_TEXCOORD_1", "USE_BASE_COLOR_TEXTURE"]), options: { texCoords: { baseColor: 1 } } },
  { name: "skinned", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TANGENTS", "USE_TEXCOORD_0", "USE_SKIN"]) },
  { name: "displacement", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_DISPLACEMENT_TEXTURE"]) },
  {
    name: "kitchen sink",
    defines: new Set([
      "USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TANGENTS", "USE_TEXCOORD_0", "USE_TEXCOORD_1", "USE_VERTEX_COLORS",
      "USE_SKIN", "USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION",
      "USE_BASE_COLOR_TEXTURE", "USE_NORMAL_TEXTURE", "USE_METALLIC_ROUGHNESS_TEXTURE",
      "USE_EMISSIVE_COLOR", "USE_EMISSIVE_COLOR_TEXTURE", "USE_OCCLUSION_TEXTURE",
      "USE_CLEAR_COAT", "USE_CLEAR_COAT_TEXTURE", "USE_CLEAR_COAT_ROUGHNESS_TEXTURE", "USE_CLEAR_COAT_NORMAL_TEXTURE",
      "USE_SHEEN", "USE_SHEEN_COLOR_TEXTURE", "USE_SHEEN_ROUGHNESS_TEXTURE",
      "USE_TRANSMISSION", "USE_TRANSMISSION_TEXTURE", "USE_DISPERSION",
      "USE_VOLUME", "USE_THICKNESS_TEXTURE",
      "USE_DIFFUSE_TRANSMISSION", "USE_DIFFUSE_TRANSMISSION_TEXTURE", "USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE",
      "USE_ALPHA_TEXTURE", "USE_ALPHA_TEST", "USE_REFLECTION_PROBES", "USE_MSAA", "USE_BLEND",
    ]),
    options: { maxJoints: 64, lights: { ambient: 1, directional: 2, point: 2, spot: 1, area: 1 }, outputs: { normal: true, emissive: true, velocity: true } },
  },
  { name: "hooks", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS"]), options: { hooks: { vertBeforeTransform: "// hook", vertEnd: "// hook", fragBeforeTextures: "// hook", fragBeforeLighting: "// hook", fragAfterLighting: "// hook", fragEnd: "// hook" } } },
];

const blitVariants = [
  { name: "default", defines: new Set() },
  { name: "hooks", defines: new Set(), options: { hooks: { fragDeclarationsEnd: "// hook", fragEnd: "// hook" } } },
];

const reversibleToneMapVariants = [
  { name: "default", defines: new Set() },
  { name: "hooks", defines: new Set(), options: { hooks: { fragDeclarationsEnd: "// hook", fragEnd: "// hook" } } },
];

const depthPassVariants = [
  { name: "default", defines: new Set() },
  { name: "alpha texture + alpha test", defines: new Set(["USE_NORMALS", "USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEXTURE", "USE_ALPHA_TEST"]) },
  { name: "skinned + instanced + vertex colors", defines: new Set(["USE_NORMALS", "USE_SKIN", "USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION", "USE_VERTEX_COLORS"]), options: { maxJoints: 64 } },
  { name: "displacement + texcoord1", defines: new Set(["USE_NORMALS", "USE_TEXCOORD_0", "USE_TEXCOORD_1", "USE_DISPLACEMENT_TEXTURE"]) },
  { name: "alpha test + vertex/instance colors", defines: new Set(["USE_ALPHA_TEST", "USE_VERTEX_COLORS", "USE_INSTANCED_COLOR"]) },
  { name: "alpha test on texcoord1", defines: new Set(["USE_TEXCOORD_0", "USE_TEXCOORD_1", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEST"]), options: { texCoords: { baseColor: 1 } } },
  { name: "alpha test + omni (linear depth)", defines: new Set(["USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEST", "USE_LINEAR_DEPTH"]) },
  { name: "hooks", defines: new Set(), options: { hooks: { vertBeforeTransform: "// hook", vertEnd: "// hook", fragDeclarationsEnd: "// hook", fragEnd: "// hook" } } },
];

// The pre-pass variant: same vertex path as a shadow map, plus a normal target.
const depthPassPrePassVariants = [
  { name: "normal output", defines: new Set(["USE_NORMALS", "USE_NORMAL_OUTPUT"]) },
  { name: "normal output + skinned", defines: new Set(["USE_NORMALS", "USE_NORMAL_OUTPUT", "USE_SKIN"]), options: { maxJoints: 64 } },
  { name: "normal output + instanced", defines: new Set(["USE_NORMALS", "USE_NORMAL_OUTPUT", "USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION"]) },
  { name: "normal output + displacement", defines: new Set(["USE_NORMALS", "USE_NORMAL_OUTPUT", "USE_TEXCOORD_0", "USE_DISPLACEMENT_TEXTURE"]) },
  { name: "normal output + alpha test", defines: new Set(["USE_NORMALS", "USE_NORMAL_OUTPUT", "USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEXTURE", "USE_ALPHA_TEST"]) },
  { name: "normal output + alpha to coverage", defines: new Set(["USE_NORMALS", "USE_NORMAL_OUTPUT", "USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEST", "USE_ALPHA_TO_COVERAGE"]) },
  // Coverage where it cannot apply: no color target means no alpha to derive
  // the mask from, so it has to fall back to discarding rather than emit a
  // coverage value nothing reads.
  { name: "depth-only rejects alpha to coverage", defines: new Set(["USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEST", "USE_ALPHA_TO_COVERAGE"]) },
];

const lineVariants = [
  { name: "default", defines: new Set() },
  { name: "vertex colors + perspective scaling", defines: new Set(["USE_VERTEX_COLORS", "USE_PERSPECTIVE_SCALING"]) },
  { name: "instanced line width + msaa + drawbuffers", defines: new Set(["USE_INSTANCED_LINE_WIDTH", "USE_MSAA"]), options: { outputs: { normal: true, emissive: true, velocity: true } } },
  { name: "hooks", defines: new Set(["USE_VERTEX_COLORS"]), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const overlayVariants = [
  { name: "default", defines: new Set() },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const helperVariants = [
  { name: "default", defines: new Set() },
  { name: "msaa + drawbuffers", defines: new Set(["USE_MSAA"]), options: { outputs: { normal: true, emissive: true, velocity: true } } },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const errorVariants = [
  { name: "default", defines: new Set() },
  { name: "drawbuffers", defines: new Set(), options: { outputs: { normal: true, emissive: true, velocity: true } } },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const skyVariants = [
  { name: "default", defines: new Set() },
  { name: "drawbuffers", defines: new Set(), options: { outputs: { normal: true, emissive: true, velocity: true } } },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

// One entry per post-processing sub-pass shader, at every define combination
// the effect descriptors can produce.
const postProcessingVariants = [
  { name: "threshold [color source]", shader: postProcessing.thresholdShader, defines: new Set(["USE_SOURCE_COLOR"]) },
  { name: "threshold [emissive source]", shader: postProcessing.thresholdShader, defines: new Set(["USE_SOURCE_EMISSIVE", "USE_EMISSIVE_TEXTURE"]) },
  { name: "threshold [color + emissive, luminance]", shader: postProcessing.thresholdShader, defines: new Set(["USE_EMISSIVE_TEXTURE", "COLOR_FUNCTION_LUMINANCE"]) },
  { name: "threshold [average]", shader: postProcessing.thresholdShader, defines: new Set(["COLOR_FUNCTION_AVERAGE"]) },
  { name: "downsample [box]", shader: postProcessing.downsampleShader, defines: new Set(["QUALITY_0"]) },
  { name: "downsample [anti-flicker]", shader: postProcessing.downsampleShader, defines: new Set() },
  { name: "upsample [bilinear]", shader: postProcessing.upsampleShader, defines: new Set(["QUALITY_0"]) },
  { name: "upsample [tent]", shader: postProcessing.upsampleShader, defines: new Set() },
  { name: "gtao prefilter", shader: postProcessing.gtaoPrefilterShader, defines: new Set() },
  { name: "gtao", shader: postProcessing.gtaoShader, defines: new Set() },
  { name: "gtao [edges]", shader: postProcessing.gtaoShader, defines: new Set(["USE_GTAO_EDGES"]) },
  { name: "gtao denoise", shader: postProcessing.gtaoDenoiseShader, defines: new Set() },
  { name: "sao", shader: postProcessing.saoShader, defines: new Set() },
  { name: "bilateral blur", shader: postProcessing.bilateralBlurShader, defines: new Set() },
  { name: "dof [gustafsson]", shader: postProcessing.dofShader, defines: new Set(["USE_DOF_GUSTAFSSON"]) },
  { name: "dof [upitis]", shader: postProcessing.dofShader, defines: new Set(["USE_DOF_UPITIS"]) },
  { name: "dof [focus on screen point]", shader: postProcessing.dofShader, defines: new Set(["USE_DOF_GUSTAFSSON", "USE_FOCUS_ON_SCREEN_POINT"]) },
  { name: "combine [bare]", shader: postProcessing.combineShader, defines: new Set() },
  { name: "combine [fog]", shader: postProcessing.combineShader, defines: new Set(["USE_FOG"]) },
  { name: "combine [bloom]", shader: postProcessing.combineShader, defines: new Set(["USE_BLOOM"]) },
  { name: "combine [grade]", shader: postProcessing.combineShader, defines: new Set(["USE_VIGNETTE", "USE_LUT", "USE_COLOR_CORRECTION"]) },
  { name: "combine [everything]", shader: postProcessing.combineShader, defines: new Set(["USE_FOG", "USE_BLOOM", "USE_VIGNETTE", "USE_LUT", "USE_COLOR_CORRECTION"]) },
  // Every operator: only the selected one is included, so a broken source shows
  // up in its own variant and nowhere else.
  ...postProcessing.TONE_MAP_OPERATORS.map((operator) => ({
    name: `combine [${operator}]`,
    shader: postProcessing.combineShader,
    defines: new Set([`${postProcessing.TONE_MAP_DEFINE}${operator}`]),
  })),
  { name: "smaa edges [luma]", shader: postProcessing.smaaEdgesShader, defines: new Set() },
  { name: "smaa edges [color]", shader: postProcessing.smaaEdgesShader, defines: new Set(["SMAA_EDGES_COLOR"]) },
  { name: "smaa edges [depth]", shader: postProcessing.smaaEdgesShader, defines: new Set(["SMAA_EDGES_DEPTH"]) },
  { name: "smaa weights", shader: postProcessing.smaaWeightsShader, defines: new Set() },
  { name: "smaa blend", shader: postProcessing.smaaBlendShader, defines: new Set() },
  { name: "taa [depth reprojection]", shader: postProcessing.taaShader, defines: new Set() },
  { name: "taa [velocity]", shader: postProcessing.taaShader, defines: new Set(["USE_TAA_VELOCITY"]) },
  { name: "luma", shader: postProcessing.lumaShader, defines: new Set() },
  { name: "final [opacity only]", shader: postProcessing.finalShader, defines: new Set() },
  { name: "final [fxaa]", shader: postProcessing.finalShader, defines: new Set(["USE_FXAA"]) },
  { name: "final [film grain]", shader: postProcessing.finalShader, defines: new Set(["USE_FILM_GRAIN"]) },
  { name: "final [fxaa + film grain]", shader: postProcessing.finalShader, defines: new Set(["USE_FXAA", "USE_FILM_GRAIN"]) },
];

for (const v of basicVariants) {
  await check(`basic [${v.name}]`, basic.basicShader(v.defines, v.options));
}
for (const v of standardVariants) {
  await check(`standard [${v.name}]`, standard.standardShader(v.defines, v.options));
}
for (const v of blitVariants) {
  await check(`blit [${v.name}]`, blit.blitShader(v.defines, v.options));
}
// One variant per MSAA level: the sample loop is unrolled per count.
for (const samples of [2, 4, 8]) {
  await check(`depthResolve [${samples}x]`, depthResolve.depthResolveShader(samples));
}
for (const v of reversibleToneMapVariants) {
  await check(`reversibleToneMap [${v.name}]`, reversibleToneMap.reversibleToneMapShader(v.defines, v.options));
}
for (const v of depthPassVariants) {
  await check(`depthPass [${v.name}]`, depthPass.depthPassShader(v.defines, v.options));
}
for (const v of depthPassPrePassVariants) {
  // getPrePassPipeline always adds this, so compile what actually runs.
  const defines = new Set([...v.defines, "USE_DEPTH_PRE_PASS"]);
  await check(`depthPass [${v.name}]`, depthPass.depthPassShader(defines, v.options));
}

for (const v of lineVariants) {
  await check(`line [${v.name}]`, line.lineShader(v.defines, v.options));
}
for (const v of overlayVariants) {
  await check(`overlay [${v.name}]`, overlay.overlayShader(v.defines, v.options));
}
for (const v of helperVariants) {
  await check(`helper [${v.name}]`, helper.helperShader(v.defines, v.options));
}
for (const v of errorVariants) {
  await check(`error [${v.name}]`, error.errorShader(v.defines, v.options));
}
for (const v of skyVariants) {
  await check(`sky [${v.name}]`, sky.skyShader(v.defines, v.options));
}
for (const v of postProcessingVariants) {
  await check(`postProcessing ${v.name}`, v.shader(v.defines));
}

// ─── The Model block only declares what its pass can be handed ──────────────
// pex-gpu throws on a member the struct does not declare (and silently zeroes a
// member no one writes), so every optional field here is a contract with the
// renderer that writes it. previousModelMatrix belongs to the passes that emit
// motion vectors and to no others — the shadow and pre-pass shaders share a
// Model block with no room for it.
{
  const members = (source) =>
    /struct Model \{([^}]*)\}/
      .exec(source)?.[1]
      .split(",")
      .map((line) => line.split(":")[0].trim())
      .filter(Boolean);

  const assertMembers = (label, source, expected) => {
    const actual = members(source);
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) errorCount++;
    console.log(`${ok ? "ok" : "not ok"} - Model block [${label}]`);
    if (!ok) {
      console.log(`     expected ${JSON.stringify(expected)}`);
      console.log(`     actual   ${JSON.stringify(actual)}`);
    }
  };

  const defines = new Set(["USE_NORMALS"]);
  const base = ["modelMatrix", "normalMatrix"];
  const withVelocity = [...base, "previousModelMatrix"];

  assertMembers("standard", standard.standardShader(defines, { outputs: {} }), base);
  assertMembers(
    "standard + velocity",
    standard.standardShader(defines, { outputs: { velocity: true } }),
    withVelocity,
  );
  assertMembers("basic", basic.basicShader(defines, { outputs: {} }), base);
  assertMembers(
    "basic + velocity",
    basic.basicShader(defines, { outputs: { velocity: true } }),
    withVelocity,
  );
  assertMembers("line", line.lineShader(new Set(), { outputs: {} }), base);
  assertMembers(
    "line + velocity",
    line.lineShader(new Set(), { outputs: { velocity: true } }),
    withVelocity,
  );
  // Shadow maps and the pre-pass, which never write motion vectors.
  assertMembers("depthPass", depthPass.depthPassShader(defines, { outputs: {} }), base);
  assertMembers(
    "depthPass + velocity output",
    depthPass.depthPassShader(defines, { outputs: { velocity: true } }),
    base,
  );

  // Last frame's joints double what a skinned entity uploads, so they are
  // declared only where they are read — and the renderer writes them on exactly
  // the same condition.
  const skinned = new Set(["USE_NORMALS", "USE_SKIN"]);
  const declaresPreviousJoints = (source) =>
    /@group\(3\) @binding\(4\) var<uniform> uPreviousJointMatrices/.test(source);
  for (const [label, source, expected] of [
    ["skinned", standard.standardShader(skinned, { outputs: {} }), false],
    ["skinned + velocity", standard.standardShader(skinned, { outputs: { velocity: true } }), true],
    ["unskinned + velocity", standard.standardShader(defines, { outputs: { velocity: true } }), false],
  ]) {
    const ok = declaresPreviousJoints(source) === expected;
    if (!ok) errorCount++;
    console.log(`${ok ? "ok" : "not ok"} - previous joints [${label}]`);
  }
}

// ─── The depth pre-pass has to agree with the pass that tests against it ─────
// Both of these are driver-dependent and will not show up reliably in a
// screenshot: the opaque pass loads the pre-pass depth and tests less-equal, so
// any disagreement about the computed position rejects the fragments that
// landed further away, which reads as hatching and dropouts across every
// surface rather than as an obvious error.
{
  const options = { outputs: {} };
  const withDisplacement = new Set([
    "USE_NORMALS",
    "USE_TEXCOORD_0",
    "USE_DISPLACEMENT_TEXTURE",
  ]);
  const standardSource = standard.standardShader(withDisplacement, options);
  const prePassSource = depthPass.depthPassShader(
    new Set([...withDisplacement, "USE_DEPTH_PRE_PASS"]),
    options,
  );

  const assert = (label, ok) => {
    if (!ok) errorCount++;
    console.log(`${ok ? "ok" : "not ok"} - ${label}`);
  };

  // Without @invariant on both, a driver may contract multiply-adds differently
  // in each shader and land a few ULPs apart.
  const invariant = /@invariant @builtin\(position\)/;
  assert(
    "prePass agreement [invariant position in both]",
    invariant.test(standardSource) && invariant.test(prePassSource),
  );

  // The 1.3x stretch is a shadow-map bias; in the pre-pass it is a real offset
  // between two passes that must land on the same depth.
  const displacement = (source) =>
    source.split("\n").find((l) => l.includes("uModel.displacement"))?.trim();
  assert(
    "prePass agreement [displacement matches the opaque pass]",
    displacement(standardSource) === displacement(prePassSource),
  );
}

console.log(`\n${errorCount} errors, ${warningCount} warnings`);
process.exit(errorCount > 0 ? 1 : 0);
