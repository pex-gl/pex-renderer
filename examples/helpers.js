import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "../index.js";
import createContext from "pex-context";
import { quat, vec3 } from "pex-math";
import createGUI from "pex-gui";
import { aabb } from "pex-geom";

import { cube } from "primitive-geometry";
import normals from "angle-normals";
// import centerAndNormalize from "geom-center-and-normalize";

import { centerAndNormalize, getURL } from "./utils.js";

import * as d from "./assets/models/stanford-dragon/stanford-dragon.js";

const dragon = { ...d };

// Utils
async function loadScene(url, transformProps) {
  let scene;
  scene = (
    await loaders.gltf(url, {
      ctx: ctx,
      includeCameras: false,
      dracoOptions: {
        transcoderPath: new URL(
          "assets/decoders/draco/",
          import.meta.url
        ).toString(),
      },
      basisOptions: {
        transcoderPath: new URL(
          "assets/decoders/basis/",
          import.meta.url
        ).toString(),
      },
    })
  )[0];

  scene.entities.forEach((entity) => {
    entity.boundingBoxHelper = components.boundingBoxHelper({
      color: [0.85, 0.5, 0.85, 1],
    });
  });
  Object.assign(scene.root.transform, transformProps);

  scene.entities.forEach((entity) => {
    world.add(entity);
  });
}

const ctx = createContext({ pixelRatio: devicePixelRatio });

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx);

const helperEntity = createEntity({
  axisHelper: { scale: 3 },
  gridHelper: { size: 30, step: 0.5 },
});
world.add(helperEntity);

const W = window.innerWidth * devicePixelRatio;
const H = window.innerHeight * devicePixelRatio;
const splitRatio = 0.66;
const aspect = ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight;

const cameraEntity = createEntity({
  transform: components.transform({ position: [2, 2, 2] }),
  camera: components.camera({
    fov: Math.PI / 3,
    aspect,
    near: 0.1,
    far: 100,
    exposure: 0.6,
    viewport: [0, 0, Math.floor(splitRatio * W), H],
  }),
  orbiter: components.orbiter(),
});
world.add(cameraEntity);

const persCameraEntity = createEntity({
  transform: components.transform({
    position: [0, 5, 0],
    rotation: quat.fromEuler(quat.create(), [-Math.PI / 2, 0, 0]),
  }),
  camera: components.camera({
    fov: Math.PI / 6,
    aspect,
    near: 1,
    far: 12,
    viewport: [splitRatio * W, 0.5 * H, (1 - splitRatio) * W, 0.5 * H],
  }),
  orbiter: components.orbiter(),
  cameraHelper: true,
});
world.add(persCameraEntity);

const orthoCameraEntity = createEntity({
  transform: components.transform({
    position: [0, 2, 3],
    rotation: quat.fromEuler(quat.create(), [-Math.PI / 5, 0, 0]),
  }),
  camera: components.camera({
    fov: Math.PI / 3,
    projection: "orthographic",
    aspect,
    near: 0.1,
    far: 10,
    zoom: 3,
    viewport: [splitRatio * W, 0, (1 - splitRatio) * W, 0.5 * H],
  }),
  // cameraHelper: true,
});
world.add(orthoCameraEntity);

// skybox and  reflection probe
const skybox = createEntity({
  transform: components.transform(),
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: false,
  }),
});
world.add(skybox);

