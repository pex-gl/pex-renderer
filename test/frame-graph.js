// Exercises the frame graph's compile phase — culling, merging, lifetimes,
// load/store derivation — against a stubbed pool, so no GPU is involved.
//
// These are the parts whose bugs are invisible in a screenshot: a target that
// silently stops being recycled, a storeOp that should have been a discard, a
// pass that survives culling. Everything visual stays in examples/.

// Usage flag namespaces are the only WebGPU globals the compile path touches.
Object.assign(globalThis, {
  GPUTextureUsage: {
    COPY_SRC: 1,
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    STORAGE_BINDING: 8,
    RENDER_ATTACHMENT: 16,
    TRANSIENT_ATTACHMENT: 32,
  },
  GPUBufferUsage: {
    MAP_READ: 1,
    MAP_WRITE: 2,
    COPY_SRC: 4,
    COPY_DST: 8,
    INDEX: 16,
    VERTEX: 32,
    UNIFORM: 64,
    STORAGE: 128,
    INDIRECT: 256,
    QUERY_RESOLVE: 512,
  },
  GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
});

// Imported from the build output: the graph modules import each other with
// runtime ".js" specifiers, which Node's type stripping does not remap to the
// ".ts" sources. Run `npm run build` first.
const { createGraphState, resetGraphState } = await import(
  "../lib/frame-graph/state.js"
);
const { FrameGraph } = await import("../lib/frame-graph/index.js");
const compile = (await import("../lib/frame-graph/compile.js")).default;
const { attachmentView } = await import("../lib/frame-graph/execute.js");

// One graph, declaring into whichever state a block is exercising, compiled by
// hand against the stub pool below. Nothing here is private, which is what lets
// the test drive the declaration API without a GPU context.
const graph = new FrameGraph(undefined);

const createSetup = (state, overrides = new Map()) => {
  graph.state = state;
  graph.overrides = overrides;
  state.phase = "declaring";
  return graph;
};

/** Pool stub: hands out identity-tagged objects and recycles by descriptor. */
function createStubPool() {
  const free = new Map();
  const persistent = new Map();
  let nextId = 1;
  return {
    acquireTexture(descriptor, usage) {
      const key = `${descriptor.format}|${descriptor.width}x${descriptor.height}|u${usage}`;
      const list = free.get(key);
      const texture = list?.pop() ?? { id: nextId++, key };
      return texture;
    },
    acquirePersistentTexture(name) {
      if (!persistent.has(name)) persistent.set(name, { id: nextId++ });
      return persistent.get(name);
    },
    releaseTexture(texture) {
      if (!free.has(texture.key)) free.set(texture.key, []);
      free.get(texture.key).push(texture);
    },
    acquireBuffer: () => ({ id: nextId++ }),
    endFrame() {},
    stats: () => ({}),
    dispose() {},
  };
}

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

const noop = () => {};
const pool = createStubPool();
const state = createGraphState();

