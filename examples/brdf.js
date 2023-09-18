import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { vec3, quat } from "pex-math";
import * as io from "pex-io";
import { sphere } from "primitive-geometry";
import gridCells from "grid-cells";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";

const State = {
  furnace: false,
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx);
const nW = 11;

const colors = {
  black: [0.0, 0.0, 0.0, 1.0],
  white: [0.9, 0.9, 1.0, 1.0],
  blue: [0.0, 0.0, 1.0, 1.0],
  yellow: [1.0, 0.8, 0.0, 1.0],
  red: [0.8, 0.0, 0.1, 1.0],
};

// Materials
const materials = {};

for (let i = 0; i < nW; i++) {
  materials[`Metallic`] ||= [];
  materials[`Metallic`].push({
    baseColor: colors.yellow,
    metallic: i / 10,
    roughness: 0,
  });
  materials["Roughness (non-metallic)"] ||= [];
  materials["Roughness (non-metallic)"].push({
    baseColor: colors.yellow,
    metallic: 0,
    roughness: i / 10,
  });
  materials["Roughness (metallic)"] ||= [];
  materials["Roughness (metallic)"].push({
    baseColor: colors.yellow,
    metallic: 1,
    roughness: i / 10,
  });
  materials[`Reflectance`] ||= [];
  materials[`Reflectance`].push({
    baseColor: colors.blue,
    metallic: 0,
    roughness: 0,
    reflectance: i / 10,
  });
  materials["Clear Coat"] ||= [];
  materials["Clear Coat"].push({
    baseColor: colors.red,
    metallic: 1,
    roughness: 0.5,
    clearCoat: i / 10,
    clearCoatRoughness: 0.04,
  });
  materials["Clear Coat Roughness"] ||= [];
  materials["Clear Coat Roughness"].push({
    baseColor: colors.red,
    metallic: 1,
    roughness: 0.5,
    clearCoat: 1,
    clearCoatRoughness: i / 10,
  });
}
const brdfNames = Object.keys(materials);
const brdfMaterials = Object.values(materials).flat();
const nH = brdfNames.length;

// Entities
const sphereGeometry = sphere({ nx: 32, ny: 32 });

const geometry = {
  positions: { buffer: ctx.vertexBuffer(sphereGeometry.positions) },
  normals: { buffer: ctx.vertexBuffer(sphereGeometry.normals) },
  uvs: { buffer: ctx.vertexBuffer(sphereGeometry.uvs) },
  cells: { buffer: ctx.indexBuffer(sphereGeometry.cells) },
};

for (let i = 0; i < nW * nH; i++) {
  const layer = `cell${i}`;
  const cameraEntity = createEntity({
    layer,
    transform: components.transform({
      position: [0, 0, 2],
    }),
    camera: components.camera({
      fov: Math.PI / 4,
    }),
    orbiter: components.orbiter({ element: ctx.gl.canvas }),
  });
  world.add(cameraEntity);

  const material = brdfMaterials[i];
  if (!material) continue;

  const materialEntity = createEntity({
    layer,
    transform: components.transform(),
    geometry: components.geometry(geometry),
    material: components.material(material),
  });
  world.add(materialEntity);
}

const hdrImg = parseHdr(
  await io.loadArrayBuffer(
    getURL("assets/envmaps/Ditch-River_2k/Ditch-River_2k.hdr")
  )
);
const envMap = ctx.texture2D({
  data: hdrImg.data,
  width: hdrImg.shape[0],
  height: hdrImg.shape[1],
  pixelFormat: ctx.PixelFormat.RGBA32F,
  encoding: ctx.Encoding.Linear,
  flipY: true,
});
const furnaceHdr = parseHdr(
  await io.loadArrayBuffer(getURL("assets/envmaps/furnace/furnace-4k.hdr"))
);
const furnaceEnvMap = ctx.texture2D({
  data: furnaceHdr.data,
  width: furnaceHdr.shape[0],
  height: furnaceHdr.shape[1],
  pixelFormat: ctx.PixelFormat.RGBA32F,
  encoding: ctx.Encoding.Linear,
  flipY: true,
});

const skyEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [0, 5, -5],
    envMap: State.furnace ? furnaceEnvMap : envMap,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const sunEntity = createEntity({
  transform: components.transform({
    position: [-2, 2, 2],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([2, -2, -1])
    ),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 0.95, 2],
    intensity: 2,
    castShadows: false,
  }),
});
world.add(sunEntity);

// GUI
gui.addColumn("");
gui.addFPSMeeter().setPosition(10, 40);
gui.addColumn("Resources");
gui.addParam("Furnace", State, "furnace", {}, () => {
  skyEntity.skybox.envMap = State.furnace ? furnaceEnvMap : envMap;
  skyEntity.reflectionProbe.dirty = true;
});

// Events
let debugOnce = false;

const headers = brdfNames.map((headerTitle) => gui.addHeader(headerTitle));

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });

  const W = width * pixelRatio;
  const H = height * pixelRatio;

  headers.forEach((header, i) => {
    header.setPosition(10, 10 + (i * H) / nH / pixelRatio);
  });

  const cells = gridCells(W, H, nW, nH, 0).map((cell) => [
    cell[0],
    H - cell[1] - cell[3],
    cell[2],
    cell[3],
  ]);

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

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((entity) => entity.camera)
  );

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
