// Exercises the controls system's bookkeeping: when it writes the transform,
// how it follows edits made outside of it, and what it tears down. The motion
// itself belongs to cameras and is tested there.
//
// Imported from the build output (see test/frame-graph.js).
const controlsSystem = (await import("../lib/systems/controls.js")).default;
const components = await import("../lib/components/index.js");

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
const round = (values) => values.map((v) => Math.round(v * 1e4) / 1e4 + 0);

// What the input managers touch: listeners, inline styles and pointer lock. No
// window behind the document, so window listeners are skipped.
const createElement = () =>
  Object.assign(new EventTarget(), {
    ownerDocument: Object.assign(new EventTarget(), {
      pointerLockElement: null,
    }),
    style: {
      getPropertyValue: () => "",
      setProperty() {},
      removeProperty() {},
    },
  });
// KeyboardManager listens on it for first person and fly controls.
globalThis.window = new EventTarget();

const ctx = { width: 800, height: 600, canvas: createElement() };
const dt = 1 / 60;

let nextId = 0;
const createCameraEntity = (controls, camera) => ({
  id: nextId++,
  transform: components.transform({ position: [0, 0, 5] }),
  camera: components.camera(camera),
  controls,
});

// ─── Writes the transform only when the pose changes ────────────────────────
{
  console.log("Pose to transform");
  const system = controlsSystem({ ctx });
  const entity = createCameraEntity(components.controls.orbit());

  system.update([entity], { deltaTime: dt });
  check(
    "exposes the controller",
    entity._controls?.constructor.name,
    "OrbitControls",
  );
  check(
    "keeps the transform position",
    round(entity.transform.position),
    [0, 0, 5],
  );
  check(
    "looks at the default target",
    round(entity.transform.rotation),
    [0, 0, 0, 1],
  );
  check("marks the transform dirty", entity.transform.dirty, true);

  entity.transform.dirty = false;
  system.update([entity], { deltaTime: dt });
  check("leaves the transform clean at rest", entity.transform.dirty, false);
}

// ─── Settings follow the component, creation keys do not ────────────────────
{
  console.log("\nSettings");
  const system = controlsSystem({ ctx });
  const entity = createCameraEntity(
    components.controls.orbit({ distanceBounds: [1, 10] }),
  );
  system.update([entity], { deltaTime: dt });
  const controls = entity._controls;

  entity.controls.smoothTime = 1.5;
  entity.controls.distanceBounds[1] = 20;
  system.update([entity], { deltaTime: dt });
  check("applies a changed setting", controls.smoothTime, 1.5);
  check("applies an array edited in place", controls.distanceBounds, [1, 20]);

  entity.controls.target = [5, 5, 5];
  system.update([entity], { deltaTime: dt });
  check(
    "ignores creation keys afterwards",
    round(controls.getTarget()),
    [0, 0, 0],
  );
  check("keeps the same instance", entity._controls === controls, true);
}

// ─── The camera zoom is the initial state ───────────────────────────────────
{
  console.log("\nInitial zoom");
  const system = controlsSystem({ ctx });
  const entity = createCameraEntity(components.controls.orbit(), { zoom: 2 });
  system.update([entity], { deltaTime: dt });
  check("keeps the camera zoom", entity.camera.zoom, 2);

  entity.camera.zoom = 3;
  system.update([entity], { deltaTime: dt });
  entity._controls.reset(false);
  check("reset returns to it", entity._controls.getZoom(true), 2);
}

