// Checks the extracted planes against the clip volume they claim to describe.
// Culling is conservative, so an over-permissive plane is invisible in a
// screenshot: it renders the same, it just fails to reject. The near plane is
// the one that depends on the depth convention (WebGPU clips 0 <= z, not
// -w <= z) and the one that was wrong.
import { mat4, vec3 } from "pex-math";

import { computeFrustumPlanes } from "../lib/utils.js";

const NAMES = ["-x", "+x", "+y", "-y", "far", "near"];

// NDC corners of the WebGPU clip volume: z in [0, 1].
const CORNERS = [];
for (const x of [-1, 1]) {
  for (const y of [-1, 1]) {
    for (const z of [0, 1]) CORNERS.push([x, y, z]);
  }
}

let failed = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok " : "FAIL"} ${label}${detail ? `  ${detail}` : ""}`);
};

const distance = (frustum, i, point) =>
  frustum[i * 4] * point[0] +
  frustum[i * 4 + 1] * point[1] +
  frustum[i * 4 + 2] * point[2] +
  frustum[i * 4 + 3];

function run(label, projectionMatrix, near, far) {
  console.log(`frustum planes — ${label}`);

  const frustum = computeFrustumPlanes(
    new Float32Array(24),
    projectionMatrix,
    mat4.create(),
  );

  const lengths = NAMES.map((_, i) =>
    vec3.length([frustum[i * 4], frustum[i * 4 + 1], frustum[i * 4 + 2]]),
  );
  check(
    "plane normals are unit length",
    lengths.every((length) => Math.abs(length - 1) < 1e-5),
    `max deviation ${Math.max(...lengths.map((l) => Math.abs(l - 1))).toExponential(1)}`,
  );

  const inverse = mat4.invert(mat4.copy(projectionMatrix));
  const worst = { distance: Infinity, plane: -1 };
  for (const ndc of CORNERS) {
    const point = vec3.multMat4([...ndc], inverse);
    for (let i = 0; i < 6; i++) {
      const d = distance(frustum, i, point);
      if (d < worst.distance) {
        worst.distance = d;
        worst.plane = i;
      }
    }
  }
  check(
    "every clip volume corner is inside every plane",
    worst.distance > -1e-4,
    `worst ${worst.distance.toFixed(6)} on ${NAMES[worst.plane]}`,
  );

  // The GL form of the near plane lands at near * far / (2 * far - near),
  // roughly half the near distance, which quietly stops culling anything.
  check(
    "the near plane sits at the true near distance",
    distance(frustum, 5, [0, 0, -(near + 1e-3)]) > 0 &&
      distance(frustum, 5, [0, 0, -(near - 1e-3)]) < 0,
    `near=${near}`,
  );

  // Normalized planes give metric distances, which anything doing a sphere or
  // distance test depends on. Multiplying by the normal length instead of
  // dividing keeps the sign, so only the magnitude gives it away.
  const behindNear = distance(frustum, 5, [0, 0, -(near + 2)]);
  check(
    "plane distances are metric",
    Math.abs(behindNear - 2) < 1e-4 &&
      Math.abs(distance(frustum, 4, [0, 0, -(far - 3)]) - 3) < 1e-3,
    `2 units past near reads ${behindNear.toFixed(4)}`,
  );
}

run(
  "perspectiveZO (camera, spot/area/point shadow)",
  mat4.perspectiveZO(mat4.create(), Math.PI / 3, 1, 0.5, 100),
  0.5,
  100,
);
run(
  "orthoZO (directional shadow)",
  mat4.orthoZO(mat4.create(), -4, 4, -3, 3, 0.5, 100),
  0.5,
  100,
);
run(
  "frustumZO (offset view)",
  mat4.frustumZO(mat4.create(), -0.4, 0.6, -0.5, 0.5, 0.5, 100),
  0.5,
  100,
);

console.log(failed ? `\n${failed} failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
