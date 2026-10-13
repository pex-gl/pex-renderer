// Prints the standard renderer's WGSL with every feature it can turn on at
// once: every material field and vertex attribute present, every output, shadow
// buckets, reflection probe, SSAO, MSAA. Goes through the renderer itself, so
// requires/excludes resolve the way they do at runtime.
//
// Built output, and a Dawn device for the renderer's dummy textures.
//
//   node scripts/standard-shader.js [metallicRoughness|specularGlossiness|unlit] > standard.wgsl

import { create, globals } from "webgpu";

Object.assign(globalThis, globals);

const { default: standardRenderer } =
  await import("../lib/systems/renderer/standard.js");
const {
  STANDARD_MATERIAL_FIELDS,
  STANDARD_VERTEX_FIELDS,
  STANDARD_WORKFLOW,
} = await import("../lib/shaders/standard.js");

// Any specular-glossiness value selects that workflow, so the other workflows
// leave its fields out.
const WORKFLOWS = {
  metallicRoughness: { omit: STANDARD_WORKFLOW.specularGlossiness },
  specularGlossiness: { omit: STANDARD_WORKFLOW.metallicRoughness },
  unlit: { omit: STANDARD_WORKFLOW.specularGlossiness, unlit: true },
};
const workflow = process.argv[2] ?? "metallicRoughness";
const { omit, ...workflowValues } = WORKFLOWS[workflow] ?? {};
if (!omit) {
  console.error(`Unknown workflow "${workflow}": ${Object.keys(WORKFLOWS)}`);
  process.exit(1);
}

const gpu = create([]);
const adapter = await gpu.requestAdapter();
const device = await adapter.requestDevice();
const renderer = standardRenderer({ ctx: { device } });

const present = (fields) =>
  Object.fromEntries(fields.map(({ key, texture }) => [key, texture ? {} : 1]));

const entity = {
  material: {
    ...present(
      STANDARD_MATERIAL_FIELDS.filter((field) => field.requires !== omit),
    ),
    ...workflowValues,
    receiveShadows: true,
  },
  _geometry: {
    attributes: { normal: {}, ...present(STANDARD_VERTEX_FIELDS) },
  },
  _transform: { modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
};
const options = {
  lights: { shadow2DBuckets: 2, shadowCubeBuckets: 1, area: true },
  outputs: { normal: {}, emissive: {}, velocity: {}, responsive: {} },
  reflectionProbe: { roughnessLevels: 5 },
  textures: { "ssao.main": {}, "ssao.bentNormal": {} },
  msaa: true,
  multisampled: true,
};

const materialFeatures = renderer.getMaterialDefines(entity);
const defines = renderer.getDefines(entity, options, materialFeatures);

const shader = renderer.getShader(
  defines,
  renderer.getShaderOptions(entity, options, defines),
);
const { constants } = renderer.getPipelineOptions(
  entity,
  options,
  materialFeatures,
);

console.log(`// workflow: ${workflow}
// defines: ${[...defines].sort().join(" ")}
// pipeline constants: ${JSON.stringify(constants)}
${shader.replace(/\n(?:[^\S\n]*\n)+/g, "\n\n")}`);
