import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import createGUI from "pex-gui";
import { vec3, quat } from "pex-math";
import { sphere } from "primitive-geometry";
import gridCells from "grid-cells";
import { getURL } from "./utils.js";

const State = {
  furnace: false,
  baseColor: "colored",
};

const SUN_INTENSITY = 2;

const COLORS = {
  black: [0, 0, 0, 1],
  grey: [0.5, 0.5, 0.5, 1],
  white: [1, 1, 1, 1],
  blue: [0, 0, 1, 1],
  yellow: [1, 0.8, 0, 1],
  red: [0.8, 0, 0, 1],
};

const BASE_COLORS = {
  colored: null,
  black: COLORS.black,
  grey: COLORS.grey,
  white: COLORS.white,
};

// Colors of a lobe layered over the base, so deliberately outside the base
// color override — overriding both would cancel those rows out.
const SHEEN_COLOR = COLORS.white;
// Beer's law raises this to a power, so a channel at 0 would collapse to black
// in one step and a channel at 1 never attenuates: one of each plus a middle
// one makes the row darken *and* shift hue, which is what absorption looks like.
const ATTENUATION_COLOR = [0.5, 0.8, 1];

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const nW = 6;

// Materials
const materials = {};

for (let i = 0; i < nW; i++) {
  materials[`Metallic`] ||= [];
  materials[`Metallic`].push({
    baseColor: COLORS.yellow,
    metallic: i / 10,
    roughness: 0,
  });
  materials["Roughness (non-metallic)"] ||= [];
  materials["Roughness (non-metallic)"].push({
    baseColor: COLORS.yellow,
    metallic: 0,
    roughness: i / 10,
  });
  materials["Roughness (metallic)"] ||= [];
  materials["Roughness (metallic)"].push({
    baseColor: COLORS.yellow,
    metallic: 1,
    roughness: i / 10,
  });
  materials["IOR"] ||= [];
  materials["IOR"].push({
    baseColor: COLORS.blue,
    metallic: 0,
    roughness: 0,
    // Sets dielectric F0 = ((ior - 1) / (ior + 1))^2: 0 (pure diffuse) to 0.111
    ior: 1 + i / 10,
  });
  materials[`Specular`] ||= [];
  materials[`Specular`].push({
    baseColor: COLORS.blue,
    metallic: 0,
    roughness: 0,
    ior: 1.5,
    specular: i / 10,
  });
  materials["Clear Coat"] ||= [];
  materials["Clear Coat"].push({
    baseColor: COLORS.red,
    metallic: 1,
    roughness: 0.5,
    clearCoat: i / 10,
    clearCoatRoughness: 0.04,
  });
  materials["Clear Coat Roughness"] ||= [];
  materials["Clear Coat Roughness"].push({
    baseColor: COLORS.red,
    metallic: 1,
    roughness: 0.5,
    clearCoat: 1,
    clearCoatRoughness: i / 10,
  });
  // Charlie sheen + albedo scaling is an approximation with no energy guarantee
  materials["Sheen Roughness"] ||= [];
  materials["Sheen Roughness"].push({
    baseColor: COLORS.black,
    metallic: 0,
    roughness: 1,
    sheenColor: SHEEN_COLOR,
    sheenRoughness: i / 10,
  });
  materials["Transmission"] ||= [];
  materials["Transmission"].push({
    baseColor: COLORS.white,
    metallic: 0,
    roughness: 0,
    ior: 1.5,
    transmission: i / 10,
  });
  materials["Diffuse Transmission"] ||= [];
  materials["Diffuse Transmission"].push({
    baseColor: COLORS.white,
    metallic: 0,
    roughness: 1,
    diffuseTransmission: i / 10,
  });
  // The one row that must *not* disappear in the furnace: absorption is real
  // energy loss, so it has to darken toward the attenuation color as the
  // distance shortens. A vanishing row here means attenuation isn't applied.
  materials["Volume Attenuation"] ||= [];
  materials["Volume Attenuation"].push({
    baseColor: COLORS.white,
    metallic: 0,
    roughness: 0,
    ior: 1.5,
    transmission: 1,
    thickness: 1,
    attenuationColor: ATTENUATION_COLOR,
    // Beer's law is pow(color, rayLength / distance), so an even ramp needs
    // 1/distance linear: this halves red every cell (Infinity, then .71 to .03).
    attenuationDistance: i === 0 ? Infinity : 2 / i,
  });
}
const brdfNames = Object.keys(materials);
const brdfMaterials = Object.values(materials).flat();
const nH = brdfNames.length;

