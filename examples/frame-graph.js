import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
  memoryTimeline,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";

import { cube, sphere, torus } from "primitive-geometry";

import { getURL } from "./utils.js";
import { getRenderPassGraphViz } from "./graph-viz.js";
import { createSSR } from "./frame-graph-ssr.js";
import { copyShader, tintedCopyShader } from "./frame-graph-ssr-shaders.js";

// Exercises the frame graph's extension points from outside the engine, with
// screen-space reflections as the payload — see frame-graph-ssr.js for the
// effect itself, which uses:
//
// - stage("outputs"), the only hook early enough to ask the main pass for an
//   attachment, since every later one hands over textures that already exist.
//   Two of the three it asks for don't exist in the engine at all: the
//   renderers' shader generators are wrapped to write them.
// - afterPass(name), positioning a pass against another pass rather than a
//   phase — no stage needed, and nothing declared on the pipeline's side. The
//   chain reads the opaque image and republishes it, so the scene passes after
//   it draw into what it produced. It also registers at the "postProcessing"
//   stage, which is what MSAA needs.
// - the pipeline's declareFullscreenPass, so an injected pass costs no more to
//   write than a built-in effect's, and addPass directly where it doesn't fit:
//   the depth pyramid writes one mip level per pass and resolves the level
//   below inside execute.
// - createTexture, pooled and mipped and persistent, and importTexture, all
//   visible in the memory timeline below.
//
// And from here:
//
// - overridePass to replace what the engine's grab pass draws, and disablePass
//   to drop a pass whose output nothing else needs
// - exportTexture on someone else's texture, so the GUI can read it after the
//   frame
// - inspect()/memoryTimeline()/poolStats() as a debug overlay

random.seed(3);

const State = {
  autoRotate: true,
  timeline: false,

  ssr: {
    enabled: true,
    intensity: 1,
    maxDistance: 10,
    thickness: 0.4,
    steps: 48,
    roughnessCutoff: 0.6,
    mirrorRoughness: 0.35,
    spatialReuse: true,
    temporal: true,
    historyWeight: 0.9,
  },

  tintedGrab: false,
  tintColor: [1, 0.4, 0.1],
  tintSaturation: 0.2,

  freezeCapture: false,
};

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const { frameGraph } = renderEngine;
const renderPipeline = renderEngine.systems.find(
  (system) => system.type === "render-pipeline-system",
);

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
// Only for wiring the GUI to names the effect builds per camera.
const cameraId = cameraEntity.id;

const floorEntity = createEntity({
  transform: components.transform({ position: [0, -0.05, 0] }),
  geometry: components.geometry(cube({ sx: 14, sy: 0.1, sz: 14 })),
  material: components.material({
    baseColor: [0.08, 0.08, 0.09, 1],
    metallic: 0,
    roughness: 0.1,
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
    metallic: 1,
    roughness: 0.25,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(torusEntity);

// A spread of roughness, which is the whole point of tracing a lobe rather than
// a mirror ray: every one of these reflects the floor and its neighbours at its
// own blur, from the same rays.
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
        metallic: i % 2,
        roughness: 0.05 + i * 0.12,
        receiveShadows: true,
        castShadows: true,
      }),
    }),
  );
}

// The grab pass only exists when something is transmissive, and the override
// demo replaces it. Reflections are composited before this draws, so what it
// refracts includes them.
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

// ─── The injected effect ─────────────────────────────────────────────────────
const ssr = createSSR({
  ctx,
  renderEngine,
  cameraEntity,
  settings: State.ssr,
});

const CAPTURE_SIZE = 256;

