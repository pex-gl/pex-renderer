// Counts the shader modules the standard renderer can compile, from its own
// field tables and variant key, and checks the key against the source it
// stands for: one key for two sources is a material drawn with another's
// shader, two keys for one source is a compile that could have been a hit.
//
// A miss compiles synchronously mid-frame, so the count is the renderer's
// worst-case hitch budget. It is a product over axes that cannot interact —
// each enumerated with everything else at a baseline — so it only moves when a
// table or the key does. Shadow bucket counts, hooks and debugRender are
// open-ended and left out.
//
// Built output, and a Dawn device for the renderer's dummy textures.

import { create, globals } from "webgpu";

Object.assign(globalThis, globals);

const { default: standardRenderer } =
  await import("../lib/systems/renderer/standard.js");
const {
  STANDARD_MATERIAL_COMMON_FIELDS,
  STANDARD_MATERIAL_FIELDS,
  STANDARD_VERTEX_FIELDS,
} = await import("../lib/shaders/standard.js");

const adapter = await create([]).requestAdapter();
const device = await adapter.requestDevice();
const renderer = standardRenderer({ ctx: { device } });

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "  ok" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`        expected ${JSON.stringify(expected)}`);
    console.log(`        actual   ${JSON.stringify(actual)}`);
  }
};

// Every output the generator reads, so a define that only matters to one of
// them is not reported as redundant.
const OUTPUT_NAMES = ["normal", "emissive", "velocity", "responsive"];
const ALL_OUTPUTS = Object.fromEntries(OUTPUT_NAMES.map((name) => [name, {}]));

// Only TEXCOORD_0 and TEXCOORD_1 have a vertex attribute.
const TEX_COORDS = [0, 1];

const BASE_OPTIONS = {
  lights: { shadow2DBuckets: 0, shadowCubeBuckets: 0, area: false },
  outputs: ALL_OUTPUTS,
};
const BASE_ATTRIBUTES = { normal: {}, texCoord0: {}, texCoord1: {} };

/**
 * Groups of keys that can change each other's defines: through `requires`/
 * `excludes`, a shared define, or the same key listed twice. A `requires` on a
 * define no field owns (the workflow) is set by the caller and links nothing.
 */
function independentGroups(fields) {
  const keys = fields
    .filter((field) => field.define || field.texture)
    .map((field) => field.key);
  const parent = new Map(keys.map((key) => [key, key]));
  const find = (key) => (parent.get(key) === key ? key : find(parent.get(key)));

  const owners = Map.groupBy(
    fields.filter((field) => field.define),
    (field) => field.define,
  );
  for (const field of fields) {
    if (!parent.has(field.key)) continue;
    for (const define of [field.define, field.requires, field.excludes]) {
      for (const owner of owners.get(define) ?? []) {
        parent.set(find(field.key), find(owner.key));
      }
    }
  }
  return [...Map.groupBy(keys, find).values()].map((group) => [
    ...new Set(group),
  ]);
}

// Every presence subset of `keys`, and for each texture present every UV set.
function* presence(fields, keys) {
  const isTexture = (key) =>
    fields.some((field) => field.key === key && field.texture);
  for (let mask = 0; mask < 1 << keys.length; mask++) {
    const present = keys.filter((_, i) => mask & (1 << i));
    const textures = present.filter(isTexture);
    for (let uv = 0; uv < TEX_COORDS.length ** textures.length; uv++) {
      const values = {};
      let rest = uv;
      for (const key of present) {
        if (isTexture(key)) {
          values[key] = { texCoord: TEX_COORDS[rest % TEX_COORDS.length] };
          rest = Math.floor(rest / TEX_COORDS.length);
        } else {
          values[key] = 1;
        }
      }
      yield values;
    }
  }
}

