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
import parseHdr from "parse-hdr";
import parseObj from "geom-parse-obj";

import { getURL } from "./utils.js";

const {
  camera,
  directionalLight,
  skybox,
  geometry,
  material,
  orbiter,
  transform,
  reflectionProbe,
} = components;

const ctx = createContext();

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx);

for (let i = 0; i < 3; i++) {
  const cameraEntity = createEntity({
    layer: `camera-${i + 1}`,
    transform: transform({ position: [0.5, 0.5, 2] }),
    camera: camera({
      fov: Math.PI / 3,
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      viewport: [
        i * Math.floor((1 / 3) * window.innerWidth),
        0,
        Math.floor((1 / 3) * window.innerWidth),
        window.innerHeight,
      ],
    }),
    orbiter: orbiter(),
  });
  world.add(cameraEntity);
}

const skyboxEntity = createEntity({
  transform: transform(),
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 1,
  }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  reflectionProbe: reflectionProbe(),
});
world.add(reflectionProbeEntity);

function getMaterialTextures(maps) {
  return Object.entries(maps).reduce(
    (currentValue, [key, image]) => ({
      ...currentValue,
      [key]: ctx.texture2D({
        data: image,
        width: 256,
        height: 256,
        min: ctx.Filter.LinearMipmapLinear,
        mag: ctx.Filter.Linear,
        wrap: ctx.Wrap.Repeat,
        flipY: true,
        mipmap: true,
        encoding:
          key === "emissiveColorTexture" || key === "baseColorTexture"
            ? ctx.Encoding.SRGB
            : ctx.Encoding.Linear,
      }),
    }),
    {}
  );
}

const directionalLightEntity = createEntity({
  transform: transform({
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, -3, -1]),
  }),
  directionalLight: directionalLight({
    castShadows: true,
    color: [1, 1, 1, 1],
  }),
});
world.add(directionalLightEntity);

const hdrImg = parseHdr(
  await io.loadArrayBuffer(
    getURL(`assets/envmaps/Road_to_MonumentValley/Road_to_MonumentValley.hdr`)
  )
);

skyboxEntity.skybox.envMap = ctx.texture2D({
  data: hdrImg.data,
  width: hdrImg.shape[0],
  height: hdrImg.shape[1],
  pixelFormat: ctx.PixelFormat.RGBA32F,
  encoding: ctx.Encoding.Linear,
  flipY: true,
});

const materialTextures = getMaterialTextures({
  baseColorTexture: await io.loadImage(
    getURL(`assets/materials/Fabric04/Fabric04_col.jpg`)
  ),
  normalTexture: await io.loadImage(
    getURL(`assets/materials/Fabric04/Fabric04_nrm.jpg`)
  ),
  clearCoatNormalTexture: await io.loadImage(
    getURL(`assets/materials/Metal05/Metal05_nrm.jpg`)
  ),
  occlusionTexture: await io.loadImage(
    getURL(`assets/models/substance-sample-scene/substance-sample-scene_ao.jpg`)
  ),
});

const ballGeometry = geometry(
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

const geom1 = createEntity({
  layer: "camera-1",
  transform: transform(),
  geometry: ballGeometry,
  material: material(clearCoatMaterial),
});
world.add(geom1);

const geom2 = createEntity({
  layer: "camera-2",
  transform: transform(),
  geometry: ballGeometry,
  material: material({
    ...clearCoatMaterial,
    normalTexture: {
      texture: materialTextures.normalTexture,
      scale: [4, 4],
    },
  }),
});
world.add(geom2);

const geom3 = createEntity({
  layer: "camera-3",
  transform: transform(),
  geometry: ballGeometry,
  material: material({
    ...clearCoatMaterial,
    normalTexture: {
      texture: materialTextures.normalTexture,
      scale: [4, 4],
    },
    clearCoatNormalTexture: {
      texture: materialTextures.clearCoatNormalTexture,
      scale: [8, 8],
    },
  }),
});
world.add(geom3);

// GUI
gui.addParam("ClearCoat", geom1.material, "clearCoat", {}, () => {
  geom2.material.clearCoat = geom1.material.clearCoat;
  geom3.material.clearCoat = geom1.material.clearCoat;
});
gui.addParam(
  "ClearCoat Roughness",
  geom1.material,
  "clearCoatRoughness",
  {},
  () => {
    geom2.material.clearCoatRoughness = geom1.material.clearCoatRoughness;
    geom3.material.clearCoatRoughness = geom1.material.clearCoatRoughness;
  }
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
