import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import * as io from "pex-io";
import { quat } from "pex-math";
import createGUI from "pex-gui";

import parseObj from "geom-parse-obj";

import { getEnvMap, getGpuTexture, getURL } from "./utils.js";
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
    envMap: await loaders.hdr(
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
  baseColorTexture: await getGpuTexture(
    ctx,
    getURL(`assets/materials/Fabric04/Fabric04_col.jpg`),
  ),
  normalTexture: await getGpuTexture(
    ctx,
    getURL(`assets/materials/Fabric04/Fabric04_nrm.jpg`),
  ),
  clearCoatNormalTexture: await getGpuTexture(
    ctx,
    getURL(`assets/materials/Metal05/Metal05_nrm.jpg`),
  ),
  occlusionTexture: await getGpuTexture(
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

const clearCoatMaterial = {
  baseColor: [1, 0, 0, 1],
  roughness: 0.25,
  metallic: 0,
  clearCoat: 1,
  clearCoatRoughness: 0.1,
  castShadows: true,
  receiveShadows: true,
  occlusionTexture: materialTextures.occlusionTexture,
  normalTextureScale: 1,
};

const clearCoatEntity = createEntity({
  layer: "camera-1",
  transform: components.transform(),
  geometry: ballGeometry,
  material: components.material(clearCoatMaterial),
});
world.add(clearCoatEntity);

const normalTextureEntity = createEntity({
  layer: "camera-2",
  transform: components.transform(),
  geometry: ballGeometry,
  material: components.material({
    ...clearCoatMaterial,
    normalTexture: {
      texture: materialTextures.normalTexture,
      scale: [4, 4],
    },
  }),
});
world.add(normalTextureEntity);

const clearCoatNormalTextureEntity = createEntity({
  layer: "camera-3",
  transform: components.transform(),
  geometry: ballGeometry,
  material: components.material({
    ...clearCoatMaterial,
    normalTexture: {
      texture: materialTextures.normalTexture,
      scale: [4, 4],
    },
    clearCoatNormalTexture: {
      texture: materialTextures.clearCoatNormalTexture,
      scale: [8, 8],
    },
    clearCoatNormalTextureScale: 1,
  }),
});
world.add(clearCoatNormalTextureEntity);

// GUI
const gui = createGUI(ctx, { theme: { columnWidth: 250 } });
gui.addButton("Toggle Render Pass Graph", () => {
  renderPassGraphViz.toggle();
});
gui.addParam(
  "Normal Texture Scale",
  clearCoatEntity.material,
  "normalTextureScale",
  {},
  () => {
    normalTextureEntity.material.normalTextureScale =
      clearCoatEntity.material.normalTextureScale;
    clearCoatNormalTextureEntity.material.normalTextureScale =
      clearCoatEntity.material.normalTextureScale;
  },
);
gui.addParam("ClearCoat", clearCoatEntity.material, "clearCoat", {}, () => {
  normalTextureEntity.material.clearCoat = clearCoatEntity.material.clearCoat;
  clearCoatNormalTextureEntity.material.clearCoat =
    clearCoatEntity.material.clearCoat;
});
gui.addParam(
  "ClearCoat Roughness",
  clearCoatEntity.material,
  "clearCoatRoughness",
  {},
  () => {
    normalTextureEntity.material.clearCoatRoughness =
      clearCoatEntity.material.clearCoatRoughness;
    clearCoatNormalTextureEntity.material.clearCoatRoughness =
      clearCoatEntity.material.clearCoatRoughness;
  },
);
gui.addParam(
  "ClearCoat Normal Texture Scale",
  clearCoatNormalTextureEntity.material,
  "clearCoatNormalTextureScale",
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