/** Key → set of sources over `cases`, each an `{ entity, options }`. */
function variants(cases) {
  const sources = new Map();
  for (const { entity, options } of cases) {
    const defines = renderer.getDefines(entity, options);
    const key = renderer.getVariantKey(entity, defines, options);
    const source = renderer.getShader(
      defines,
      renderer.getShaderOptions(entity, options, defines),
    );
    if (!sources.has(key)) sources.set(key, new Set());
    sources.get(key).add(source);
  }
  return sources;
}

/** Checks one axis and returns its distinct key and source counts. */
function axis(label, cases) {
  const sources = variants(cases);
  const keysBySource = Map.groupBy(
    [...sources].flatMap(([key, set]) =>
      [...set].map((source) => [source, key]),
    ),
    ([source]) => source,
  );

  check(
    `${label}: one source per key`,
    [...sources].filter(([, set]) => set.size > 1).map(([key]) => key),
    [],
  );
  check(
    `${label}: one key per source`,
    [...keysBySource.values()]
      .filter((pairs) => pairs.length > 1)
      .map((pairs) => pairs.map(([, key]) => key)),
    [],
  );
  return { keys: sources.size, sources: keysBySource.size };
}

const product = (counts) =>
  counts.reduce(
    (total, { keys, sources }) => ({
      keys: total.keys * keys,
      sources: total.sources * sources,
    }),
    { keys: 1, sources: 1 },
  );

const entity = (material, attributes = BASE_ATTRIBUTES) => ({
  material,
  _geometry: { attributes },
});

const WORKFLOWS = {
  metallicRoughness: { fields: STANDARD_MATERIAL_FIELDS, base: {} },
  specularGlossiness: {
    fields: STANDARD_MATERIAL_FIELDS,
    base: { sgDiffuse: 1 },
  },
  unlit: { fields: STANDARD_MATERIAL_COMMON_FIELDS, base: { unlit: true } },
};

const totals = [];
for (const [name, { fields, base }] of Object.entries(WORKFLOWS)) {
  const counts = independentGroups(fields).map((group) =>
    axis(
      `${name} [${group.join(", ")}]`,
      presence(fields, group).map((values) => ({
        entity: entity({ ...base, ...values }),
        options: BASE_OPTIONS,
      })),
    ),
  );

  counts.push(
    axis(`${name} reflection probe`, [
      { entity: entity(base), options: BASE_OPTIONS },
      {
        entity: entity(base),
        options: { ...BASE_OPTIONS, reflectionProbe: { roughnessLevels: 5 } },
      },
    ]),
  );

  const total = product(counts);
  console.log(`  ==  ${name}: ${total.keys} keys, ${total.sources} sources`);
  totals.push(total);
}

const vertex = product(
  independentGroups(STANDARD_VERTEX_FIELDS).map((group) =>
    axis(
      `vertex [${group.join(", ")}]`,
      presence(STANDARD_VERTEX_FIELDS, group).map((values) => ({
        entity: entity({}, { normal: {}, ...values }),
        options: BASE_OPTIONS,
      })),
    ),
  ),
);
console.log(`  ==  vertex: ×${vertex.keys} keys, ×${vertex.sources} sources`);

const outputs = axis(
  "outputs",
  Array.from({ length: 1 << OUTPUT_NAMES.length }, (_, mask) => ({
    entity: entity({}),
    options: {
      ...BASE_OPTIONS,
      outputs: Object.fromEntries(
        OUTPUT_NAMES.filter((_, i) => mask & (1 << i)).map((name) => [
          name,
          {},
        ]),
      ),
    },
  })),
);
console.log(
  `  ==  outputs: ×${outputs.keys} keys, ×${outputs.sources} sources`,
);

const materials = totals.reduce(
  (sum, { keys, sources }) => ({
    keys: sum.keys + keys,
    sources: sum.sources + sources,
  }),
  { keys: 0, sources: 0 },
);
const all = product([materials, vertex, outputs]);
console.log(`  ==  total: ${all.keys} keys, ${all.sources} sources`);

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