// Entities
const sphereGeometry = sphere({ nx: 32, ny: 32 });
const materialEntities = [];

for (let i = 0; i < nW * nH; i++) {
  const layer = `cell${i}`;
  const cameraEntity = createEntity({
    layer,
    transform: components.transform({
      position: [0, 0, 2],
    }),
    camera: components.camera(),
    // postProcessing: components.postProcessing({ toneMap: "neutral" }),
    orbiter: components.orbiter({ element: ctx.canvas }),
  });
  world.add(cameraEntity);

  const material = brdfMaterials[i];
  if (!material) continue;

  const materialEntity = createEntity({
    layer,
    transform: components.transform(),
    geometry: components.geometry(sphereGeometry),
    material: components.material(material),
  });
  world.add(materialEntity);
  materialEntities[i] = materialEntity;
}

const setBaseColors = () => {
  const override = BASE_COLORS[State.baseColor];
  materialEntities.forEach((entity, i) => {
    entity.material.baseColor = override ?? brdfMaterials[i].baseColor;
  });
};
setBaseColors();

const envMap = await loaders.hdr(
  ctx,
  getURL("assets/envmaps/Ditch-River_2k/Ditch-River_2k.hdr"),
);
const furnaceEnvMap = await loaders.hdr(
  ctx,
  getURL("assets/envmaps/furnace/furnace.hdr"),
);

const skyEntity = createEntity({
  skybox: components.skybox({
    envMap: State.furnace ? furnaceEnvMap : envMap,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const sunEntity = createEntity({
  transform: components.transform({
    position: [-2, 2, 2],
    rotation: quat.fromDirection(quat.create(), vec3.normalize([2, -2, -1])),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 0.95, 2],
    intensity: State.furnace ? 0 : SUN_INTENSITY,
    castShadows: false,
  }),
});
world.add(sunEntity);

// GUI
const gui = createGUI(ctx);
gui.addColumn("");
gui.addFPSMeeter().setPosition(10, 40);
gui.addColumn("Resources");
gui.addParam("Furnace", State, "furnace", {}, () => {
  skyEntity.skybox.envMap = State.furnace ? furnaceEnvMap : envMap;
  skyEntity.reflectionProbe.dirty = true;
  sunEntity.directionalLight.intensity = State.furnace ? 0 : SUN_INTENSITY;
  if (State.furnace) State.baseColor = "white";
  setBaseColors();
});

gui.addRadioList(
  "Base color",
  State,
  "baseColor",
  Object.keys(BASE_COLORS).map((value) => ({ name: value, value })),
  setBaseColors,
);

// Events
let debugOnce = false;

const headers = brdfNames.map((headerTitle) => gui.addHeader(headerTitle));

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  gpu.resize(ctx, width, height, pixelRatio);

  const W = width * pixelRatio;
  const H = height * pixelRatio;

  headers.forEach((header, i) => {
    header.setPosition(10, 10 + (i * H) / nH / pixelRatio);
  });

  const cells = gridCells(W, H, nW, nH, 0);

  world.entities
    .filter((entity) => entity.camera)
    .forEach((cameraEntity, i) => {
      cameraEntity.camera.viewport = cells[i];
      cameraEntity.camera.aspect = cells[i][2] / cells[i][3];
      cameraEntity.camera.dirty = true;
    });
};

window.addEventListener("resize", onResize);
onResize();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  await renderEngine.render(
    world.entities,
    world.entities.filter((entity) => entity.camera),
  );

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
