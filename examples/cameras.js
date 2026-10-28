import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";
import { projection, quatLookAt } from "cameras";

import * as gpu from "pex-gpu";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";

import { cube } from "primitive-geometry";

random.seed(0);

const CONTROLS = ["orbit", "map", "trackball", "firstPerson", "fly"];
const TARGET = [0, 0.5, 0];
const UP = [0, 1, 0];
const PLAYER_COLOR = [0.2, 1, 0.4, 1];
const FOLLOW_COLOR = [1, 0.5, 0, 1];
const MINIMAP_COLOR = [0, 0.6, 1, 1];
const CULLED_COLOR = [1, 1, 1, 1];
const DRAWN_COLOR = [0.7, 0, 0, 1];
const DRAWN_FLOOR_COLOR = [0.7, 0.7, 0, 1];
const LENS_KEYS = ["projection", "fov", "size", "zoom", "near", "far"];
const materialOptions = { castShadows: true, receiveShadows: true };

const State = {
  controls: "orbit",
  projection: "perspective",
  resetOnCut: true,
  videoWall: false,
  showCulling: true,
  droneSpeed: 0.3,
  bounds: false,
  fps: 60,
};

const pixelRatio = devicePixelRatio;
// Frames skipped by the fps cap keep showing the last image.
const ctx = await gpu.createContext({
  pixelRatio,
  preserveDrawingBuffer: true,
});
const renderEngine = createRenderEngine({ ctx, debug: true });
const findSystem = (type) =>
  renderEngine.systems.find((system) => system.type === type);
const cameraSystem = findSystem("camera-system");
const renderPipeline = findSystem("render-pipeline-system");
const world = createWorld();
const gui = createGUI(ctx, { theme: { columnWidth: 200 } });

// Scene
world.add(
  createEntity({
    transform: components.transform({
      rotation: quat.fromDirection(quat.create(), [-1, -1, 1]),
    }),
    directionalLight: components.directionalLight({
      intensity: 500_000,
      castShadows: true,
    }),
  }),
);
const floor = createEntity({
  transform: components.transform({ position: [0, -0.05, 0] }),
  geometry: components.geometry(cube({ sx: 20, sy: 0.1, sz: 20 })),
  material: components.material({
    ...materialOptions,
    baseColor: CULLED_COLOR,
  }),
});
world.add(floor);

const boxes = [];
for (let i = 0; i < 120; i++) {
  const height = random.float(0.2, 2);
  boxes.push(
    createEntity({
      transform: components.transform({
        position: [random.float(-9, 9), height / 2, random.float(-9, 9)],
      }),
      geometry: components.geometry(cube({ sx: 0.5, sy: height, sz: 0.5 })),
      material: components.material({
        ...materialOptions,
        baseColor: CULLED_COLOR,
      }),
    }),
  );
}
for (const box of boxes) world.add(box);

// Temporal effects: both read the previous frame, so a cut without
// `resetTemporal` smears the old shot into the new one.
const createTemporalPostProcessing = () =>
  components.postProcessing({
    toneMap: "neutral",
    fog: components.postProcessing.fog({ start: 2, density: 0.05 }),
    taa: components.postProcessing.taa(),
    motionBlur: components.postProcessing.motionBlur(),
  });

// Player
const player = createEntity({
  transform: components.transform({ position: [8, 6, 8] }),
  camera: components.camera({ near: 0.1, far: 100 }),
  controls: components.controls.orbit({ target: TARGET }),
  postProcessing: createTemporalPostProcessing(),
  cameraHelper: components.cameraHelper({ color: PLAYER_COLOR }),
});
world.add(player);

// Video wall: share the player's pose, each renders a quarter through `view`
// with its own temporal history.
const wall = [0, 1, 2, 3].map(() =>
  createEntity({
    transform: components.transform({ parent: player.transform }),
    camera: components.camera(),
    postProcessing: createTemporalPostProcessing(),
  }),
);
for (const tile of wall) world.add(tile);

