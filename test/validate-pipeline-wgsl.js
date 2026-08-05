// Compiles representative option combinations of the WGSL pipeline shaders
// (src/shaders/*.js) through Dawn's real WGSL front-end, the same way
// pex-shaders' test/validate-wgsl.js does for its chunks.
//
// Pipeline shaders are self-contained generator functions -
// (defines, options) => wgslString - each producing one module with both a
// @vertex and a @fragment entry point, so each variant below is compiled as
// a single complete module, no stub types/overrides needed.

import { create, globals } from "webgpu";
import basic from "../src/shaders/basic.js";
import standard from "../src/shaders/standard.js";
import blit from "../src/shaders/blit.js";
import reversibleToneMap from "../src/shaders/reversibleToneMap.js";
import depthPass from "../src/shaders/depth-pass.js";
import depthPrePass from "../src/shaders/depth-pre-pass.js";
import line from "../src/shaders/line.js";
import overlay from "../src/shaders/overlay.js";
import helper from "../src/shaders/helper.js";
import error from "../src/shaders/error.js";
import sky from "../src/shaders/sky.js";

Object.assign(globalThis, globals);

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
  { name: "MSAA + draw buffers", defines: new Set(["USE_MSAA", "USE_DRAW_BUFFERS"]), options: { locationNormal: 1, locationEmissive: 2 } },
  { name: "hooks", defines: new Set(["USE_VERTEX_COLORS"]), options: { hooks: { vertBeforeTransform: "// hook", fragEnd: "// hook" } } },
];

