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

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });

const world = (window.world = createWorld());
const renderEngine = createRenderEngine({ ctx });
world.addSystem(renderEngine);

const gui = createGUI(ctx);
const W = ctx.gl.drawingBufferWidth;
const H = ctx.gl.drawingBufferHeight;
const nW = 11;
const nH = 6;
let debugOnce = false;

// Materials
const materials = [];

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.9, 0.9, 1.0, 1.0],
    metallic: i / 10,
    roughness: 0,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.0, 0.0, 1.0, 1.0],
    metallic: 0,
    roughness: i / 10,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [1.0, 0.8, 0.0, 1.0],
    metallic: 1,
    roughness: i / 10,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.8, 0.0, 0.1, 1.0],
    metallic: 0,
    roughness: 0,
    reflectance: i / 10,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.8, 0.0, 0.1, 1.0],
    metallic: 1,
    roughness: 0.5,
    clearCoat: i / 10,
    clearCoatRoughness: 0.04,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.8, 0.0, 0.1, 1.0],
    metallic: 1,
    roughness: 0.5,
    clearCoat: 1,
    clearCoatRoughness: i / 10,
  });
}

// Meshes
const geometry = sphere({ nx: 32, ny: 32 });

const mesh = {
  positions: { buffer: ctx.vertexBuffer(geometry.positions) },
  normals: { buffer: ctx.vertexBuffer(geometry.normals) },
  uvs: { buffer: ctx.vertexBuffer(geometry.uvs) },
  cells: { buffer: ctx.indexBuffer(geometry.cells) },
};

const cells = gridCells(W, H, nW, nH, 0).map((cell) => [
  cell[0],
  H - cell[1] - cell[3], // flip upside down as we are using viewport coordinates
  cell[2],
  cell[3],
]);

cells.forEach((cell, cellIndex) => {
  const layer = `cell${cellIndex}`;
  const material = materials[cellIndex];
  if (!material) return;

  const cameraEntity = createEntity({
    camera: components.camera({
      fov: Math.PI / 4,
      aspect: W / nW / (H / nH),
      viewport: cell,
    }),
    transform: components.transform({
      position: [0, 0, 2],
    }),
    orbiter: components.orbiter({
      element: ctx.gl.canvas,
    }),
    layer: layer,
  });
  world.add(cameraEntity);

  const materialEntity = createEntity({
    transform: components.transform(),
    geometry: components.geometry(mesh),
    material: components.material(material),
    layer: layer,
  });
  world.add(materialEntity);
});

// Sky
const hdrImg = parseHdr(
  await io.loadArrayBuffer(
    getURL("assets/envmaps/Ditch-River_2k/Ditch-River_2k.hdr")
    // getURL("assets/envmaps/garage/garage.hdr")
    // getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
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

const sun = components.directionalLight({
  color: [1, 1, 0.95, 2],
  intensity: 2,
  castShadows: false,
});
const sunEntity = createEntity({
  transform: components.transform({
    position: [-2, 2, 2],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([2, -2, -1])
    ),
  }),
  directionalLight: sun,
});
world.add(sunEntity);

const skyEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [0, 5, -5],
    envMap,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

// GUI
function countByProp(list, prop) {
  return list.reduce((countBy, o) => {
    if (!countBy[o[prop]]) countBy[o[prop]] = 0;
    countBy[o[prop]]++;
    return countBy;
  }, {});
}

gui.addFPSMeeter().setPosition(10, 40);
gui.addButton("Resources", () => {
  const countByClass = countByProp(ctx.resources, "class");
  const textures = ctx.resources.filter((o) => o.class == "texture");
  const countByPixelFormat = countByProp(textures, "pixelFormat");
  console.log(
    "Resources",
    countByClass,
    countByPixelFormat,
    ctx.resources,
    resourceCache
  );
});

const headers = [
  "Metallic",
  "Roughness for non-metallic",
  "Roughness for metallic",
  "Reflectance",
  "Clear Coat",
  "Clear Coat Roughness",
].map((headerTitle) => gui.addHeader(headerTitle));

const onResize = () => {
  ctx.set({
    pixelRatio,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const W = window.innerWidth * pixelRatio;
  const H = window.innerHeight * pixelRatio;

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
    .filter((e) => e.camera)
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
  ctx.debug(debugOnce);
  debugOnce = false;

  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((e) => e.camera)
  );

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