// Follow cam: parented to a drone, culled to its frustum.
const drone = createEntity({
  transform: components.transform(),
  geometry: components.geometry(cube({ sx: 0.4, sy: 0.15, sz: 0.6 })),
  material: components.material({
    ...materialOptions,
    baseColor: [0.1, 0.1, 0.1, 1],
  }),
});
world.add(drone);
const followCam = createEntity({
  transform: components.transform({
    parent: drone.transform,
    position: [0, 0.3, 1],
    rotation: quat.fromAxisAngle(quat.create(), [1, 0, 0], -0.25),
  }),
  camera: components.camera({
    fov: Math.PI / 3,
    near: 0.1,
    far: 8,
    culling: true,
  }),
  postProcessing: components.postProcessing({
    toneMap: "neutral",
    smaa: components.postProcessing.smaa(),
    motionBlur: components.postProcessing.motionBlur(),
  }),
  cameraHelper: components.cameraHelper({ color: FOLLOW_COLOR }),
});
world.add(followCam);

// Minimap
const minimap = createEntity({
  transform: components.transform({ position: [0, 15, 0.5] }),
  camera: components.camera({
    projection: "orthographic",
    size: 10,
    near: 1,
    far: 20,
  }),
  controls: components.controls.map({ target: [0, 0, 0] }),
  cameraHelper: components.cameraHelper({ color: MINIMAP_COLOR }),
});
world.add(minimap);

const labels = {
  player: gui.addLabel(""),
  follow: gui.addLabel(""),
  minimap: gui.addLabel("Minimap: orthographic, map controls"),
  wall: wall.map(() => gui.addLabel("")),
};

// Viewports are in device pixels.
const layout = () => {
  const { width: W, height: H } = ctx;
  const left = Math.floor((W * 2) / 3);
  const right = W - left;
  const half = Math.floor(H / 2);

  const place = (label, [x, y]) => {
    label.x = x / pixelRatio + 10;
    label.y = y / pixelRatio + 10;
  };

  player.camera.viewport = [0, 0, left, H];
  // Bezels crop each tile instead of shifting it: the image lines up across
  // screens like a physical wall.
  const bezel = 4 * pixelRatio;
  const [w, h] = [Math.floor(left / 2), half];
  wall.forEach((tile, i) => {
    const offset = [(i % 2) * w, Math.floor(i / 2) * h];
    const size = [w - bezel, h - bezel];
    tile.camera.viewport = [...offset, ...size];
    tile.camera.view = { totalSize: [2 * w, 2 * h], size, offset };
    labels.wall[i].setTitle(
      `viewport: [${tile.camera.viewport}]\nview.offset: [${offset}]`,
    );
    place(labels.wall[i], [offset[0], offset[1] + h - 80 * pixelRatio]);
  });
  followCam.camera.viewport = [left, 0, right, half];
  minimap.camera.viewport = [left, half, right, H - half];

  place(labels.player, [0, H - 40 * pixelRatio]);
  place(labels.follow, [left, half - 40 * pixelRatio]);
  place(labels.minimap, [left, H - 40 * pixelRatio]);
  setVideoWall(State.videoWall);
};

const setVideoWall = (enabled) => {
  labels.player.setTitle(
    enabled
      ? "Video wall: 2×2 cameras, one frame (view)"
      : "Player: controls, TAA, motion blur, fog",
  );
  // pex-gui has no per item visibility: off screen when unused.
  for (const label of labels.wall) if (!enabled) label.x = -1000;
  // Only the rendering camera's own helper is hidden, and the tiles share the
  // player's pose.
  if (enabled) delete player.cameraHelper;
  else player.cameraHelper ??= components.cameraHelper({ color: PLAYER_COLOR });
  // Stale history from while the wall was off.
  if (enabled) for (const tile of wall) cameraSystem.resetTemporal(tile);
};

const onResize = () => {
  gpu.resize(ctx, window.innerWidth, window.innerHeight, pixelRatio);
  layout();
};
window.addEventListener("resize", onResize);
onResize();