// ─── A frame shaped like the real pipeline ───────────────────────────────────
{
  const api = createSetup(state, new Map());
  const target = (label, extra) =>
    api.createTexture({
      label,
      width: 1920,
      height: 1080,
      format: "rgba16float",
      ...extra,
    });

  const shadow = api.createTexture({
    label: "shadow",
    width: 2048,
    height: 2048,
    format: "depth32float",
  });
  api.exportTexture(shadow);
  api.addPass({
    name: "Shadow",
    color: [],
    depth: { texture: shadow, depthClearValue: 1 },
    execute: noop,
  });

  const color = target("sceneColor");
  const depth = target("sceneDepth", { format: "depth24plus" });
  api.addPass({
    name: "Main",
    color: [{ texture: color, clearValue: [0, 0, 0, 1] }],
    depth: { texture: depth, depthClearValue: 1 },
    reads: [shadow],
    execute: noop,
  });
  api.addPass({
    name: "Transparent",
    color: [{ texture: color }],
    depth: { texture: depth },
    execute: noop,
  });

  let current = color;
  for (const step of ["a", "b", "c", "d"]) {
    const next = target(`post_${step}`);
    api.addPass({
      name: `Post_${step}`,
      color: [{ texture: next }],
      uniforms: { uTexture: current },
      execute: noop,
    });
    current = next;
  }

  // Written, never read, never exported: the pass should not survive.
  const dead = target("deadDebug");
  api.addPass({
    name: "DeadPass",
    color: [{ texture: dead }],
    uniforms: { uTexture: color },
    execute: noop,
  });

  api.addPass({
    name: "Blit",
    uniforms: { uTexture: current },
    neverCull: true,
    execute: noop,
  });
  api.exportTexture(current);

  const plan = compile(state, pool, {});
  const resource = Object.fromEntries(plan.resources.map((r) => [r.name, r]));

  console.log("\nframe graph — compile");
  check(
    "adjacent passes sharing attachments merge",
    plan.passes.map((pass) => pass.label).includes("Main + Transparent"),
    true,
  );
  check("merged pass count", plan.stats.mergedPasses, 1);
  check("unreferenced pass is culled", plan.culledPasses, ["DeadPass"]);
  check("culled pass's target is never allocated", resource.deadDebug.culled, true);
  check(
    "attachment that never escapes its pass is memoryless",
    resource.sceneDepth.transient,
    true,
  );
  check(
    "sampled attachment is not memoryless",
    resource.shadow.transient,
    false,
  );
  check(
    "post chain recycles down to two physical textures",
    new Set(
      ["post_a", "post_b", "post_c", "post_d"].map((n) => resource[n].physicalId),
    ).size,
    2,
  );
  check("peak is below the naive per-resource total", plan.stats.peakBytes < plan.stats.naiveBytes, true);
  console.log(
    `        peak ${(plan.stats.peakBytes / 1048576).toFixed(1)} MB vs naive ${(
      plan.stats.naiveBytes / 1048576
    ).toFixed(1)} MB`,
  );

  console.log("\nframe graph — load/store");
  const main = plan.passes.find((pass) => pass.label === "Main + Transparent");
  check("first touch clears rather than loading", main.color[0].loadOp, "clear");
  check("attachment read later is stored", main.color[0].storeOp, "store");
  check("depth nothing reads is discarded", main.depth.storeOp, "discard");
  check(
    "exported target is stored",
    plan.passes.find((pass) => pass.name === "Post_d").color[0].storeOp,
    "store",
  );
}

// ─── Cube faces are independent write chains ─────────────────────────────────
{
  console.log("\nframe graph — array layers");
  resetGraphState(state);
  const api = createSetup(state, new Map());
  const cube = api.createTexture({
    label: "pointShadow",
    width: 1024,
    height: 1024,
    format: "depth32float",
    depth: 6,
    viewDimension: "cube",
  });
  api.exportTexture(cube);
  for (let i = 0; i < 6; i++) {
    api.addPass({
      name: `Face${i}`,
      color: [],
      depth: { texture: cube, layer: i, depthClearValue: 1 },
      execute: noop,
    });
  }
  const plan = compile(state, pool, {});
  check("faces of one texture do not merge", plan.passes.length, 6);
  check(
    "each face clears and stores",
    plan.passes.every(
      (pass) => pass.depth.loadOp === "clear" && pass.depth.storeOp === "store",
    ),
    true,
  );
}

// ─── Declaration-time validation ─────────────────────────────────────────────
{
  console.log("\nframe graph — validation");
  resetGraphState(state);
  const api = createSetup(state, new Map());
  const texture = api.createTexture({ label: "pingpong", width: 8, height: 8 });
  let threw = false;
  try {
    api.addPass({
      name: "Bad",
      color: [{ texture }],
      uniforms: { uTexture: texture },
      execute: noop,
    });
  } catch {
    threw = true;
  }
  check("sampling a pass's own attachment throws", threw, true);

  resetGraphState(state);
  const api2 = createSetup(state, new Map());
  api2.addPass({ name: "Same", execute: noop, neverCull: true });
  let duplicate = false;
  try {
    api2.addPass({ name: "Same", execute: noop, neverCull: true });
  } catch {
    duplicate = true;
  }
  check("duplicate pass names throw", duplicate, true);
}

