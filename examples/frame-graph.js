import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
  memoryTimeline,
  utils,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";

import { cube, sphere, torus } from "primitive-geometry";

import { getURL } from "./utils.js";
import { getRenderPassGraphViz } from "./graph-viz.js";
import {
  copyShader,
  ssrCompositeShader,
  ssrTraceShader,
  tintedGrabShader,
} from "./frame-graph-ssr.js";

// Exercises the frame graph's extension points from outside the engine, with
// screen-space reflections as the payload:
//
// - afterPass(name), positioning a pass against another pass rather than a
//   phase — no stage needed, and nothing declared on the pipeline's side. The
//   one here reads the opaque image and republishes it, so the scene passes
//   after it draw into what it produced. The same effect is also declared from
//   the "afterScene" stage, which is what MSAA needs.
// - stage("outputs"), which runs before the main pass is declared and collects
//   what it should produce — the only hook early enough to ask for an
//   attachment, since every later one hands over textures that already exist.
// - stage("postProcessing"), which hands over the view's RenderTextures:
//   the images the frame has produced so far, by name. Reading one and
//   publishing one are the whole injection protocol — the passes below splice
//   themselves in by publishing "color", and their other outputs land under
//   names the debug picker and the GUI then ask for.
// - describe() to size and format a texture from what it is about to read
// - createTexture/createBuffer/importTexture/exportTexture, and a persistent
//   texture the GUI holds between frames
// - overridePass to replace the engine's grab pass, disablePass to drop one
// - inspect()/memoryTimeline()/poolStats() as a debug overlay
//
// SSR is a demo, not an engine feature: single ray, no roughness, no temporal
// reprojection.

random.seed(3);

const State = {
  autoRotate: true,

  ssr: true,
  intensity: 1,
  maxDistance: 8,
  thickness: 0.5,
  steps: 32,
  jitter: 1,

  tintedGrab: false,
  tintColor: [1, 0.4, 0.1],
  tintSaturation: 0.2,

  gradeAt: "",
  gradeColor: [0.55, 0.8, 1],
  gradeSaturation: 0.35,

  freezeCapture: false,
  timeline: false,
};

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx });
const world = createWorld();
console.log(renderEngine);


const { frameGraph } = renderEngine;
const renderPipeline = renderEngine.systems.find(
  (system) => system.type === "render-pipeline-system",
);
// SSR reads view-space normals, which the main pass only writes when something
// asks for them. Requested per view at the "outputs" stage rather than by
// mutating the pipeline's own set, which is global to every camera.
//
// Requested unconditionally rather than following the effect toggle: outputs
// are attachments on the main pass, so a set that changes relayouts it and
// recompiles every material pipeline. It costs one full-resolution target even
// while SSR is off — the pipeline hands its color attachments back to the
// caller, so the graph sees a reader for the normal target whether or not
// anything samples it.
frameGraph.on("outputs", ({ outputs }) => outputs.add("normal"));

const renderPassGraphViz = getRenderPassGraphViz();
renderPassGraphViz.init(ctx, frameGraph);

// Entities
const cameraEntity = createEntity({
  transform: components.transform({ position: [0, 1.2, 4] }),
  camera: components.camera({ fov: Math.PI / 4, near: 0.1, far: 30 }),
  orbiter: components.orbiter({ element: ctx.canvas, target: [0, 0.5, 0] }),
  postProcessing: components.postProcessing(),
});
world.add(cameraEntity);
// Only for wiring the GUI to names the callback below builds per camera.
const cameraId = cameraEntity.id;

const floorEntity = createEntity({
  transform: components.transform({ position: [0, -0.05, 0] }),
  geometry: components.geometry(cube({ sx: 14, sy: 0.1, sz: 14 })),
  material: components.material({
    baseColor: [0.08, 0.08, 0.09, 1],
    metallic: 0,
    roughness: 0.25,
    receiveShadows: true,
    castShadows: false,
  }),
});
world.add(floorEntity);

