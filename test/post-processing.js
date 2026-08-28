// Drives the real effects through the real post-processing driver and the real
// frame graph, against a stubbed pool, so no GPU is involved.
//
// These are the parts whose bugs are invisible in a screenshot: a bloom level
// accumulating into the wrong target, a loadOp that clears the level below
// instead of adding to it, a filter stepping in the wrong grid, an effect
// silently dropping out of the chain. Everything visual stays in examples/.
//
// Shader compilation is covered by test/validate-pipeline-wgsl.js; what is
// checked here instead is that the uniform block every post-processing shader
// binds agrees with what the driver writes into it — pex-gpu's packStruct
// throws on an unknown member but silently skips a missing one, so a member no
// writer supplies reads as zero rather than failing.

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

// Imported from the build output, like test/frame-graph.js: the modules import
// each other with runtime ".js" specifiers, which Node's type stripping does
// not remap to the ".ts" sources. Run `npm run build` first.
const { FrameGraph } = await import("../lib/frame-graph/index.js");
const { RenderTextures } = await import(
  "../lib/systems/render-pipeline/render-textures.js"
);
const postProcessingMethods = (
  await import("../lib/systems/render-pipeline/post-processing.js")
).default;
const { postProcessing: shaders } = await import("../lib/shaders/index.js");