// ─── Write-after-read ordering ───────────────────────────────────────────────
{
  console.log("\nframe graph — edges");
  resetGraphState(state);
  const api = createSetup(state, new Map());
  const a = api.createTexture({ label: "a", width: 8, height: 8 });
  const b = api.createTexture({ label: "b", width: 8, height: 8 });
  api.exportTexture(b);
  api.addPass({ name: "WriteA", color: [{ texture: a }], execute: noop });
  api.addPass({
    name: "ReadA",
    color: [{ texture: b }],
    uniforms: { uTexture: a },
    execute: noop,
  });
  api.addPass({
    name: "RewriteA",
    color: [{ texture: a }],
    execute: noop,
    neverCull: true,
  });
  check(
    "rewriting a resource waits for its readers",
    [...state.passes[2].dependencies].sort(),
    [0, 1],
  );
}

// ─── Multisample resolve ─────────────────────────────────────────────────────
{
  console.log("\nframe graph — msaa resolve");
  resetGraphState(state);
  const api = createSetup(state, new Map());
  const resolved = api.createTexture({
    label: "resolved",
    width: 64,
    height: 64,
    format: "rgba16float",
  });
  const multisampled = api.createTexture({
    label: "multisampled",
    width: 64,
    height: 64,
    format: "rgba16float",
    sampleCount: 4,
  });
  const out = api.createTexture({ label: "out", width: 64, height: 64 });
  api.exportTexture(out);
  api.addPass({
    name: "Draw",
    color: [{ texture: multisampled, resolveTarget: resolved, clearValue: [0, 0, 0, 1] }],
    execute: noop,
  });
  api.addPass({
    name: "Read",
    color: [{ texture: out }],
    uniforms: { uTexture: resolved },
    execute: noop,
  });

  const plan = compile(state, pool, {});
  const resource = Object.fromEntries(plan.resources.map((r) => [r.name, r]));
  // A resolve writes its target as surely as the attachment does; miss that and
  // the target gets no lifetime, no allocation, and silently resolves to nothing.
  check("resolve target is allocated", resource.resolved.culled, false);
  check("resolve target lives from the resolving pass", resource.resolved.firstUse, 0);
  check("resolve target survives to its reader", resource.resolved.lastUse, 1);
  check(
    "multisampled attachment nothing samples is discarded",
    plan.passes[0].color[0].storeOp,
    "discard",
  );
}

// ─── Multiple views over one graph ───────────────────────────────────────────
// The pipeline declares once per camera into a single graph, so anything shared
// between cameras has to be declared once and anything per-camera has to carry
// the camera in its name.
{
  console.log("\nframe graph — multiple views");
  resetGraphState(state);
  const api = createSetup(state, new Map());

  // View-independent, so declared by the first camera and reused by the second.
  const shadow = api.createTexture({
    label: "shadow",
    width: 1024,
    height: 1024,
    format: "depth32float",
  });
  api.exportTexture(shadow);
  api.addPass({
    name: "Shadow",
    color: [],
    depth: { texture: shadow, depthClearValue: 1 },
    execute: noop,
  });

  for (const viewId of [7, 9]) {
    const color = api.createTexture({
      label: `color_${viewId}`,
      width: 512,
      height: 512,
      format: "rgba16float",
    });
    api.exportTexture(color);
    api.addPass({
      name: `MainPass_${viewId}`,
      color: [{ texture: color, clearValue: [0, 0, 0, 1] }],
      reads: [shadow],
      execute: noop,
    });
  }

  const plan = compile(state, pool, {});
  const physical = Object.fromEntries(
    plan.resources.map((r) => [r.name, r.physicalId]),
  );
  // Exported resources are read after the graph finishes. Recycling one into a
  // later pass of the same frame hands the caller a texture that something else
  // has since drawn over — the second camera's targets must not reuse the
  // first's, even though the first's last in-graph use is long past.
  check(
    "an exported target is not recycled later in the frame",
    physical.color_7 !== physical.color_9,
    true,
  );
  check(
    "nor does a shared one get taken over",
    physical.shadow !== physical.color_7 && physical.shadow !== physical.color_9,
    true,
  );

  check("one shadow pass serves every camera", plan.passes.length, 3);
  check(
    "per-camera passes stay distinct",
    plan.passes.map((pass) => pass.name),
    ["Shadow", "MainPass_7", "MainPass_9"],
  );
  // Both cameras read it, so it must outlive the first camera's main pass.
  const resource = Object.fromEntries(plan.resources.map((r) => [r.name, r]));
  check("shared resource survives to its last reader", resource.shadow.lastUse, 2);
}

