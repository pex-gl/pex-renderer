import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { vec3, quat } from "pex-math";
import random from "pex-random";
import * as io from "pex-io";
import { sphere } from "primitive-geometry";
import gridCells from "grid-cells";
import parseHdr from "parse-hdr";
import { getTexture, getURL } from "./utils.js";

const State = {
  sunPosition: [0, 5, -5],
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: [],
  rgbm: false,
  exposure: 1,
};

random.seed(10);

const ctx = createContext({
  powerPreference: "high-performance",
  pixelRatio: devicePixelRatio,
});
ctx.gl.getExtension("EXT_shader_texture_lod");
ctx.gl.getExtension("OES_standard_derivatives");
ctx.gl.getExtension("WEBGL_draw_buffers");
ctx.gl.getExtension("OES_texture_float");
ctx.gl.getExtension("EXT_texture_filter_anisotropic");

const world = (window.world = createWorld());
const renderEngine = createRenderEngine({ ctx });
world.addSystem(renderEngine);

const gui = createGUI(ctx, {
  responsive: false,
});
const W = ctx.gl.drawingBufferWidth;
const H = ctx.gl.drawingBufferHeight;
const nW = 11;
const nH = 6;
let debugOnce = false;

// Materials
let materials = [];

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

// Utils
let cells = gridCells(W, H, nW, nH, 0).map(
  (
    cell // flip upside down as we are using viewport coordinates
  ) => [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
);

function countByProp(list, prop) {
  return list.reduce((countBy, o) => {
    if (!countBy[o[prop]]) countBy[o[prop]] = 0;
    countBy[o[prop]]++;
    return countBy;
  }, {});
}

gui.addFPSMeeter().setPosition(10, 50);
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
].map((headerTitle) => {
  const header = gui.addHeader(headerTitle);
  return header;
});

function resize() {
  ctx.set({
    pixelRatio: devicePixelRatio,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const W = window.innerWidth * devicePixelRatio;
  const H = window.innerHeight * devicePixelRatio;

  headers.forEach((header, i) => {
    header.setPosition(10, 10 + (i * H) / nH / devicePixelRatio);
  });

  let cells = gridCells(W, H, nW, nH, 0).map(
    (
      cell // flip upside down as we are using viewport coordinates
    ) => [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
  );

  world.entities
    .filter((e) => e.camera)
    .forEach((cameraEntity, i) => {
      cameraEntity.camera.viewport = cells[i];
      cameraEntity.camera.aspect = cells[i][2] / cells[i][3];
      cameraEntity.camera.dirty = true;
    });
}

window.addEventListener("resize", resize);
resize();

cells.forEach((cell, cellIndex) => {
  const layer = `cell${cellIndex}`;
  const material = materials[cellIndex];
  if (!material) return;
  const cameraCmp = components.camera({
    fov: Math.PI / 4,
    aspect: W / nW / (H / nH),
    viewport: cell,
    exposure: State.exposure,
  });
  // const postProcessingCmp = renderer.postProcessing({
  //   fxaa: true,
  // });

  if (material.emissiveColor) {
    // postProcessingCmp.set({
    //   bloom: true,
    //   bloomIntensity: 0.5,
    //   bloomThreshold: 3,
    //   bloomRadius: 1.25,
    // });
  }

  const cameraEntity = createEntity({
    camera: cameraCmp,
    transform: components.transform({
      position: [0, 0, 2],
    }),
    orbiter: components.orbiter({
      element: ctx.gl.canvas,
    }),
    layer: layer,
  });
  world.add(cameraEntity);
});

// Meshes
await Promise.allSettled(
  materials.map(async (material) => {
    if (material.baseColorMap)
      material.baseColorMap = await getTexture(
        ctx,
        material.baseColorMap,
        ctx.Encoding.SRGB
      );
    if (material.roughnessMap)
      material.roughnessMap = await getTexture(
        ctx,
        material.roughnessMap,
        ctx.Encoding.Linear
      );
    if (material.metallicMap)
      material.metallicMap = await getTexture(
        ctx,
        material.metallicMap,
        ctx.Encoding.Linear
      );
    if (material.normalMap)
      material.normalMap = await getTexture(
        ctx,
        material.normalMap,
        ctx.Encoding.Linear
      );
    if (material.alphaMap)
      material.alphaMap = await getTexture(
        ctx,
        material.alphaMap,
        ctx.Encoding.Linear
      );
    if (material.emissiveColorMap)
      material.emissiveColorMap = await getTexture(
        ctx,
        material.emissiveColorMap,
        ctx.Encoding.SRGB
      );
    material.castShadows = false;
    material.receiveShadows = false;
  })
);

let sphereGeom = sphere({ nx: 32, ny: 32 });

const sphereMesh = {
  positions: { buffer: ctx.vertexBuffer(sphereGeom.positions) },
  normals: { buffer: ctx.vertexBuffer(sphereGeom.normals) },
  uvs: { buffer: ctx.vertexBuffer(sphereGeom.uvs) },
  cells: { buffer: ctx.indexBuffer(sphereGeom.cells) },
};

cells.forEach((cell, cellIndex) => {
  const layer = `cell${cellIndex}`;
  const material = materials[cellIndex];
  if (!material) return;

  const materialEntity = createEntity({
    transform: components.transform(),
    geometry: components.geometry(sphereMesh),
    material: components.material(material),
    layer: layer,
  });
  world.add(materialEntity);
});

// Sky
(async () => {
  const buffer = await io.loadArrayBuffer(
    getURL("assets/envmaps/Ditch-River_2k/Ditch-River_2k.hdr")
  );
  //const buffer = await io.loadArrayBuffer(getURL(`assets/envmaps/garage.hdr`))
  // const buffer = await io.loadArrayBuffer(getURL(`assets/envmaps/Mono_Lake_B.hdr`))
  const hdrImg = parseHdr(buffer);
  const panorama = ctx.texture2D({
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

  const skybox = components.skybox({
    sunPosition: State.sunPosition,
    envMap: panorama,
  });

  const reflectionProbe = components.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false,
  });

  const skyEntity = createEntity({
    skybox: skybox,
    // reflectionProbe: reflectionProbe,
  });
  world.add(skyEntity);

  const reflectionProbeEntity = createEntity({
    reflectionProbe: components.reflectionProbe(),
  });
  world.add(reflectionProbeEntity);
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.toggleEnabled();
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
});