const reflectionProbe = createEntity({
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbe);

// Lights
// const directionalLightEntity = createEntity({
//   transform: components.transform({
//     rotation: quat.fromTo(
//       quat.create(),
//       [0, 0, 1],
//       vec3.normalize([1, -3, -1])
//     ),
//     position: [-1, 2, -1],
//   }),
//   directionalLight: components.directionalLight({
//     castShadows: true,
//     color: [1, 1, 1, 1],
//     intensity: 5,
//   }),
//   lightHelper: true,
// });
// world.add(directionalLightEntity);

//floor
const floorEntity = createEntity({
  transform: components.transform({
    position: [0, -0.4, 0],
  }),
  geometry: {
    ...components.geometry(cube({ sx: 7, sy: 0.1, sz: 5 })),
    // bounds: [
    //   [-3.5, -0.5, -2.5],
    //   [3.5, 0.5, 2.5],
    // ],
  },
  material: components.material({
    baseColor: [1, 1, 1, 1],
    roughness: 2 / 5,
    metallic: 0,
    receiveShadows: true,
    castShadows: false,
  }),
  boundingBoxHelper: components.boundingBoxHelper({ color: [1, 1, 0, 1] }),
});
world.add(floorEntity);

//static mesh
dragon.positions = centerAndNormalize(dragon.positions);
dragon.normals = normals(dragon.cells, dragon.positions);
dragon.uvs = dragon.positions.map(() => [0, 0]);
const dragonEntity = createEntity({
  name: "dragon",
  geometry: components.geometry(dragon),
  material: components.material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    receiveShadows: true,
    castShadows: true,
  }),
  transform: components.transform({
    position: [-1.5, 0, 0],
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(dragonEntity);

//animated skinned mesh
await loadScene(getURL(`assets/models/CesiumMan/CesiumMan.glb`), {
  scale: [0.8, 0.8, 0.8],
  position: [0.5, -0.35, 0],
});

//buster drone
await loadScene(
  getURL(`assets/models/buster-drone/buster-drone-etc1s-draco.glb`),
  {
    scale: [0.006, 0.006, 0.006],
    position: [-0.3, 0.25, 0],
  }
);

//instanced mesh
const gridSize = 3;
let grid = [];
for (let i = 0; i < gridSize; i++) {
  for (let j = 0; j < gridSize; j++) {
    for (let k = 0; k < gridSize; k++) {
      grid.push([i / 4, j / 4, k / 4]);
    }
  }
}

function aabbFromInstances(geom, offsets) {
  const bounds = aabb.fromPoints(aabb.create(), offsets);
  const geomBounds = aabb.fromPoints(aabb.create(), geom.positions);
  // const center = aabb.center(bounds)
  // const geomSize = aabb.size(geomBounds)
  vec3.add(bounds[0], geomBounds[0]);
  vec3.add(bounds[1], geomBounds[1]);
  return bounds;
}

let cubeG = cube({ sx: 0.1 });
let cubeInstancesEntity = createEntity({
  geometry: components.geometry({
    positions: cubeG.positions,
    normals: cubeG.normals,
    uvs: cubeG.uvs,
    cells: cubeG.cells,
    offsets: grid,
    instances: grid.length,
    bounds: aabbFromInstances(cubeG, grid),
  }),
  material: components.material({
    baseColor: [0.5, 1, 0.7, 1],
    castShadows: true,
    receiveShadows: true,
  }),
  transform: components.transform({ position: [1.7, -0.2, 0] }),
  boundingBoxHelper: components.boundingBoxHelper({ color: [1, 0.5, 0, 1] }),
});
world.add(cubeInstancesEntity);

// GUI
// gui.addFPSMeeter();
// gui.addColumn("Lights");
// gui.addHeader("Directional Light");
// gui.addParam(
//   "Intensity",
//   directionalLightEntity.directionalLight,
//   "intensity",
//   {
//     min: 0,
//     max: 20,
//   }
// );

// gui.addColumn("Cameras");
// gui.addHeader("Perspective Cam");
// gui.addParam("fov", persCameraCmp, "fov", {
//   min: 0,
//   max: (120 / 180) * Math.PI,
// });
// gui.addParam("Near", persCameraCmp, "near", { min: 0, max: 5 });
// gui.addParam("Far", persCameraCmp, "far", { min: 5, max: 50 });

// gui.addHeader("Orthographic Cam");
// gui.addParam("Near", orthoCameraCmp, "near", { min: 0, max: 5 });
// gui.addParam("Far", orthoCameraCmp, "far", { min: 5, max: 20 });
// gui.addParam("Zoom", orthoCameraCmp, "zoom", { min: 1, max: 5 });

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((e) => e.camera)
  );

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