// Player GUI
const setControls = (type) => {
  player.controls = components.controls[type](
    type === "firstPerson" || type === "fly" ? {} : { target: TARGET },
  );
};
const setProjection = (value) => {
  const { camera, transform } = player;
  // Keep the framing at the target across the switch.
  const distance = Math.hypot(
    ...transform.position.map((v, i) => v - TARGET[i]),
  );
  if (value === "orthographic") {
    camera.size = projection.halfHeightAtDistance(camera.fov, distance);
  }
  camera.projection = value;
};
const cut = () => {
  const { transform } = player;
  transform.position = [random.float(-8, 8), random.float(1, 6), 8];
  quatLookAt(transform.rotation, transform.position, TARGET, UP);
  transform.dirty = true;
  // Otherwise motion blur reprojects the new shot through the old pose. TAA
  // mostly rejects the stale history.
  if (State.resetOnCut) {
    for (const entity of [player, ...wall]) cameraSystem.resetTemporal(entity);
  }
};

gui.addColumn("Player");
gui.addFPSMeeter();
gui.addRadioList(
  "Controls",
  State,
  "controls",
  CONTROLS.map((value) => ({ name: value, value })),
  setControls,
);
gui.addRadioList(
  "Projection",
  State,
  "projection",
  ["perspective", "orthographic"].map((value) => ({ name: value, value })),
  setProjection,
);
gui.addParam("fov", player.camera, "fov", { min: 0.1, max: 2 });
gui.addParam("zoom", player.camera, "zoom", { min: 0.25, max: 4 });
gui.addParam("fog.density", player.postProcessing.fog, "density", {
  min: 0,
  max: 0.2,
});
gui.addButton("fitToSphere()", () => {
  player._controls.fitToSphere?.(TARGET, 3);
});
gui.addButton("reset()", () => {
  player._controls.reset();
});
gui.addButton("Cut", cut);
gui.addParam("resetTemporal() on cut", State, "resetOnCut");
gui.addParam("Frame rate (fps)", State, "fps", { min: 1, max: 60, step: 1 });
gui.addParam("view (video wall)", State, "videoWall", {}, layout);

gui.addColumn("Follow cam");
gui.addParam("Drone speed", State, "droneSpeed", { min: 0, max: 1 });
gui.addParam("Show culling", State, "showCulling");
gui.addParam("far", followCam.camera, "far", { min: 1, max: 20 });

gui.addColumn("Minimap");
gui.addParam("bounds: [0, 10, -6, 6]", State, "bounds", {}, (enabled) => {
  minimap.camera.bounds = enabled ? [0, 10, -6, 6] : undefined;
});
gui.addParam("zoom", minimap.camera, "zoom", { min: 0.5, max: 4 });

const flyDrone = (time) => {
  const { position, rotation } = drone.transform;
  const pointOnPath = (t) => [6 * Math.cos(t), 2.5, 6 * Math.sin(t)];
  position.splice(0, 3, ...pointOnPath(time));
  quatLookAt(rotation, position, pointOnPath(time + 0.1), UP);
  drone.transform.dirty = true;
};

const syncWall = () => {
  for (const tile of wall) {
    for (const key of LENS_KEYS) tile.camera[key] = player.camera[key];
    tile.postProcessing.fog.density = player.postProcessing.fog.density;
  }
};

// Tints what the follow cam draws, as seen from the other cameras.
const showCulling = () => {
  const drawn = new Set(
    renderPipeline.cullEntities([floor, ...boxes], followCam.camera),
  );
  const tint = (entity, color) => {
    entity.material.baseColor =
      State.showCulling && drawn.has(entity) ? color : CULLED_COLOR;
  };
  tint(floor, DRAWN_FLOOR_COLOR);
  for (const box of boxes) tint(box, DRAWN_COLOR);
  labels.follow.setTitle(
    `Follow cam: parented, culling (${drawn.size - drawn.has(floor)}/${boxes.length} boxes drawn)`,
  );
};

let time = 0;
let sinceLastFrame = 0;
gpu.frame(ctx, async ({ deltaTime }) => {
  sinceLastFrame += deltaTime;
  if (sinceLastFrame < 1 / State.fps - 0.001) return;
  sinceLastFrame = 0;

  time += renderEngine.deltaTime * State.droneSpeed;
  flyDrone(time);
  syncWall();

  renderEngine.update(world.entities);
  showCulling();
  // The preserved canvas is never cleared: bezels would keep stale pixels.
  gpu.submit(ctx, { pass: { clearValue: [0, 0, 0, 1] } });
  await renderEngine.render(world.entities, [
    ...(State.videoWall ? wall : [player]),
    followCam,
    minimap,
  ]);

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
