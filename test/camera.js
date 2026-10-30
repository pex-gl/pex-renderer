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
const createCameraEntity = (options) => ({
  id: `cam${nextId++}`,
  transform: {},
  // What the transform system would add: an identity world matrix.
  _transform: {
    modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  },
  camera: components.camera(options),
});

const round = (value) => Math.round(value * 1e6) / 1e6;

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
    camera.zoom = n;
    system.update([entity], { frameIndex: n });
    return [
      camera._viewProjectionMatrix[0],
      camera._previousViewProjectionMatrix[0],
    ];
  };

  console.log("\nView-projection history");

  // The first frame has nothing behind it, so previous is seeded from current
  // rather than left at the identity mat4.create() produced — otherwise every
  // motion vector that frame reads as motion out of the origin.
  const [first, firstPrevious] = frame(2);
  check("first frame carries no motion", firstPrevious, first);
  const [second, secondPrevious] = frame(3);
  check("second frame looks back one", secondPrevious, first);
  const [, thirdPrevious] = frame(4);
  check("and keeps looking back exactly one", thirdPrevious, second);

  // A cut is the same situation as a first frame: the previous view describes
  // somewhere else, so it is reseeded rather than reprojected against.
  system.resetTemporal(entity);
  const [cut, cutPrevious] = frame(5);
  check("a cut carries no motion either", cutPrevious, cut);
  const [, afterCutPrevious] = frame(6);
  check("and looks back one again after it", afterCutPrevious, cut);
}

// ─── Lens and projection ────────────────────────────────────────────────────
{
  const system = cameraSystem({ ctx });
  console.log("\nLens and projection");

  const viewport = createCameraEntity({ viewport: [0, 0, 400, 100] });
  system.update([viewport]);
  check("aspect from the viewport", viewport.camera.aspect, 4);

  const view = createCameraEntity({
    viewport: [0, 0, 100, 100],
    view: { totalSize: [300, 100], size: [100, 100], offset: [0, 0] },
  });
  system.update([view]);
  check("aspect from the full view, not the tile", view.camera.aspect, 3);

  const lens = createCameraEntity({ focalLength: 50 });
  system.update([lens]);
  check(
    "focal length drives the fov over the fitted sensor",
    round(lens.camera.fov),
    round(2 * Math.atan(24 / 100)),
  );
  check("fitted sensor height", lens.camera._sensorHeight, 24);
  lens.camera.zoom = 2;
  system.update([lens]);
  check(
    "zoom lengthens the depth of field focal length",
    round(lens.camera._focalLength),
    100,
  );

  const orthographic = createCameraEntity({
    projection: "orthographic",
    size: 2,
    zoom: 2,
  });
  system.update([orthographic]);
  check(
    "orthographic size, aspect and zoom in",
    round(orthographic.camera.projectionMatrix[5]),
    1,
  );

  const bounds = createCameraEntity({
    projection: "orthographic",
    bounds: [0, 800, 600, 0],
  });
  system.update([bounds]);
  const m = bounds.camera.projectionMatrix;
  check(
    "explicit bounds map the top-left corner to NDC (-1, 1)",
    [round(m[12]), round(m[13])],
    [-1, 1],
  );
}

// ─── Reversed-Z: near at 1, far at 0 ────────────────────────────────────────
// Every depth test, clear and background check in the pipeline assumes it, and
// a projection that silently fell back would invert all of them at once.
{
  const system = cameraSystem({ ctx });
  console.log("\nreversed-Z");

  const ndcDepth = (m, distance) =>
    round((m[10] * -distance + m[14]) / (m[11] * -distance + m[15]));

  for (const projection of ["perspective", "orthographic"]) {
    const entity = createCameraEntity({ projection, near: 0.5, far: 100 });
    system.update([entity]);
    const m = entity.camera.projectionMatrix;
    check(
      `${projection}: near maps to 1, far to 0`,
      [ndcDepth(m, 0.5), ndcDepth(m, 100)],
      [1, 0],
    );
  }

  const infinite = createCameraEntity({ near: 0.5, far: Infinity });
  system.update([infinite]);
  check(
    "infinite far: depth is near / distance",
    ndcDepth(infinite.camera.projectionMatrix, 50),
    0.01,
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