// Two ways of getting hold of a texture the effect produced, neither of which
// the effect had to offer: it published under a name, and a name in the
// register is readable by anything holding the register.
frameGraph.on("postProcessing", (textures) => {
  const reflections = textures.get("ssr.temporal");
  if (!reflections) return;

  // Read by the GUI after the frame, which no pass can express: the export is
  // what stores the last write and keeps the texture out of the pool until the
  // frame ends. The identity still churns frame to frame, so the GUI has to
  // re-resolve the handle every frame (see the draw loop).
  frameGraph.exportTexture(reflections);

  // A fixed-size copy for the GUI thumbnail. Persistent: the same texture every
  // frame, so pex-gui can hold onto it — a pooled one would change identity,
  // and pex-gpu keys its bind group cache by texture. Costs one texture that is
  // never reclaimed, which is why the effect's own full-resolution targets are
  // not persistent. The size is deliberately viewport-independent: a persistent
  // resource whose shape changes is reallocated, and identity is the point.
  const { renderView } = textures;
  renderPipeline.declareFullscreenPass(
    { renderView, textures, prefix: "ssr" },
    {
      name: "capture",
      shader: copyShader,
      source: reflections,
      size: [CAPTURE_SIZE, CAPTURE_SIZE],
      target: frameGraph.createTexture({
        label: `ssrCapture_${renderView.cameraEntity.id}`,
        width: CAPTURE_SIZE,
        height: CAPTURE_SIZE,
        format: "rgba16float",
        persistent: true,
      }),
    },
  );
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
const redrawGraph = () =>
  renderPassGraphViz.isRendered() && renderPassGraphViz.draw();

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
    // outputs and everything the injected effect published all answer to a name
    // in the same register, so debugRender is a single lookup.
    { name: "Final image", value: "" },
    { name: "G-buffer normals", value: "normal" },
    { name: "G-buffer material", value: "material" },
    { name: "Probe specular", value: "indirectSpecular" },
    { name: "SSR hits", value: "ssr.trace" },
    { name: "SSR resolved", value: "ssr.resolve" },
    { name: "SSR accumulated", value: "ssr.temporal" },
    { name: "SSR composited", value: "ssr.composite" },
    { name: "Reflected radiance", value: "ssr.colorPyramid" },
    { name: "Transmission grab", value: "transmission.grab" },
    { name: "Tonemapped (combine)", value: "combine.main" },
  ],
  // Pointing the presented image at an intermediate leaves everything that only
  // fed the original output unreferenced, so the graph culls it: the pass count
  // drops as soon as this is anything but the final image.
  redrawGraph,
);

gui.addColumn("Injected SSR");
const onSetting = () => {
  // What has been accumulated was accumulated under the old settings.
  ssr.invalidate();
  redrawGraph();
};
gui.addParam("Enabled", State.ssr, "enabled", null, onSetting);
gui.addParam("Intensity", State.ssr, "intensity", { min: 0, max: 3 });
gui.addParam("Max distance", State.ssr, "maxDistance", { min: 1, max: 30 }, onSetting);
gui.addParam("Thickness", State.ssr, "thickness", { min: 0.05, max: 2 }, onSetting);
gui.addParam("Steps", State.ssr, "steps", { min: 8, max: 96, step: 1 }, onSetting);
gui.addParam(
  "Roughness cutoff",
  State.ssr,
  "roughnessCutoff",
  { min: 0, max: 1 },
  onSetting,
);
gui.addParam(
  "Mirror below",
  State.ssr,
  "mirrorRoughness",
  { min: 0, max: 1 },
  onSetting,
);
gui.addParam("Reuse neighbours", State.ssr, "spatialReuse", null, onSetting);
gui.addParam("Accumulate", State.ssr, "temporal", null, onSetting);
gui.addParam("History weight", State.ssr, "historyWeight", { min: 0, max: 0.98 });

gui.addColumn("Overrides");
// Replaces what the pipeline's grab pass draws while keeping its declaration:
// same attachments, same uniforms. The refraction of the glass sphere is what
// samples the result.
gui.addParam("Tint grab pass", State, "tintedGrab", null, (enabled) => {
  frameGraph.overridePass(
    `grab.${cameraId}`,
    enabled
      ? (declaration) => ({
          ...declaration,
          execute: ({ uniforms }) => {
            renderPipeline.drawFullscreen({
              label: "tintedGrabPassCopy",
              pipeline: renderPipeline.getPostProcessingPipeline(
                "tintedGrab",
                tintedCopyShader,
                new Set(),
                {},
              ),
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
// Dropping a pass is only safe when nothing else consumes what it writes, which
// in a chain of passes feeding each other means only the ends: the capture is a
// side effect, so the frame carries on and the persistent texture keeps the
// contents of the last frame that drew into it.
//
// The texture is still declared, and stays untouched because of it: a resource
// no surviving pass reads or writes is never acquired at all, so the pool hands
// nothing out and the one it is holding keeps what is in it.
gui.addParam("Freeze capture", State, "freezeCapture", null, (frozen) => {
  if (frozen) frameGraph.disablePass(`ssr.capture.${cameraId}`);
  else frameGraph.overridePass(`ssr.capture.${cameraId}`, null);
  redrawGraph();
});

gui.addColumn("Resolved handles");
const dummyTexture = gpu.createTexture(ctx, {
  label: "dummyTexture",
  width: 4,
  height: 4,
});
gui.addLabel("Exported (re-resolved)");
const guiReflectionControl = gui.addTexture2D("ssr.temporal", null);
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
  // The history is half the viewport, so it is reallocated and holds nothing.
  ssr.invalidate();
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
  const reflectionHandle = textures?.get("ssr.temporal");
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