// ─── Persistent resources ────────────────────────────────────────────────────
// Pooling substitutes textures freely, which is invisible to the graph but not
// to anything holding one across frames. A persistent resource keeps the same
// texture, frame after frame.
{
  console.log("\nframe graph — persistent resources");

  const declare = () => {
    resetGraphState(state);
    const api = createSetup(state, new Map());
    const shadow = api.createTexture({
      label: "shadow",
      width: 1024,
      height: 1024,
      format: "depth32float",
      persistent: true,
    });
    const scratch = api.createTexture({
      label: "scratch",
      width: 1024,
      height: 1024,
      format: "depth32float",
    });
    api.exportTexture(scratch);
    api.addPass({
      name: "Shadow",
      color: [],
      depth: { texture: shadow, depthClearValue: 1 },
      execute: noop,
    });
    api.addPass({
      name: "Scratch",
      color: [],
      depth: { texture: scratch, depthClearValue: 1 },
      reads: [shadow],
      execute: noop,
    });
    return compile(state, pool, {});
  };

  const first = declare();
  const second = declare();
  const idOf = (plan, name) =>
    plan.resources.find((r) => r.name === name).physicalId;

  check(
    "a persistent resource keeps its texture across frames",
    idOf(first, "shadow") === idOf(second, "shadow"),
    true,
  );
  // The contrast: same descriptor, pooled, so nothing guarantees it comes back.
  check(
    "persistent is not merely exported",
    idOf(first, "shadow") !== idOf(first, "scratch"),
    true,
  );
  check(
    "and it survives culling like an export",
    first.resources.find((r) => r.name === "shadow").culled,
    false,
  );
  check(
    "reported in the plan",
    [
      first.resources.find((r) => r.name === "shadow").persistent,
      first.resources.find((r) => r.name === "scratch").persistent,
    ],
    [true, false],
  );

  // Neither is sampled by any pass here, and both are read outside the graph.
  // Without TEXTURE_BINDING the caller's bind group fails validation at submit
  // time — invisible until something actually samples what render() returned.
  const usageOf = (plan, name) =>
    plan.resources.find((r) => r.name === name).usage;
  check(
    "exported and persistent textures can be sampled outside the graph",
    [
      (usageOf(first, "scratch") & GPUTextureUsage.TEXTURE_BINDING) !== 0,
      (usageOf(first, "shadow") & GPUTextureUsage.TEXTURE_BINDING) !== 0,
    ],
    [true, true],
  );
}