// ─── External edits resync the controller ───────────────────────────────────
{
  console.log("\nExternal edits");
  const system = controlsSystem({ ctx });
  const entity = createCameraEntity(components.controls.orbit());
  system.update([entity], { deltaTime: dt });

  entity.transform.position = [0, 0, 10];
  system.update([entity], { deltaTime: dt });
  check(
    "a teleport moves the controller",
    round(entity._controls.getPosition([0, 0, 0], true)),
    [0, 0, 10],
  );
  check("and is not undone", round(entity.transform.position), [0, 0, 10]);

  entity.camera.zoom = 2;
  system.update([entity], { deltaTime: dt });
  check(
    "a zoom edit reaches the controller",
    entity._controls.getZoom(true),
    2,
  );
  check("and is not undone", entity.camera.zoom, 2);

  entity._controls.arc(1, 0);
  system.update([entity], { deltaTime: dt });
  entity.camera.zoom = 3;
  system.update([entity], { deltaTime: dt });
  check(
    "a zoom edit leaves the motion running",
    entity._controls.getSpherical()[2] <
      entity._controls.getSpherical([], true)[2],
    true,
  );

  const offset = createCameraEntity(components.controls.orbit());
  system.update([offset], { deltaTime: dt });
  offset._controls.setFocalOffset([1, 0, 0], false);
  system.update([offset], { deltaTime: dt });
  offset.transform.position = [0, 0, 10];
  system.update([offset], { deltaTime: dt });
  system.update([offset], { deltaTime: dt });
  check(
    "a teleport lands with a focal offset",
    round(offset.transform.position),
    [0, 0, 10],
  );
}

// ─── Steering controllers start from the camera orientation ─────────────────
{
  console.log("\nSteering");
  const system = controlsSystem({ ctx });
  const entity = createCameraEntity(components.controls.fly());
  // Looking down -X.
  entity.transform.rotation = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  system.update([entity], { deltaTime: dt });
  check(
    "keeps the transform rotation",
    round(entity.transform.rotation),
    round([0, Math.SQRT1_2, 0, Math.SQRT1_2]),
  );
  check("listens to the keyboard", !!entity._controls.keyboard, true);

  const keyless = createCameraEntity(
    components.controls.fly({ keyboard: null }),
  );
  system.update([keyless], { deltaTime: dt });
  check("unless the keyboard is disabled", keyless._controls.keyboard, null);
}

// ─── Interactive area follows the viewport ──────────────────────────────────
{
  console.log("\nInteractive area");
  const system = controlsSystem({ ctx });
  const entity = createCameraEntity(components.controls.orbit(), {
    viewport: [400, 0, 400, 600],
  });
  system.update([entity], { deltaTime: dt });
  const input = entity._controls.input;
  check("matches the viewport", input.interactiveArea, [0.5, 0, 0.5, 1]);

  entity.camera.viewport = [0, 300, 800, 300];
  system.update([entity], { deltaTime: dt });
  check("follows a viewport change", input.interactiveArea, [0, 0.5, 1, 0.5]);

  delete entity.camera.viewport;
  system.update([entity], { deltaTime: dt });
  check("covers the canvas without one", input.interactiveArea, [0, 0, 1, 1]);

  const custom = createCameraEntity(
    components.controls.orbit({
      pointer: { interactiveArea: [0, 0, 0.25, 0.25] },
    }),
    { viewport: [400, 0, 400, 600] },
  );
  system.update([custom], { deltaTime: dt });
  check(
    "leaves an explicit area alone",
    custom._controls.input.interactiveArea,
    [0, 0, 0.25, 0.25],
  );
}

// ─── Replacing or removing the component tears the controller down ──────────
{
  console.log("\nLifecycle");
  const system = controlsSystem({ ctx });
  const entity = createCameraEntity(components.controls.orbit());
  system.update([entity], { deltaTime: dt });
  const orbit = entity._controls;

  entity.controls = components.controls.trackball();
  system.update([entity], { deltaTime: dt });
  check(
    "switches controller",
    entity._controls.constructor.name,
    "TrackballControls",
  );
  check("detaches the previous one", orbit.input, null);

  delete entity.controls;
  system.update([entity], { deltaTime: dt });
  check("removes it with the component", entity._controls, undefined);

  entity.controls = components.controls.orbit();
  system.update([entity], { deltaTime: dt });
  const controls = entity._controls;
  system.dispose([entity]);
  check(
    "dispose detaches",
    [entity._controls, controls.input],
    [undefined, null],
  );
  check("and empties the cache", Object.keys(system.cache).length, 0);
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
