import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import * as io from "pex-io";
import { loadHdr } from "pex-loaders";
import { quat } from "pex-math";
import createGUI from "pex-gui";

import parseObj from "geom-parse-obj";

import { getTexture, getURL } from "./utils.js";
import { getRenderPassGraphViz } from "./graph-viz.js";

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const renderPassGraphViz = getRenderPassGraphViz();
renderPassGraphViz.init(ctx, renderEngine.frameGraph);

// Entities
for (let i = 0; i < 3; i++) {
  const cameraEntity = createEntity({
    layer: `camera-${i + 1}`,
    transform: components.transform({ position: [0.5, 0.5, 2] }),
    camera: components.camera({
      fov: Math.PI / 3,
      viewport: [
        i * Math.floor((1 / 3) * window.innerWidth) * pixelRatio,
        0,
        Math.floor((1 / 3) * window.innerWidth) * pixelRatio,
        window.innerHeight * pixelRatio,
      ],
    }),
    postProcessing: components.postProcessing(),
    orbiter: components.orbiter({ element: ctx.canvas }),
  });
  world.add(cameraEntity);
}

const skyEntity = createEntity({
  skybox: components.skybox({
    backgroundBlur: 1,
    envMap: await loadHdr(
      ctx,
      getURL(
        "assets/envmaps/Road_to_MonumentValley/Road_to_MonumentValley.hdr",
      ),
    ),
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    rotation: quat.fromPointToPoint(quat.create(), [0, 0, 0], [1, -3, -1]),
  }),
  directionalLight: components.directionalLight({
    castShadows: true,
    color: [1, 1, 1, 1],
    intensity: 100_000, // lx, a clear midday sun
  }),
});
world.add(directionalLightEntity);

const materialTextures = {
  baseColorTexture: await getTexture(
    ctx,
    getURL(`assets/materials/Fabric04/Fabric04_col.jpg`),
  ),
  normalTexture: await getTexture(
    ctx,
    getURL(`assets/materials/Fabric04/Fabric04_nrm.jpg`),
  ),
  clearcoatNormalTexture: await getTexture(
    ctx,
    getURL(`assets/materials/Metal05/Metal05_nrm.jpg`),
  ),
  occlusionTexture: await getTexture(
    ctx,
    getURL(
      `assets/models/substance-sample-scene/substance-sample-scene_ao.jpg`,
    ),
  ),
};

const ballGeometry = components.geometry(
  parseObj(
    await io.loadText(
      getURL(`assets/models/substance-sample-scene/substance-sample-scene.obj`),
    ),
  )[0],
);

const clearcoatMaterial = {
  baseColor: [1, 0, 0, 1],
  roughness: 0.25,
  metallic: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  castShadows: true,
  receiveShadows: true,
  occlusionTexture: materialTextures.occlusionTexture,
  normalTextureScale: 1,
};

const clearcoatEntity = createEntity({
  layer: "camera-1",
  transform: components.transform(),
  geometry: ballGeometry,
  material: components.material(clearcoatMaterial),
});
world.add(clearcoatEntity);

const normalTextureEntity = createEntity({
  layer: "camera-2",
  transform: components.transform(),
  geometry: ballGeometry,
  material: components.material({
    ...clearcoatMaterial,
    normalTexture: {
      texture: materialTextures.normalTexture,
      scale: [4, 4],
    },
  }),
});
world.add(normalTextureEntity);

const clearcoatNormalTextureEntity = createEntity({
  layer: "camera-3",
  transform: components.transform(),
  geometry: ballGeometry,
  material: components.material({
    ...clearcoatMaterial,
    normalTexture: {
      texture: materialTextures.normalTexture,
      scale: [4, 4],
    },
    clearcoatNormalTexture: {
      texture: materialTextures.clearcoatNormalTexture,
      scale: [8, 8],
    },
    clearcoatNormalTextureScale: 1,
  }),
});
world.add(clearcoatNormalTextureEntity);

// GUI
const gui = createGUI(ctx, { theme: { columnWidth: 250 } });
gui.addButton("Toggle Render Pass Graph", () => {
  renderPassGraphViz.toggle();
});
gui.addParam(
  "Normal Texture Scale",
  clearcoatEntity.material,
  "normalTextureScale",
  {},
  () => {
    normalTextureEntity.material.normalTextureScale =
      clearcoatEntity.material.normalTextureScale;
    clearcoatNormalTextureEntity.material.normalTextureScale =
      clearcoatEntity.material.normalTextureScale;
  },
);
gui.addParam("Clearcoat", clearcoatEntity.material, "clearcoat", {}, () => {
  normalTextureEntity.material.clearcoat = clearcoatEntity.material.clearcoat;
  clearcoatNormalTextureEntity.material.clearcoat =
    clearcoatEntity.material.clearcoat;
});
gui.addParam(
  "Clearcoat Roughness",
  clearcoatEntity.material,
  "clearcoatRoughness",
  {},
  () => {
    normalTextureEntity.material.clearcoatRoughness =
      clearcoatEntity.material.clearcoatRoughness;
    clearcoatNormalTextureEntity.material.clearcoatRoughness =
      clearcoatEntity.material.clearcoatRoughness;
  },
);
gui.addParam(
  "Clearcoat Normal Texture Scale",
  clearcoatNormalTextureEntity.material,
  "clearcoatNormalTextureScale",
  {},
);

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  await renderEngine.render(
    world.entities,
    world.entities.filter((entity) => entity.camera),
  );

  gui.draw();
  window.dispatchEvent(new CustomEvent("screenshot"));
});
