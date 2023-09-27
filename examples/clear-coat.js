import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import * as io from "pex-io";
import { quat } from "pex-math";
import createGUI from "pex-gui";

import parseObj from "geom-parse-obj";

import { getEnvMap, getTexture, getURL } from "./utils.js";

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

// Entities
for (let i = 0; i < 3; i++) {
  const cameraEntity = createEntity({
    layer: `camera-${i + 1}`,
    transform: components.transform({ position: [0.5, 0.5, 2] }),
    camera: components.camera({
      fov: Math.PI / 3,
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      viewport: [
        i * Math.floor((1 / 3) * window.innerWidth) * pixelRatio,
        0,
        Math.floor((1 / 3) * window.innerWidth) * pixelRatio,
        window.innerHeight * pixelRatio,
      ],
    }),
    orbiter: components.orbiter({ element: ctx.gl.canvas }),
  });
  world.add(cameraEntity);
}

const skyEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 1,
    envMap: await getEnvMap(
      ctx,
      "assets/envmaps/Road_to_MonumentValley/Road_to_MonumentValley.hdr"
    ),
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, -3, -1]),
  }),
  directionalLight: components.directionalLight({
    castShadows: true,
    color: [1, 1, 1, 1],
  }),
});
world.add(directionalLightEntity);

const materialTextures = {
  baseColorTexture: await getTexture(
    ctx,
    getURL(`assets/materials/Fabric04/Fabric04_col.jpg`)
  ),
  normalTexture: await getTexture(
    ctx,
    getURL(`assets/materials/Fabric04/Fabric04_nrm.jpg`)
  ),
  clearCoatNormalTexture: await getTexture(
    ctx,
    getURL(`assets/materials/Metal05/Metal05_nrm.jpg`)
  ),
  occlusionTexture: await getTexture(
    ctx,
    getURL(`assets/models/substance-sample-scene/substance-sample-scene_ao.jpg`)
  ),
};

const ballGeometry = components.geometry(
  parseObj(
    await io.loadText(
      getURL(`assets/models/substance-sample-scene/substance-sample-scene.obj`)
    )
  )[0]
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
  }
);
gui.addParam(
  "ClearCoat Normal Texture Scale",
  clearCoatNormalTextureEntity.material,
  "clearCoatNormalTextureScale",
  {}
);

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((e) => e.camera)
  );

  gui.draw();
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