const torusEntity = createEntity({
  transform: components.transform({ position: [-1.1, 0.7, 0] }),
  geometry: components.geometry(torus({ radius: 0.5, minorRadius: 0.15 })),
  material: components.material({
    baseColor: [1.6, 0.35, 0.2, 1],
    metallic: 0,
    roughness: 0.35,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(torusEntity);

for (let i = 0; i < 5; i++) {
  const radius = random.float(0.15, 0.35);
  world.add(
    createEntity({
      transform: components.transform({
        position: [random.float(-2.5, 2.5), radius, random.float(-2, 1)],
      }),
      geometry: components.geometry(sphere({ radius })),
      material: components.material({
        baseColor: [random.float(0.3, 2), random.float(0.3, 2), 0.6, 1],
        metallic: 0,
        roughness: random.float(0.1, 0.6),
        receiveShadows: true,
        castShadows: true,
      }),
    }),
  );
}

// The grab pass only exists when something is transmissive, and the override
// demo replaces it.
const transmittedEntity = createEntity({
  transform: components.transform({ position: [1.3, 0.75, 0.4] }),
  geometry: components.geometry(sphere({ radius: 0.75 })),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.05,
    transmission: 1,
    thickness: 1,
    ior: 1.5,
    receiveShadows: false,
    castShadows: false,
  }),
});
world.add(transmittedEntity);

world.add(
  createEntity({
    skybox: components.skybox({
      envMap: await loaders.hdr(ctx, getURL("assets/envmaps/garage/garage.hdr")),
    }),
    reflectionProbe: components.reflectionProbe(),
  }),
);

world.add(
  createEntity({
    transform: components.transform({
      position: [2, 3, 2],
      rotation: quat.fromPointToPoint(quat.create(), [2, 3, 2], [0, 0, 0]),
    }),
    directionalLight: components.directionalLight({
      color: [1, 1, 1, 1],
      intensity: 3,
      castShadows: true,
      bias: 0.05,
    }),
  }),
);

// ─── Resources the injected passes need, owned outside the graph ─────────────
// Everything here lives for the lifetime of the context: the graph only owns
// what lasts one frame.
const fullscreen = {
  attributes: {
    position: gpu.createBuffer(ctx, {
      label: "ssrFullscreenTriangle",
      usage: "vertex",
      data: utils.fullscreenTriangle.positions,
    }),
  },
  count: 3,
};

const NOISE_SIZE = 64;
const noiseData = new Uint8Array(NOISE_SIZE ** 2 * 4);
for (let i = 0; i < noiseData.length; i++) noiseData[i] = 255 * random.float();
const noiseTexture = gpu.createTexture(ctx, {
  label: "ssrNoiseTexture",
  width: NOISE_SIZE,
  height: NOISE_SIZE,
  format: "rgba8unorm",
  data: noiseData,
});

// Halton(2), so consecutive steps land in different parts of the interval.
// prettier-ignore
const MARCH_OFFSETS = Float32Array.of(0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875);

const samplers = {
  linear: gpu.createSampler(ctx, { filter: "linear" }),
  nearest: gpu.createSampler(ctx, { filter: "nearest" }),
  linearRepeat: gpu.createSampler(ctx, {
    filter: "linear",
    addressMode: "repeat",
  }),
};

// pex-gpu caches compiled pipelines by descriptor identity, so these are
// created once rather than per frame.
const pipelines = {
  trace: {
    vertex: ssrTraceShader,
    fragment: ssrTraceShader,
    depthWriteEnabled: false,
  },
  composite: {
    vertex: ssrCompositeShader,
    fragment: ssrCompositeShader,
    depthWriteEnabled: false,
  },
  copy: { vertex: copyShader, fragment: copyShader, depthWriteEnabled: false },
  tintedGrab: {
    vertex: tintedGrabShader,
    fragment: tintedGrabShader,
    depthWriteEnabled: false,
  },
};

const CAPTURE_SIZE = 256;

// ─── Injection, positioned two ways ──────────────────────────────────────────
// The same effect — read the image, write a graded copy, publish it as "color"
// — declared from either of the two kinds of injection point, to show what the
// choice costs.
//
// Modifying in place is the one thing not on offer: a pass may not read and
// write the same handle, so a mid-frame edit is always a copy into a new
// texture.
const declareGrade = (textures, label) => {
  const color = textures.get("color");
  const { format, width, height } = frameGraph.describe(color);

  const graded = frameGraph.createTexture({
    label: `${label}_${cameraId}`,
    width,
    height,
    format,
  });

  frameGraph.addPass({
    name: `Grade_${cameraId}`,
    color: [{ texture: graded }],
    uniforms: { uTexture: color },
    execute: ({ uniforms }) => {
      gpu.submit(ctx, {
        label: "grade",
        ...fullscreen,
        pipeline: pipelines.tintedGrab,
        uniforms: {
          ...uniforms,
          uTint: { color: State.gradeColor, saturation: State.gradeSaturation },
        },
      });
    },
  });

  textures.set("color", graded);
  textures.set("grade", graded);
};

// Against a pass. "Right after the main pass" is a position, not a phase, so it
// needs no stage of its own — every pass is an injection point under its own
// name, and the pipeline declares nothing extra for this to work. The passes
// after it resolve their attachment from the register when they declare, so
// transparency and refraction land on the graded image and the glass sphere is
// not itself graded. Under MSAA they are still drawing into the multisampled
// attachment, which no single-sample image can be loaded back into, so the
// republish is reported and ignored.
frameGraph.afterPass(`main.${cameraId}`, ({ renderView }) => {
  if (State.gradeAt !== "afterMainPass") return;

  declareGrade(
    frameGraph.blackboard.get(`renderTextures.${renderView.cameraEntity.id}`),
    "gradeOpaque",
  );
});

// Against a phase. The scene is finished and, under MSAA, resolved: replacing
// the image works here whatever the sample count. The cost is that the grade
// now covers the transparent and transmissive objects too.
frameGraph.on("postProcessing", (textures) => {
  if (State.gradeAt !== "afterScene") return;

  declareGrade(textures, "gradeScene");
});

// ─── Injected SSR ────────────────────────────────────────────────────────────
// Declared every frame from the pipeline's postProcessing stage. Nothing
// here touches the GPU: the graph records declarations and executes them after
// compiling.
//
// The stage hands over the view's register: the images the frame has produced
// so far, under the names the rest of the frame knows them by. Reading a name
// and publishing under a name are the only two operations, and they are the
// same ones the pipeline's own passes use.
frameGraph.on("postProcessing", (textures) => {
  if (!State.ssr) return;

  const color = textures.get("color");
  const depth = textures.get("depth");
  const normal = textures.get("normal");

  // Nothing published under those names: the pipeline was not asked for the
  // normal target, or depth is multisampled and cannot be sampled. Sit the
  // frame out rather than fail validation — the register hands back what a pass
  // can bind, so there is nothing else to check.
  if (!color || !depth || !normal) return;

  // The graph already knows the format and size of what is about to be read;
  // taking them from there is what keeps a replacement interchangeable with
  // what it replaced.
  const { format: colorFormat } = frameGraph.describe(color);

  const { renderView } = textures;
  // One graph spans every camera, so the stage fires once per camera and every
  // pass name has to carry the view it belongs to.
  const viewId = renderView.cameraEntity.id;
  const width = renderView.viewport[2];
  const height = renderView.viewport[3];

  // Half resolution. A pooled, short-lived target: the graph recycles it into
  // whatever comes next once the composite has read it.
  const reflection = frameGraph.createTexture({
    label: `ssrReflection_${viewId}`,
    width: Math.max(1, Math.ceil(width / 2)),
    height: Math.max(1, Math.ceil(height / 2)),
    format: colorFormat,
  });

  // Immutable upload, content-addressed by the pool: same label, usage and
  // size hands back the same buffer every frame.
  const marchOffsets = frameGraph.createBuffer({
    label: "ssrMarchOffsets",
    usage: "read-only-storage",
    data: MARCH_OFFSETS,
  });

  // The graph doesn't own the noise texture, it only needs to know a pass reads
  // it — which is what makes it show up in inspect() and the graph viz.
  const noise = frameGraph.importTexture(noiseTexture, "ssrNoise");

  const camera = renderView.camera;

  frameGraph.addPass({
    name: `SSR.Trace_${viewId}`,
    color: [{ texture: reflection, clearValue: [0, 0, 0, 0] }],
    // Buffers have no attachment to derive a read edge from, so the dependency
    // is declared by hand and resolved in execute.
    reads: [marchOffsets],
    // Handle-valued uniforms become read edges of their own and arrive as
    // physical textures.
    uniforms: {
      uSSR: {
        viewportSize: [width, height],
        near: camera.near,
        far: camera.far,
        fov: camera.fov,
        aspect: camera.aspect,
        intensity: State.intensity,
        maxDistance: State.maxDistance,
        thickness: State.thickness,
        steps: State.steps,
        jitter: State.jitter,
      },
      uTexture: color,
      uTextureSampler: samplers.linear,
      uDepthTexture: depth,
      uDepthTextureSampler: samplers.nearest,
      uNormalTexture: normal,
      uNormalTextureSampler: samplers.nearest,
      uNoiseTexture: noise,
      uNoiseTextureSampler: samplers.linearRepeat,
    },
    renderView,
    execute: ({ uniforms, resolveBuffer }) => {
      gpu.submit(ctx, {
        label: "ssrTrace",
        ...fullscreen,
        pipeline: pipelines.trace,
        uniforms: { ...uniforms, uMarchOffsets: resolveBuffer(marchOffsets) },
      });
    },
  });

  const composite = frameGraph.createTexture({
    label: `ssrComposite_${viewId}`,
    width,
    height,
    // The chain's own format, not a guess: whatever replaces the image has to
    // read like the image it replaced.
    format: colorFormat,
  });

  frameGraph.addPass({
    name: `SSR.Composite_${viewId}`,
    color: [{ texture: composite }],
    uniforms: {
      uTexture: color,
      uTextureSampler: samplers.linear,
      uReflectionTexture: reflection,
      uReflectionTextureSampler: samplers.linear,
    },
    renderView,
    execute: ({ uniforms }) => {
      gpu.submit(ctx, {
        label: "ssrComposite",
        ...fullscreen,
        pipeline: pipelines.composite,
        uniforms,
      });
    },
  });

  // Splices the two passes into the frame: post-processing, and the blit after
  // it, read "color" when their turn comes, and this is what they now find.
  // Nothing had to be told the passes exist.
  textures.set("color", composite);

  // Read by the GUI after the frame, which no pass can express: the export is
  // what stores the last write and keeps the texture out of the pool until the
  // frame ends. The identity still churns frame to frame, so the GUI has to
  // re-resolve the handle every frame (see the draw loop).
  frameGraph.exportTexture(reflection);

  // A fixed-size copy for the GUI thumbnail. Persistent: the same texture every
  // frame, so pex-gui can hold it — a pooled one would change identity, and
  // pex-gpu keys its bind group cache by texture. Costs one texture that is
  // never reclaimed, which is why the full-resolution textures above are not
  // persistent. The size is deliberately viewport-independent: a persistent
  // resource whose shape changes is reallocated, and identity is the point.
  const capture = frameGraph.createTexture({
    label: `ssrCapture_${viewId}`,
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    format: colorFormat,
    persistent: true,
  });

  frameGraph.addPass({
    name: `SSR.Capture_${viewId}`,
    color: [{ texture: capture }],
    uniforms: { uTexture: reflection, uTextureSampler: samplers.linear },
    execute: ({ uniforms }) => {
      gpu.submit(ctx, {
        label: "ssrCapture",
        ...fullscreen,
        pipeline: pipelines.copy,
        uniforms,
      });
    },
  });

  // Everything this callback produced besides the image itself, under names of
  // its own. The register is already per view and already what readers look in
  // — the pipeline's own debugRender, and the GUI after the frame — so there is
  // no second channel to invent and no view id to thread through the keys.
  textures.set("ssr.reflection", reflection);
  textures.set("ssr.composite", composite);
  textures.set("ssr.capture", capture);
});

// ─── Debug overlay ───────────────────────────────────────────────────────────
const timelineElement = document.createElement("pre");
Object.assign(timelineElement.style, {
  position: "absolute",
  left: "10px",
  bottom: "10px",
  margin: "0",
  padding: "8px 10px",
  font: "10px/1.4 Inconsolata, monospace",
  color: "white",
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  pointerEvents: "none",
  display: "none",
});
document.body.appendChild(timelineElement);

const formatBytes = (bytes) =>
  bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    : `${Math.ceil(bytes / 1024)}KB`;

/**
 * Resource lifetimes as rows on the pass timeline: where the peak sits, and
 * which resources share a physical texture (same #id on non-overlapping rows).
 */
function drawMemoryTimeline() {
  const inspection = frameGraph.inspect();
  const { passCount, rows } = memoryTimeline(inspection);
  const { memory, stats } = inspection;
  const pool = frameGraph.poolStats();

  timelineElement.textContent = [
    `${stats.declaredPasses} declared  ${stats.culledPasses} culled  ${stats.mergedPasses} merged  ${passCount} render passes`,
    `peak ${formatBytes(memory.peakBytes)} of ${formatBytes(memory.naiveBytes)} (saved ${formatBytes(memory.savedBytes)})`,
    `pool ${pool.textureCount} textures in ${pool.bucketCount} buckets, ${formatBytes(pool.liveBytes)} live / ${formatBytes(pool.idleBytes)} idle`,
    "",
    ...rows.map((row) => {
      let bar = "";
      for (let i = 0; i < passCount; i++) {
        bar += i >= row.firstUse && i <= row.lastUse ? "█" : "·";
      }
      return `${row.name.slice(0, 30).padEnd(30)} ${bar} ${formatBytes(row.bytes).padStart(7)} #${row.physicalId ?? "-"}`;
    }),
  ].join("\n");
}

// GUI
const gui = createGUI(ctx);
gui.addColumn("Frame graph");
gui.addFPSMeeter();
gui.addParam("Auto rotate", State, "autoRotate");
gui.addParam("Memory timeline", State, "timeline", null, (enabled) => {
  timelineElement.style.display = enabled ? "block" : "none";
});
gui.addButton("Toggle pass graph", () => renderPassGraphViz.toggle());
gui.addRadioList(
  "Present",
  renderPipeline,
  "debugRender",
  [
    // One namespace: the pipeline's own outputs, the post-processing sub-pass
    // outputs and whatever the injected effect published all answer to a name
    // in the same register, so debugRender is a single lookup.
    { name: "Final image", value: "" },
    { name: "G-buffer normals", value: "normal" },
    { name: "SSR reflection", value: "ssr.reflection" },
    { name: "SSR composite", value: "ssr.composite" },
    { name: "SSR capture", value: "ssr.capture" },
    { name: "Transmission grab", value: "transmission.grab" },
    { name: "Graded image", value: "grade" },
    { name: "Tonemapped (combine)", value: "combine.main" },
  ],
  // Pointing the presented image at an intermediate leaves everything that only
  // fed the original output unreferenced, so the graph culls it: the pass count
  // drops as soon as this is anything but the final image.
  () => renderPassGraphViz.isRendered() && renderPassGraphViz.draw(),
);

gui.addColumn("Injected SSR");
gui.addParam("Enabled", State, "ssr", null, () => {
  if (renderPassGraphViz.isRendered()) renderPassGraphViz.draw();
});
gui.addParam("Intensity", State, "intensity", { min: 0, max: 3 });
gui.addParam("Max distance", State, "maxDistance", { min: 1, max: 20 });
gui.addParam("Thickness", State, "thickness", { min: 0.05, max: 2 });
gui.addParam("Steps", State, "steps", { min: 4, max: 64, step: 1 });
gui.addParam("Jitter", State, "jitter", { min: 0, max: 1 });

gui.addColumn("Injected grade");
gui.addRadioList(
  "Injected at",
  State,
  "gradeAt",
  [
    { name: "Off", value: "" },
    { name: "After MainPass (no MSAA)", value: "afterMainPass" },
    { name: "After the scene", value: "afterScene" },
  ],
  () => {
    if (renderPassGraphViz.isRendered()) renderPassGraphViz.draw();
  },
);
gui.addParam("Grade color", State, "gradeColor");
gui.addParam("Grade saturation", State, "gradeSaturation", { min: 0, max: 1 });

gui.addColumn("Overrides");
// Replaces the pipeline's grab pass copy while keeping its declaration: same
// attachments, same uniforms — only what it draws changes. The refraction of
// the glass sphere is what samples the result.
gui.addParam("Tint grab pass", State, "tintedGrab", null, (enabled) => {
  frameGraph.overridePass(
    `GrabPassCopy_${cameraId}`,
    enabled
      ? (declaration) => ({
          ...declaration,
          execute: ({ uniforms }) => {
            gpu.submit(ctx, {
              label: "tintedGrabPassCopy",
              ...fullscreen,
              pipeline: pipelines.tintedGrab,
              uniforms: {
                ...uniforms,
                uTint: {
                  color: State.tintColor,
                  saturation: State.tintSaturation,
                },
              },
            });
          },
        })
      : null,
  );
});
gui.addParam("Tint color", State, "tintColor");
gui.addParam("Tint saturation", State, "tintSaturation", { min: 0, max: 1 });
// Dropping a pass is only safe when nothing else consumes what it writes: the
// capture is a side effect, so the frame carries on and the persistent texture
// simply keeps the contents of the last frame that drew into it.
gui.addParam("Freeze capture", State, "freezeCapture", null, (frozen) => {
  if (frozen) frameGraph.disablePass(`SSR.Capture_${cameraId}`);
  else frameGraph.overridePass(`SSR.Capture_${cameraId}`, null);
});

gui.addColumn("Resolved handles");
const dummyTexture = gpu.createTexture(ctx, {
  label: "dummyTexture",
  width: 4,
  height: 4,
});
gui.addLabel("Exported (re-resolved)");
const guiReflectionControl = gui.addTexture2D("ssr.reflection", null);
gui.addLabel("Persistent (assigned once)");
const guiCaptureControl = gui.addTexture2D("ssr.capture", null);


// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  gpu.resize(ctx, window.innerWidth, window.innerHeight, pixelRatio);
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  if (State.autoRotate) {
    quat.fromAxisAngle(
      torusEntity.transform.rotation,
      [0, 1, 0],
      performance.now() * 0.0005,
    );
    torusEntity.transform.dirty = true;
  }

  renderEngine.update(world.entities);
  await renderEngine.render(world.entities, cameraEntity);

  // The register is published on the blackboard, one entry per view: that is
  // how a reader outside the graph reaches the frame's images by name.
  const textures = frameGraph.blackboard.get(`renderTextures.${cameraId}`);

  // Handles only become textures once the graph has allocated them, and a
  // pooled texture is a different one next frame — hence the re-resolve. The
  // capture is persistent, so it only has to be resolved until it is found.
  const reflectionHandle = textures?.get("ssr.reflection");
  guiReflectionControl.texture =
    (reflectionHandle && frameGraph.resolve(reflectionHandle)) || dummyTexture;

  if (!guiCaptureControl.texture || guiCaptureControl.texture === dummyTexture) {
    const captureHandle = textures?.get("ssr.capture");
    guiCaptureControl.texture =
      (captureHandle && frameGraph.resolve(captureHandle)) || dummyTexture;
  }

  if (State.timeline) drawMemoryTimeline();

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
