// Exercises the shadow frustum fit: which entities are allowed to size it, and
// how near/far come out. Invisible in a screenshot — a frustum fitted to the
// wrong set still renders, just with a fraction of the depth precision it
// should have — so it is pinned here.
//
// Imported from the build output (see test/frame-graph.js).
import { mat4, vec3 } from "pex-math";
import { aabb } from "pex-geom";

const createShadowMapping = (await import("../lib/systems/render-pipeline/shadow-mapping.js")).default;

const pipeline = createShadowMapping({ frameGraph: null });

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const entity = (min, max, material) => ({
  geometry: {},
  material,
  transform: { worldBounds: aabb.fromPoints(aabb.create(), [min, max]) },
});

// A floor the light stands over, a caster on it, and a helper far away.
const floor = entity([-2.5, -0.45, -2.5], [2.5, -0.35, 2.5], { receiveShadows: true });
const caster = entity([-0.5, 0, -0.5], [0.5, 1, 0.5], { castShadows: true, receiveShadows: true });
const helper = entity([-30, -30, -30], [30, 30, 30], { type: "line" });
const scene = [floor, caster, helper];

const lightAt = (position) => {
  const light = { _viewMatrix: mat4.lookAt(mat4.create(), position, [0, 0, 0], [0, 1, 0]) };
  return light;
};
const position = [-1, 1, -1];

console.log("\nshadow fit — spot light (perspective, cone)");
{
  const light = { ...lightAt(position), angle: Math.PI / 6, range: 5, bulbRadius: 0.1 };
  pipeline.computeLightProperties({ spotLight: light }, light, scene.filter(
    (e) => e.material?.castShadows || e.material?.receiveShadows));

  check("near is not pinned to the minimum", light._near > 0.02, `near=${light._near.toFixed(3)}`);
  check("far is capped by the light's range", light._far <= 5 + 1e-6, `far=${light._far.toFixed(3)}`);
  check("near/far ratio is usable", light._far / light._near < 100,
    `ratio=${(light._far / light._near).toFixed(1)}`);
  check("the caster is inside the frustum",
    light._near <= vec3.distance(position, [0, 0.5, 0]) &&
    light._far >= vec3.distance(position, [0, 0.5, 0]));
}

console.log("\nshadow fit — geometry that neither casts nor receives");
{
  // No range, so nothing caps far and the helper's reach is unmasked — this is
  // what inflates a frustum in a scene with debug geometry in it.
  const light = { ...lightAt(position), angle: Math.PI / 6 };
  const withHelper = { ...lightAt(position), angle: Math.PI / 6 };
  pipeline.computeLightProperties({ spotLight: light }, light,
    scene.filter((e) => e.material?.castShadows || e.material?.receiveShadows));
  // The same call with the helper allowed in, as the old fit did.
  pipeline.computeLightProperties({ spotLight: withHelper }, withHelper, scene);

  check("a helper cannot stretch the frustum", light._far < withHelper._far / 2,
    `filtered far=${light._far.toFixed(2)} vs all=${withHelper._far.toFixed(2)}`);
  check("nor drag the near plane down", light._near >= withHelper._near,
    `filtered near=${light._near.toFixed(3)} vs all=${withHelper._near.toFixed(3)}`);
}

console.log("\nshadow fit — directional light (orthographic, no cone)");
{
  const light = lightAt(position);
  pipeline.computeLightProperties({ directionalLight: light }, light,
    scene.filter((e) => e.material?.castShadows || e.material?.receiveShadows));
  check("covers the whole scene it lights", light._far > 2, `far=${light._far.toFixed(3)}`);

  // A directional light has no apex: its transform position is a convention,
  // not a boundary. Clipping at it would drop casters on the far side.
  const behind = entity([-1.6, 1.6, -1.6], [-1.4, 1.8, -1.4],
    { castShadows: true });
  const spanning = lightAt(position);
  pipeline.computeLightProperties({ directionalLight: spanning }, spanning,
    [caster, behind]);
  const depthOf = (point) =>
    -vec3.multMat4([...point], spanning._viewMatrix)[2];
  check("a caster behind the light position is still inside the box",
    spanning._near <= depthOf([-1.5, 1.7, -1.5]) + 1e-6,
    `near=${spanning._near.toFixed(3)} caster depth=${depthOf([-1.5, 1.7, -1.5]).toFixed(3)}`);
}

console.log("\nshadow fit — nothing in reach");
{
  const light = { ...lightAt(position), angle: Math.PI / 6, range: 5 };
  pipeline.computeLightProperties({ spotLight: light }, light, []);
  check("frustum stays valid", light._far > light._near && light._near > 0,
    `[${light._near}, ${light._far}]`);
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