// smaa is deliberately absent: its area/search lookups load through an Image,
// which needs a browser, so it would only ever sit the frame out here.
const EFFECT_NAMES = ["ssao", "taa", "motionBlur", "dof", "bloom", "combine", "final"];
const EFFECTS = {};
for (const name of EFFECT_NAMES) {
  // Effects are named in camelCase and filed in kebab-case, which the registry
  // bridges with an explicit specifier per entry.
  const file = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  EFFECTS[name] = (
    await import(`../lib/systems/render-pipeline/post-processing/${file}.js`)
  ).default;
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

/** Pool stub: hands out identity-tagged objects and recycles by descriptor. */
function createStubPool() {
  const free = new Map();
  let nextId = 1;
  return {
    acquireTexture(descriptor, usage) {
      const key = `${descriptor.format}|${descriptor.width}x${descriptor.height}|u${usage}`;
      return free.get(key)?.pop() ?? { id: nextId++, key, ...descriptor };
    },
    // Keyed by name and reallocating on a shape or usage change, like the real
    // pool. Both halves matter: handing back a fresh texture per call would
    // hide a ping-pong reading the target it just wrote, and ignoring usage
    // would hide the opposite — a resource reallocated, and so cleared, because
    // one frame writes it and the next only reads it.
    persistent: new Map(),
    acquirePersistentTexture(name, descriptor, usage) {
      const existing = this.persistent.get(name);
      const combined = (existing?.usage ?? 0) | usage;
      const key = `${descriptor.format}|${descriptor.width}x${descriptor.height}|u${combined}`;
      if (existing?.key === key) return existing.texture;
      const texture = { id: nextId++, name };
      this.persistent.set(name, { texture, key, usage: combined });
      return texture;
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

// Enough of a context for the effects that build their own fixed textures
// (ssao's noise): they key WeakMaps on it and call pex-gpu's createTexture,
// which only needs a device that can hand one back.
const ctx = {
  device: {
    createTexture: (descriptor) => ({
      ...descriptor,
      createView: () => ({}),
      destroy() {},
    }),
    queue: { writeTexture() {}, submit() {}, writeBuffer() {} },
  },
};

/**
 * One frame of post-processing at `viewport`, run through the pipeline's stage
 * sequence so each effect lands where it asked to.
 */
async function declareFrame(
  viewport,
  postProcessing,
  load,
  {
    msaa = 0,
    resolveDepth = false,
    frameIndex = 0,
    pool,
    cameraEntity: reuse,
    omit,
  } = {},
) {
  const graph = new FrameGraph(undefined);
  // Shared across calls when the caller is driving consecutive frames: the
  // history only means anything if the same pool hands it back.
  graph.pool = pool ?? createStubPool();

  const system = {
    ...postProcessingMethods({ ctx, frameGraph: graph }),
    time: 0,
    frameIndex,
    samplers: { linear: { id: "l" }, nearest: { id: "n" }, linearRepeat: { id: "r" } },
    drawFullscreen() {},
  };
  for (const name of load) system.postProcessingEffects.set(name, EFFECTS[name]);

  // Reused across frames where the test drives consecutive ones: the effect
  // keys its history bookkeeping on the camera entity.
  const cameraEntity = reuse ?? {
    id: "cam",
    camera: {
      near: 0.1,
      far: 100,
      fov: 1,
      fStop: 2.8,
      focalLength: 50,
      viewMatrix: new Float32Array(16),
      // Written by the engine only while temporal antialiasing is on.
      _jitter: [0, 0],
      _viewProjectionMatrix: new Float32Array(16),
      _previousViewProjectionMatrix: new Float32Array(16),
      _inverseViewProjectionMatrix: new Float32Array(16),
    },
  };
  cameraEntity.postProcessing = postProcessing;
  const renderView = {
    camera: cameraEntity.camera,
    cameraEntity,
    viewport: [0, 0, ...viewport],
  };

  let textures;
  await graph.setup(() => {
    textures = new RenderTextures(graph, renderView);
    const target = (label, format = "rgba16float") =>
      graph.createTexture({
        label,
        width: viewport[0],
        height: viewport[1],
        format,
      });

    textures.set("color", target("color"));
    textures.set("normal", target("normal"));
    textures.set("emissive", target("emissive"));
    if (omit !== "velocity") {
      textures.set("velocity", target("velocity", "rg16float"));
    }
    textures.set("responsive", target("responsive", "r8unorm"));

    // WebGPU has no depth resolve, so under MSAA the scene's depth buffer is
    // multisampled and unbindable until the pipeline resolves it.
    if (omit !== "depth") textures.set(
      "depth",
      graph.createTexture({
        label: "depth",
        width: viewport[0],
        height: viewport[1],
        format: "depth24plus",
        ...(msaa && { sampleCount: msaa }),
      }),
    );
    if (resolveDepth) textures.set("depth", target("depthResolve", "depth24plus"));

    const byStage = system.postProcessingEffectsByStage.call(
      system,
      cameraEntity,
    );
    for (const stage of ["prePass", "opaque", "postProcessing", "present"]) {
      system.renderPostProcessing.call(system, {
        renderView,
        textures,
        effects: byStage.get(stage),
      });
      byStage.delete(stage);
    }

    // Stands in for the blit and for combine reading the pyramid; without a
    // reader outside the graph the whole chain would correctly be culled.
    graph.exportTexture(textures.require("color"));
    const glare = textures.get("bloom.threshold");
    if (glare) graph.exportTexture(glare);
    // Ambient occlusion's reader is the opaque mesh pass, which declares it
    // through the standard renderer's inputs() — no mesh passes here, so the
    // export stands in for that instead.
    const occlusion = textures.get("ssao.main");
    if (occlusion) graph.exportTexture(occlusion);
  });

  const plan = graph.compile();
  const names = plan.passes.flatMap((pass) =>
    pass.subPasses.map((sub) =>
      sub.name.replace(/^postProcessing\.|\.cam$/g, ""),
    ),
  );
  const resourceOf = (pass) =>
    plan.resources.find((r) => r.name === pass.color[0]?.handle.name);

  return { plan, textures, names, resourceOf, pool: graph.pool, cameraEntity };
}

const bloomComponent = (extra) => ({
  quality: 1,
  colorFunction: "luma",
  threshold: 1,
  source: false,
  radius: 1,
  intensity: 0.1,
  ...extra,
});

// ─── Bloom pyramid depth follows the viewport ────────────────────────────────
{
  const levelsAt = async (viewport, extra) => {
    const { names } = await declareFrame(
      viewport,
      { exposure: 1, bloom: bloomComponent(extra) },
      ["bloom"],
    );
    return names.filter((name) => name.includes("downsample")).length;
  };

  console.log("Bloom level count derived from the viewport");
  check("720p", await levelsAt([1280, 720]), 6);
  check("1080p", await levelsAt([1920, 1080]), 7);
  check("4K", await levelsAt([3840, 2160]), 8);
  check("small (320x200)", await levelsAt([320, 200]), 4);
  // Never zero, and never a level with nothing left to gather from.
  check("tiny (16x16)", await levelsAt([16, 16]), 1);
  check("explicit count is honoured", await levelsAt([1920, 1080], { levels: 3 }), 3);
  check("explicit count is still capped", await levelsAt([320, 200], { levels: 9 }), 4);
}

// ─── The progressive upsample chain ──────────────────────────────────────────
{
  const { plan, names, resourceOf } = await declareFrame(
    [1920, 1080],
    { exposure: 1, bloom: bloomComponent() },
    ["bloom"],
  );

  console.log("\nBloom declares threshold, then down, then back up");
  check("pass order", names, [
    "bloom.threshold",
    ...Array.from({ length: 7 }, (_, i) => `bloom.downsample[${i}]`),
    ...Array.from({ length: 7 }, (_, i) => `bloom.upsample[${6 - i}]`),
  ]);

  const upsamples = plan.passes.filter((pass) =>
    pass.subPasses.some((sub) => sub.name.includes("upsample")),
  );

  // Each level is added into the level above it at that level's size — not all
  // of them into the full-resolution target, which costs one full-screen draw
  // per level and asks a nine-tap tent to bridge a gap of 2^n texels.
  console.log("\nEach level accumulates into the one above it");
  check(
    "targets climb the pyramid",
    upsamples.map((pass) => resourceOf(pass)?.name),
    [
      "bloom.downsample[5]_cam",
      "bloom.downsample[4]_cam",
      "bloom.downsample[3]_cam",
      "bloom.downsample[2]_cam",
      "bloom.downsample[1]_cam",
      "bloom.downsample[0]_cam",
      "bloom.threshold_cam",
    ],
  );
  // A clear here would discard the level being accumulated onto.
  check(
    "loadOp is load, not clear",
    [...new Set(upsamples.map((pass) => pass.color[0]?.loadOp))],
    ["load"],
  );

  console.log("\nGraph invariants");
  check("nothing culled", plan.culledPasses, []);
  check(
    "no pass reads and writes one resource",
    plan.passes
      .filter((pass) => pass.reads.some((read) => pass.writes.includes(read)))
      .map((pass) => pass.name),
    [],
  );
  // Merging two would make them one render pass sharing one attachment, which
  // is only correct because they do not; if that ever changes, additive
  // accumulation across the pair needs rechecking.
  check(
    "no two upsamples merged",
    plan.passes.filter((pass) => pass.subPasses.length > 1).map((p) => p.name),
    [],
  );

  const base = 1920 * 1080;
  const fill = plan.passes.reduce((total, pass) => {
    const resource = resourceOf(pass);
    return (
      total + (resource ? resource.descriptor.width * resource.descriptor.height : 0)
    );
  }, 0);
  console.log(`\nBloom fill: ${(fill / base).toFixed(2)}x one full-screen draw`);
  // A full-resolution draw per level lands around 9x; the progressive chain is
  // one full-resolution draw plus a geometric series.
  check("under 3x", fill / base < 3, true);
}

// ─── The whole chain together ────────────────────────────────────────────────
// What exercises the register hand-off: ssao publishes what combine reads,
// bloom what combine adds, and each chaining pass republishes "color".
{
  const { plan, names } = await declareFrame(
    [1920, 1080],
    {
      exposure: 1,
      toneMap: "aces",
      opacity: 0.5,
      fxaa: { quality: 2, subPixelQuality: 0.75 },
      ssao: {
        type: "gtao",
        mix: 1,
        radius: 0.5,
        brightness: 0,
        contrast: 1,
        slices: 3,
        samples: 3,
        bentNormals: true,
        radiusMultiplier: 1.457,
        falloffRange: 0.615,
        sampleDistributionPower: 2,
        thinOccluderCompensation: 0,
        finalValuePower: 2.2,
        depthMipSamplingOffset: 3.3,
        denoisePasses: 2,
        denoiseBlurBeta: 1.2,
      },
      dof: {
        type: "gustafsson",
        samples: 4,
        focusDistance: 5,
        focusScale: 1,
        screenPoint: [0.5, 0.5],
        chromaticAberration: 0,
        luminanceThreshold: 1,
        luminanceGain: 1,
        shape: "circle",
      },
      bloom: bloomComponent(),
    },
    EFFECT_NAMES,
  );

  console.log("\nFull chain");
  check(
    "every enabled effect declared",
    [...new Set(names.map((name) => name.split(".")[0]))],
    ["ssao", "dof", "bloom", "combine", "final"],
  );
  // Occlusion is a lighting input, so it is complete before anything is shaded
  // — which is the whole chain, DoF included.
  check(
    "ssao finishes before the image chain starts",
    names.lastIndexOf("ssao.denoise[1]") < names.indexOf("dof.main"),
    true,
  );
  check(
    "combine composites after the pyramid",
    names.indexOf("combine.main") > names.lastIndexOf("bloom.upsample[0]"),
    true,
  );
  check("final ends the chain", names.at(-1), "final.main");
  check("nothing culled", plan.culledPasses, []);
}

// ─── Depth-consuming effects under MSAA ──────────────────────────────────────
// Everything reading depth sits out while the only depth is multisampled, and
// runs once the pipeline republishes a resolved one — which is the whole reason
// the depth resolve pass exists.
{
  const dofComponent = {
    exposure: 1,
    dof: {
      type: "gustafsson",
      samples: 4,
      focusDistance: 5,
      focusScale: 1,
      screenPoint: [0.5, 0.5],
      chromaticAberration: 0,
      luminanceThreshold: 1,
      luminanceGain: 1,
      shape: "circle",
    },
  };

  const declaredWith = async (options) =>
    (await declareFrame([1920, 1080], structuredClone(dofComponent), ["dof"], options))
      .names.filter((name) => name.startsWith("dof."));

  console.log("\nDepth readers under MSAA");
  check("no MSAA: dof runs", await declaredWith({}), ["dof.main"]);
  check("MSAA, unresolved: dof sits out", await declaredWith({ msaa: 4 }), []);
  check(
    "MSAA, resolved: dof runs again",
    await declaredWith({ msaa: 4, resolveDepth: true }),
    ["dof.main"],
  );
}

// ─── Temporal antialiasing accumulates across frames ─────────────────────────
// The history is the one resource that has to outlive the frame, and the one
// whose bugs a screenshot cannot show: a ping-pong that reads the texture it
// just wrote self-feeds into a frozen image, and a history the pool recycles
// comes back holding some other pass's pixels.
{
  const taaPass = (frame) => {
    const pass = frame.plan.passes.find((p) =>
      p.subPasses.some((sub) => sub.name.includes("taa")),
    );
    if (!pass) return null;
    return {
      writes: pass.color.map((c) => c.handle.name),
      // reads are indices into plan.resources.
      reads: pass.reads.map((index) => frame.plan.resources[index].name),
    };
  };

  const component = { exposure: 1, taa: {} };

  console.log("\nTemporal antialiasing history");

  const frame0 = await declareFrame([320, 200], component, ["taa"]);
  const carry = { pool: frame0.pool, cameraEntity: frame0.cameraEntity };
  const frame1 = await declareFrame([320, 200], component, ["taa"], { ...carry, frameIndex: 1 });
  const frame2 = await declareFrame([320, 200], component, ["taa"], { ...carry, frameIndex: 2 });

  // Alternating by frame parity, because a pass may not read and write one
  // handle — and the graph enforces that, so a single buffer would throw.
  check("writes alternate by parity", [frame0, frame1, frame2].map((f) => taaPass(f).writes), [
    ["taa.history0.cam"],
    ["taa.history1.cam"],
    ["taa.history0.cam"],
  ]);

  // The half it is not writing. Reading the same one every frame would look
  // right for one frame and then accumulate nothing.
  check("reads the other half", [frame0, frame1, frame2].map((f) =>
    taaPass(f).reads.filter((name) => name.startsWith("taa.history")),
  ), [
    ["taa.history1.cam"],
    ["taa.history0.cam"],
    ["taa.history1.cam"],
  ]);

  // Both halves, every frame: the read side has no producing pass, so only a
  // persistent declaration gives it a handle at all — and persistence is what
  // keeps the pool from handing its texture to something else mid-frame.
  check(
    "both halves are persistent",
    frame0.plan.resources.filter((r) => r.persistent).map((r) => r.name),
    ["taa.history0.cam", "taa.history1.cam"],
  );

  // Publishing the accumulated image as "color" is what splices it into the
  // chain; without it every later effect would read the jittered frame.
  check("publishes the accumulated image", frame2.textures.get("color").name, "taa.history0.cam");

  // Same rule as every other depth consumer: a multisampled depth buffer is not
  // something a reader can bind, so the effect sits the frame out.
  const msaa = await declareFrame([320, 200], component, ["taa"], { msaa: 4 });
  check("sits out while depth is multisampled", msaa.names, []);
  const resolved = await declareFrame([320, 200], component, ["taa"], { msaa: 4, resolveDepth: true });
  check("runs once depth is resolved", resolved.names, ["taa.main"]);

  // The effect's side of the hand-off: what a frame reads is what the frame
  // before it wrote, by texture identity rather than by name. The pool's side —
  // that a persistent texture is not reallocated when its usage changes, which
  // is what a ping-pong does to it every frame — is covered against the real
  // pool in test/frame-graph.js, since the stub here cannot fail that way.
  {
    const physical = (frame, name) =>
      frame.plan.resources.find((r) => r.name === name).physicalId;
    const written = (frame) => {
      const pass = frame.plan.passes.find((p) =>
        p.subPasses.some((sub) => sub.name.includes("taa")),
      );
      return pass.color[0].handle.name;
    };

    const pool = createStubPool();
    const frames = [];
    let entity;
    for (let i = 1; i <= 5; i++) {
      const f = await declareFrame([64, 64], component, ["taa"], {
        frameIndex: i,
        pool,
        ...(entity && { cameraEntity: entity }),
      });
      entity = f.cameraEntity;
      frames.push(f);
    }

    // What frame n reads is the texture frame n-1 wrote, by identity — not just
    // by name. Allow the first two frames to settle, since usage only reaches
    // its union once each half has been written once.
    const carried = frames.slice(3).map((frame, i) => {
      const previous = frames[i + 2];
      return physical(frame, written(previous)) === physical(previous, written(previous));
    });
    check("history survives between frames", carried, [true, true]);
  }

  // Motion vectors are the whole reason the effect asks for an extra main-pass
  // output; reading them has to become a real edge, or the resolve silently
  // falls back to camera reprojection and everything that moved on its own
  // drags behind it.
  check(
    "asks the main pass for motion vectors",
    EFFECTS.taa.outputs.includes("velocity"),
    true,
  );
  check(
    "reads motion vectors when the main pass produced them",
    taaPass(frame2).reads.includes("velocity"),
    true,
  );

  // The mask is how a surface says its motion vectors do not describe it; the
  // resolve raises the blend factor towards the current frame where it is set.
  // Without the read edge the resolve would keep blending history into exactly
  // the surfaces that asked it not to.
  check(
    "asks the main pass for the responsive mask",
    EFFECTS.taa.outputs.includes("responsive"),
    true,
  );
  check(
    "reads the responsive mask when the main pass produced it",
    taaPass(frame2).reads.includes("responsive"),
    true,
  );

  // Disocclusion rejection reads last frame's depth and records this frame's
  // into the same texture, which only works because the graph orders the write
  // after the read. Reversed, the resolve would compare this frame's depth
  // against itself, match everywhere, and reject nothing — with no error and
  // nothing on screen to say the test had stopped working.
  {
    const withDepth = { exposure: 1, taa: { disocclusionTolerance: 0.02 } };
    const frame = await declareFrame([64, 64], withDepth, ["taa"], { frameIndex: 4 });
    const pass = taaPass(frame);
    const record = frame.plan.passes.find((p) =>
      p.subPasses.some((sub) => sub.name.includes("depthHistory")),
    );

    console.log("\nDisocclusion rejection");

    check(
      "the resolve reads the recorded depth",
      pass.reads.filter((name) => name.includes("depthHistory")),
      ["taa.depthHistory.cam"],
    );
    check(
      "and the recording happens after it",
      frame.names.indexOf("taa.main") < frame.names.indexOf("taa.depthHistory"),
      true,
    );
    check(
      "one texture serves both directions",
      record.color.map((c) => c.handle.name),
      ["taa.depthHistory.cam"],
    );
    // It has to outlive the frame like the colour history, and for the same
    // reason: nothing rewrites it before the next frame reads it.
    check(
      "kept between frames",
      frame.plan.resources.find((r) => r.name.includes("depthHistory")).persistent,
      true,
    );

    // Neither the pass nor the texture exists when the test is switched off.
    const without = await declareFrame([64, 64], { exposure: 1, taa: {} }, ["taa"], {
      frameIndex: 4,
    });
    check(
      "skipped entirely at zero tolerance",
      [
        without.names.includes("taa.depthHistory"),
        without.plan.resources.some((r) => r.name.includes("depthHistory")),
      ],
      [false, false],
    );
  }

  // Sharpening an image that gets sharpened again next frame compounds without
  // bound, so what the sharpener writes must never reach the accumulator.
  {
    const sharpened = await declareFrame(
      [64, 64],
      { exposure: 1, taa: { sharpness: 0.5 } },
      ["taa"],
      { frameIndex: 4 },
    );
    const sharpen = sharpened.plan.passes.find((p) =>
      p.subPasses.some((sub) => sub.name.includes("sharpen")),
    );

    console.log("\nSharpening");

    check(
      "reads the resolved image",
      sharpen.reads.map((i) => sharpened.plan.resources[i].name),
      ["taa.history0.cam"],
    );
    check(
      "writes somewhere other than the history",
      sharpen.color.every((c) => !c.handle.name.startsWith("taa.history")),
      true,
    );
    check(
      "and that is what the chain carries on with",
      sharpened.textures.get("color").name,
      sharpen.color[0].handle.name,
    );
  }

  // Ahead of everything that consumes the image, so bloom's pyramid and the
  // tonemap see a stable one rather than a jittered frame.
  const chained = await declareFrame(
    [320, 200],
    { exposure: 1, taa: {}, bloom: bloomComponent() },
    ["taa", "bloom", "combine"],
  );
  check(
    "resolves before the image is consumed",
    chained.names.indexOf("taa.main") < chained.names.indexOf("bloom.threshold"),
    true,
  );
}

// ─── Motion blur reduces the velocity buffer before gathering ───────────────
// The tile grid is what bounds the filter: it can only smear along a motion
// some tile recorded, and only as far as one tile out. A grid derived from the
// wrong size silently truncates long streaks instead of failing.
{
  const component = { intensity: 1, tileSize: 40, samples: 35 };
  const frame = await declareFrame(
    [1280, 720],
    { exposure: 1, motionBlur: component },
    ["motionBlur"],
  );
  const sized = (name) => {
    const pass = frame.plan.passes.find((p) =>
      p.subPasses.some((sub) => sub.name.includes(name)),
    );
    const resource = frame.plan.resources.find(
      (r) => r.name === pass.color[0].handle.name,
    );
    return [resource.descriptor.width, resource.descriptor.height];
  };

  console.log("\nMotion blur");

  check("reduces, widens, then gathers", frame.names, [
    "motionBlur.tileMaxX",
    "motionBlur.tileMaxY",
    "motionBlur.neighborMax",
    "motionBlur.main",
  ]);

  // Separable: the first pass keeps full height, the second brings it down.
  check("tile grid follows the viewport", [sized("tileMaxX"), sized("tileMaxY")], [
    [32, 720],
    [32, 18],
  ]);
  check("the neighbourhood keeps that grid", sized("neighborMax"), [32, 18]);

  // Both are structural — nothing to smear along, and nothing to order samples
  // by — so the effect sits the frame out rather than drawing something wrong.
  for (const missing of ["velocity", "depth"]) {
    const partial = await declareFrame(
      [320, 200],
      { exposure: 1, motionBlur: component },
      ["motionBlur"],
      { omit: missing },
    );
    check(`sits out without ${missing}`, partial.names, []);
  }

  // A shutter held closed is not a cheap blur, it is no blur.
  const closed = await declareFrame(
    [320, 200],
    { exposure: 1, motionBlur: { intensity: 0 } },
    ["motionBlur"],
  );
  check("skipped entirely at zero intensity", closed.names, []);

  // After the resolve: what should be smeared is the accumulated image, not a
  // jittered frame, and blurring before it would feed the accumulator streaks.
  const chained = await declareFrame(
    [320, 200],
    { exposure: 1, taa: {}, motionBlur: component },
    ["taa", "motionBlur"],
    { frameIndex: 4 },
  );
  check(
    "smears what the resolve produced",
    chained.names.indexOf("taa.main") < chained.names.indexOf("motionBlur.main"),
    true,
  );
}

// ─── The shared uniform block ────────────────────────────────────────────────
// A member the driver never writes reads as zero rather than throwing, and a
// zero texel size collapses every neighbour tap onto the centre.
{
  const DRIVER_KEYS = ["viewportSize", "texelSize", "sourceTexelSize", "time"];

  const members = (wgsl) =>
    /struct PostProcessing \{([^}]*)\}/
      .exec(wgsl)?.[1]
      .split(",")
      .map((line) => line.split(":")[0].trim())
      .filter(Boolean);

  const variants = {
    threshold: shaders.thresholdShader(new Set()),
    downsample: shaders.downsampleShader(new Set()),
    upsample: shaders.upsampleShader(new Set()),
    gtao: shaders.gtaoShader(new Set()),
    sao: shaders.saoShader(new Set()),
    combine: shaders.combineShader(new Set()),
    dof: shaders.dofShader(new Set(["USE_DOF_GUSTAFSSON"])),
    "final [fxaa]": shaders.finalShader(new Set(["USE_FXAA"])),
    "smaa edges": shaders.smaaEdgesShader(new Set(["SMAA_EDGES_COLOR"])),
  };

  console.log("\nPostProcessing uniform block matches what the driver writes");
  for (const [name, wgsl] of Object.entries(variants)) {
    check(name, members(wgsl), DRIVER_KEYS);
  }

  // The taps offset a coordinate that is about to sample the source, so they
  // step in the source's grid — the two differ at every level of bloom.
  console.log("\nNeighbour taps step in the source grid");
  for (const name of ["downsample", "upsample", "final [fxaa]"]) {
    check(
      name,
      /texCoord0(LeftUp|Down) = .*uPostProcessing\.texelSize/.test(variants[name]),
      false,
    );
  }
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