const standardVariants = [
  { name: "minimal unlit", defines: new Set(["USE_UNLIT_WORKFLOW"]) },
  { name: "unlit + basecolor tex + alpha test", defines: new Set(["USE_UNLIT_WORKFLOW", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEXTURE", "USE_ALPHA_TEST"]) },
  { name: "metallic-roughness no textures no lights", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW"]) },
  { name: "mr + basecolor + normal + 1 directional", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_NORMAL_TEXTURE", "USE_TANGENTS"]), options: { lights: { directional: 1 } } },
  { name: "all light types at max", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS"]), options: { lights: { ambient: 4, directional: 4, point: 4, spot: 4, area: 4 } } },
  { name: "reflection probes + transmission", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_REFLECTION_PROBES", "USE_TRANSMISSION", "USE_TRANSMISSION_TEXTURE", "USE_DISPERSION", "USE_TEXCOORD_0"]), options: { lights: { directional: 1 } } },
  { name: "clear coat + sheen + tangents", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_CLEAR_COAT", "USE_CLEAR_COAT_TEXTURE", "USE_CLEAR_COAT_NORMAL_TEXTURE", "USE_SHEEN", "USE_SHEEN_COLOR_TEXTURE", "USE_TANGENTS"]), options: { lights: { point: 2 } } },
  { name: "clear coat roughness from main texture", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_CLEAR_COAT", "USE_CLEAR_COAT_TEXTURE", "USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE"]) },
  { name: "specular-glossiness", defines: new Set(["USE_SPECULAR_GLOSSINESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_DIFFUSE_TEXTURE", "USE_SPECULAR_GLOSSINESS_TEXTURE"]), options: { lights: { directional: 1 } } },
  { name: "specular workflow (KHR)", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_SPECULAR", "USE_SPECULAR_TEXTURE", "USE_SPECULAR_COLOR_TEXTURE"]) },
  { name: "volume + diffuse transmission", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_TRANSMISSION", "USE_VOLUME", "USE_THICKNESS_TEXTURE", "USE_DIFFUSE_TRANSMISSION", "USE_DIFFUSE_TRANSMISSION_TEXTURE", "USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE"]) },
  { name: "emissive + occlusion + msaa + drawbuffers", defines: new Set(["USE_METALLIC_ROUGHNESS_WORKFLOW", "USE_NORMALS", "USE_TEXCOORD_0", "USE_EMISSIVE_COLOR", "USE_EMISSIVE_COLOR_TEXTURE", "USE_OCCLUSION_TEXTURE", "USE_MSAA", "USE_DRAW_BUFFERS"]), options: { locationNormal: 1, locationEmissive: 2 } },
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
      "USE_ALPHA_TEXTURE", "USE_ALPHA_TEST", "USE_REFLECTION_PROBES", "USE_MSAA", "USE_DRAW_BUFFERS", "USE_BLEND",
    ]),
    options: { maxJoints: 64, lights: { ambient: 1, directional: 2, point: 2, spot: 1, area: 1 }, locationNormal: 1, locationEmissive: 2 },
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
  { name: "hooks", defines: new Set(), options: { hooks: { vertBeforeTransform: "// hook", vertEnd: "// hook", fragDeclarationsEnd: "// hook", fragEnd: "// hook" } } },
];

const depthPrePassVariants = [
  { name: "default", defines: new Set(["USE_NORMALS"]) },
  { name: "alpha texture + alpha test", defines: new Set(["USE_NORMALS", "USE_TEXCOORD_0", "USE_BASE_COLOR_TEXTURE", "USE_ALPHA_TEXTURE", "USE_ALPHA_TEST"]) },
  { name: "skinned + instanced + vertex colors", defines: new Set(["USE_NORMALS", "USE_SKIN", "USE_INSTANCED_OFFSET", "USE_INSTANCED_SCALE", "USE_INSTANCED_ROTATION", "USE_VERTEX_COLORS"]), options: { maxJoints: 64 } },
  { name: "displacement + texcoord1", defines: new Set(["USE_NORMALS", "USE_TEXCOORD_0", "USE_TEXCOORD_1", "USE_DISPLACEMENT_TEXTURE"]) },
  { name: "hooks", defines: new Set(["USE_NORMALS"]), options: { hooks: { vertBeforeTransform: "// hook", vertEnd: "// hook", fragDeclarationsEnd: "// hook", fragEnd: "// hook" } } },
];

const lineVariants = [
  { name: "default", defines: new Set() },
  { name: "vertex colors + perspective scaling", defines: new Set(["USE_VERTEX_COLORS", "USE_PERSPECTIVE_SCALING"]) },
  { name: "instanced line width + msaa + drawbuffers", defines: new Set(["USE_INSTANCED_LINE_WIDTH", "USE_MSAA", "USE_DRAW_BUFFERS"]), options: { locationNormal: 1, locationEmissive: 2 } },
  { name: "hooks", defines: new Set(["USE_VERTEX_COLORS"]), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const overlayVariants = [
  { name: "default", defines: new Set() },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const helperVariants = [
  { name: "default", defines: new Set() },
  { name: "msaa + drawbuffers", defines: new Set(["USE_MSAA", "USE_DRAW_BUFFERS"]), options: { locationNormal: 1, locationEmissive: 2 } },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const errorVariants = [
  { name: "default", defines: new Set() },
  { name: "drawbuffers", defines: new Set(["USE_DRAW_BUFFERS"]), options: { locationNormal: 1, locationEmissive: 2 } },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

const skyVariants = [
  { name: "default", defines: new Set() },
  { name: "drawbuffers", defines: new Set(["USE_DRAW_BUFFERS"]), options: { locationNormal: 1, locationEmissive: 2, locationVelocity: 3 } },
  { name: "hooks", defines: new Set(), options: { hooks: { vertEnd: "// hook", fragEnd: "// hook" } } },
];

for (const v of basicVariants) {
  await check(`basic [${v.name}]`, basic(v.defines, v.options));
}
for (const v of standardVariants) {
  await check(`standard [${v.name}]`, standard(v.defines, v.options));
}
for (const v of blitVariants) {
  await check(`blit [${v.name}]`, blit(v.defines, v.options));
}
for (const v of reversibleToneMapVariants) {
  await check(`reversibleToneMap [${v.name}]`, reversibleToneMap(v.defines, v.options));
}
for (const v of depthPassVariants) {
  await check(`depthPass [${v.name}]`, depthPass(v.defines, v.options));
}
for (const v of depthPrePassVariants) {
  await check(`depthPrePass [${v.name}]`, depthPrePass(v.defines, v.options));
}
for (const v of lineVariants) {
  await check(`line [${v.name}]`, line(v.defines, v.options));
}
for (const v of overlayVariants) {
  await check(`overlay [${v.name}]`, overlay(v.defines, v.options));
}
for (const v of helperVariants) {
  await check(`helper [${v.name}]`, helper(v.defines, v.options));
}
for (const v of errorVariants) {
  await check(`error [${v.name}]`, error(v.defines, v.options));
}
for (const v of skyVariants) {
  await check(`sky [${v.name}]`, sky(v.defines, v.options));
}

console.log(`\n${errorCount} errors, ${warningCount} warnings`);
process.exit(errorCount > 0 ? 1 : 0);
