// Exercises the register the render pipeline publishes and hands to every
// stage callback: which version of a name a reader gets, and what a mismatch
// between what a pass needs and what the frame produced actually does.
//
// None of it shows in a screenshot — a fallback that silently stops happening
// looks exactly like a frame that never had the problem.

Object.assign(globalThis, {
  GPUTextureUsage: {
    COPY_SRC: 1,
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    STORAGE_BINDING: 8,
    RENDER_ATTACHMENT: 16,
    TRANSIENT_ATTACHMENT: 32,
  },
  GPUBufferUsage: { STORAGE: 128 },
  GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
});

// Built output, for the same reason as test/frame-graph.js.
const { FrameGraph } = await import("../lib/frame-graph/index.js");
const { RenderTextures } = await import(
  "../lib/systems/render-pipeline/render-textures.js"
);

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

const graph = new FrameGraph(undefined);
graph.state.phase = "declaring";

const renderView = {
  camera: {},
  cameraEntity: { id: 1 },
  viewport: [0, 0, 800, 600],
};
const textures = new RenderTextures(graph, renderView);

const texture = (label, options = {}) =>
  graph.createTexture({
    label,
    width: 800,
    height: 600,
    format: "rgba16float",
    ...options,
  });

// Reported messages instead of console noise, and to assert on.
const reported = [];
graph.reportedErrors = {
  has: () => false,
  add: (message) => reported.push(message),
};
console.error = () => {};

// ─── Publishing and reading ──────────────────────────────────────────────────
{
  console.log("render textures — publishing");
  const color = texture("mainPass_color");
  textures.set("color", color);
  check("a name reads back", textures.get("color").name, "mainPass_color");

  const postProcessed = texture("combine.main");
  textures.set("combine.main", postProcessed);
  textures.set("color", postProcessed);
  check("republishing wins", textures.get("color").name, "combine.main");
  check(
    "both names point at it",
    textures.get("combine.main").name,
    "combine.main",
  );
  check(
    "an unpublished name is undefined",
    textures.get("velocity"),
    undefined,
  );
}

// ─── What a reader can bind ──────────────────────────────────────────────────
{
  console.log("\nrender textures — bindability");
  textures.set(
    "depth",
    texture("mainPassDepthMSAA", { format: "depth24plus", sampleCount: 4 }),
  );
  check("multisampled is not handed out", textures.get("depth"), undefined);
  check(
    "unless the reader says it can resolve it",
    textures.get("depth", { multisampled: true }).name,
    "mainPassDepthMSAA",
  );
  check(
    "a format that does not match is not handed out",
    textures.get("combine.main", { format: "rgba8unorm" }),
    undefined,
  );
}

// ─── Mismatch ────────────────────────────────────────────────────────────────
{
  console.log("\nrender textures — mismatch");
  reported.length = 0;
  textures.set("color", texture("badEffect", { sampleCount: 4 }));
  check(
    "an unusable publish falls back to the last usable version",
    textures.get("color").name,
    "combine.main",
  );
  check("and is reported once", reported.length, 1);
  check(
    "naming what was published and what was read",
    reported[0].includes('"badEffect"') &&
      reported[0].includes('"combine.main"'),
    true,
  );

  reported.length = 0;
  check(
    "require of a missing name is undefined",
    textures.require("velocity"),
    undefined,
  );
  check(
    "and lists what exists",
    reported[0].includes("color, combine.main"),
    true,
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
