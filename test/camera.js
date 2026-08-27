// Exercises the per-frame camera state that anything temporal depends on: the
// view-projection pair, and the one-frame reset flag.
//
// These are the parts whose bugs are invisible in a screenshot. A previous
// matrix captured one step late still looks plausible — it reprojects to nearly
// the right place while the camera moves slowly — and a reset flag cleared a
// frame early or late either does nothing or throws away history forever.
// Everything visual stays in examples/.

// Imported from the build output, like the other suites: the modules import
// each other with runtime ".js" specifiers, which Node's type stripping does
// not remap to the ".ts" sources. Run `npm run build` first.
const cameraSystem = (await import("../lib/systems/camera.js")).default;
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

// getDefaultViewport is the only thing the system asks a context for.
const ctx = { width: 800, height: 600 };

let nextId = 0;
const createCameraEntity = () => ({
  id: `cam${nextId++}`,
  transform: {},
  camera: components.camera(),
});

// ─── resetTemporal lasts exactly one frame ──────────────────────────────────
{
  const system = cameraSystem({ ctx });
  const entity = createCameraEntity();
  const frame = () => {
    system.update([entity], { frameIndex: 1 });
    return !!entity.camera._temporalReset;
  };

  console.log("resetTemporal");

  check("clear until asked", [frame(), frame()], [false, false]);

  // Set between frames, which is where a camera is repositioned.
  system.resetTemporal(entity);
  check("set on the frame after the call", frame(), true);
  check("cleared on the frame after that", frame(), false);

  // Two calls before a single update still cost one frame, not two.
  system.resetTemporal(entity);
  system.resetTemporal(entity);
  check("collapses repeated calls", [frame(), frame()], [true, false]);

  // Per camera: resetting one must not throw away another's history.
  const other = createCameraEntity();
  system.resetTemporal(entity);
  system.update([entity, other], { frameIndex: 1 });
  check(
    "applies only to the camera it named",
    [!!entity.camera._temporalReset, !!other.camera._temporalReset],
    [true, false],
  );
}

// ─── The view-projection pair advances one frame at a time ──────────────────
{
  const system = cameraSystem({ ctx });
  const entity = createCameraEntity();
  const { camera } = entity;

  // A distinct projection per frame, so a matrix captured from the wrong step
  // is visible rather than coincidentally equal.
  const frame = (n) => {
    camera.projectionMatrix[0] = n;
    system.update([entity], { frameIndex: n });
    return [camera._viewProjectionMatrix[0], camera._previousViewProjectionMatrix[0]];
  };

  console.log("\nView-projection history");

  // The first frame has nothing behind it, so previous is seeded from current
  // rather than left at the identity mat4.create() produced — otherwise every
  // motion vector that frame reads as motion out of the origin.
  check("first frame carries no motion", frame(2), [2, 2]);
  check("second frame looks back one", frame(3), [3, 2]);
  check("and keeps looking back exactly one", frame(4), [4, 3]);

  // A cut is the same situation as a first frame: the previous view describes
  // somewhere else, so it is reseeded rather than reprojected against.
  system.resetTemporal(entity);
  check("a cut carries no motion either", frame(5), [5, 5]);
  check("and looks back one again after it", frame(6), [6, 5]);
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