// ─── Attachment views ────────────────────────────────────────────────────────
// A default view spans every layer and level, and a render attachment must
// target exactly one of each. Getting this wrong fails validation at submit
// time, not at compile time, so the rule is pinned here.
{
  console.log("\nframe graph — attachment views");
  const stubTexture = (depthOrArrayLayers, mipLevelCount) => ({
    depthOrArrayLayers,
    mipLevelCount,
    texture: { createView: (descriptor) => descriptor },
  });

  check(
    "plain 2D texture attaches through its default view",
    attachmentView(stubTexture(1, 1)),
    undefined,
  );
  check(
    "mipmapped texture is pinned to one level",
    attachmentView(stubTexture(1, 5), undefined, 2),
    { baseMipLevel: 2, mipLevelCount: 1 },
  );
  // Regression: layer 0 of a cube is still one layer out of six, and the
  // compiled plan omits a layer of 0.
  check(
    "cube face 0 gets an explicit single-layer view",
    attachmentView(stubTexture(6, 1)),
    {
      dimension: "2d",
      baseArrayLayer: 0,
      arrayLayerCount: 1,
      baseMipLevel: 0,
      mipLevelCount: 1,
    },
  );
  check("cube face N selects that layer", attachmentView(stubTexture(6, 1), 4), {
    dimension: "2d",
    baseArrayLayer: 4,
    arrayLayerCount: 1,
    baseMipLevel: 0,
    mipLevelCount: 1,
  });

  // pex-gpu keys bind groups by view identity and can only prune them through
  // the GpuTexture wrapper, so a view rebuilt every frame leaks a bind group
  // every frame.
  const cube = stubTexture(6, 1);
  check(
    "a sub-resource view is built once per texture",
    attachmentView(cube, 3) === attachmentView(cube, 3),
    true,
  );
  check(
    "different sub-resources get their own view",
    attachmentView(cube, 3) === attachmentView(cube, 4),
    false,
  );
}

// ─── Pass overrides ──────────────────────────────────────────────────────────
{
  console.log("\nframe graph — overrides");
  resetGraphState(state);
  const overrides = new Map();
  overrides.set("Dropped", () => null);
  overrides.set("Swapped", (declaration) => ({
    ...declaration,
    name: "Replacement",
  }));
  const api = createSetup(state, overrides);
  api.addPass({ name: "Kept", execute: noop, neverCull: true });
  api.addPass({ name: "Dropped", execute: noop, neverCull: true });
  api.addPass({ name: "Swapped", execute: noop, neverCull: true });
  check(
    "overrides drop and replace by name",
    state.passes.map((pass) => pass.name),
    ["Kept", "Replacement"],
  );
}

// ─── Pass hooks ──────────────────────────────────────────────────────────────
{
  console.log("\nframe graph — pass hooks");
  resetGraphState(state);
  const api = createSetup(state, new Map());
  const color = api.createTexture({ label: "color", width: 8, height: 8 });
  const capture = api.createTexture({ label: "capture", width: 8, height: 8 });
  api.exportTexture(capture);

  const seen = [];
  const off = api.afterPass("MainPass", (declaration) => {
    seen.push(declaration.name);
    api.addPass({
      name: "Injected",
      color: [{ texture: capture }],
      uniforms: { uTexture: color },
      execute: noop,
    });
  });

  api.addPass({ name: "MainPass", color: [{ texture: color }], execute: noop });
  api.addPass({
    name: "TransparentPass",
    color: [{ texture: color }],
    execute: noop,
    neverCull: true,
  });

  check("the hook runs with the pass it is registered on", seen, ["MainPass"]);
  check(
    "and its passes land right after it",
    state.passes.map((pass) => pass.name),
    ["MainPass", "Injected", "TransparentPass"],
  );
  // The injected read sits between two writes of the same handle, which is what
  // makes reading a target mid-frame safe: the later write waits for it.
  check(
    "a later write of the same target waits for the injected read",
    [...state.passes[2].dependencies].sort(),
    [0, 1],
  );

  off();
  resetGraphState(state);
  const bare = createSetup(state, new Map());
  bare.addPass({ name: "MainPass", execute: noop, neverCull: true });
  check(
    "unregistering stops it",
    state.passes.map((pass) => pass.name),
    ["MainPass"],
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
