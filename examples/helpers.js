import {
  systems,
  components,
  world as createWorld,
  entity as createEntity,
  loaders,
} from "../index.js";
import createContext from "pex-context";
import { quat, vec3 } from "pex-math";
import createGUI from "pex-gui";

import { cube } from "primitive-geometry";
import normals from "angle-normals";
// import centerAndNormalize from "geom-center-and-normalize";

import { centerAndNormalize, getURL } from "./utils.js";

import * as d from "./assets/models/stanford-dragon/stanford-dragon.js";
import { aabb } from "pex-geom";

const dragon = { ...d };

const State = {
  rotation: 1.5 * Math.PI,
};
const ctx = createContext({
  type: "webgl",
});
const world = createWorld();
window.world = world;
const gui = createGUI(ctx);

const orbitCameraEntity = createEntity({
  camera: components.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    exposure: 0.6,
    // viewport: [0, 0, Math.floor(0.75 * window.innerWidth), window.innerHeight],
  }),
  // components.postProcessing({}),
  transform: components.transform({ position: [0, 0, 0] }),
  orbiter: components.orbiter({ position: [2, 2, 2] }),
});
world.add(orbitCameraEntity);

/*
const persCameraCmp = components.camera({
  fov: Math.PI / 4,
  aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  near: 1,
  far: 18, //TODO:
  // postprocess: false,
  viewport: [
    Math.floor(0.75 * window.innerWidth),
    window.innerHeight - Math.floor((1 / 2) * window.innerHeight),
    Math.floor(0.25 * window.innerWidth),
    Math.floor((1 / 2) * window.innerHeight),
  ],
});
const persCameraEntity = createEntity({
  camera: persCameraCmp,
  transform: components.transform({
    position: [0, 2, 3],
    rotation: quat.fromEuler(quat.create(), [-Math.PI / 5, 0, 0]),
  }),
  cameraHelper: true,
});
world.add(persCameraEntity);

const orthoCameraCmp = components.camera({
  fov: Math.PI / 3,
  projection: "orthographic",
  aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  near: 0.1,
  far: 10,
  zoom: 3,
  postprocess: false,
  viewport: [
    Math.floor(0.75 * window.innerWidth),
    0,
    Math.floor(0.25 * window.innerWidth),
    Math.floor((1 / 2) * window.innerHeight),
  ],
});
const orthoCameraEntity = createEntity({
  camera: orthoCameraCmp,
  transform: components.transform({
    position: [0, 2, 3],
    rotation: quat.fromEuler(quat.create(), [-Math.PI / 5, 0, 0]),
  }),
  cameraHelper: true,
});
world.add(orthoCameraEntity);
*/
// skybox and  reflection probe
const skybox = createEntity({
  transform: components.transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation),
  }),
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: false, //TODO:
  }),
});
world.add(skybox);

const reflectionProbe = createEntity({
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbe);

//lights
const directionalLightCmp = components.directionalLight({
  castShadows: true,
  color: [1, 1, 1, 1],
  intensity: 5,
});
const directionalLight = createEntity({
  transform: components.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([1, -3, -1])
    ),
    position: [-1, 2, -1],
  }),
  directionalLight: directionalLightCmp,
  lightHelper: true,
});
world.add(directionalLight);
gui.addColumn("Lights");
gui.addHeader("Directional Light");
// gui.addParam("Enabled", directionalLightCmp, "enabled", {}, (value) => {
//   directionalLightCmp.set({ enabled: value });
// });
gui.addParam(
  "Intensity",
  directionalLightCmp,
  "intensity",
  { min: 0, max: 20 },
  () => {
    directionalLightCmp.set({ intensity: directionalLightCmp.intensity });
  }
);

//floor
const floorEntity = createEntity({
  transform: components.transform({
    position: [0, -0.4, 0],
  }),
  geometry: {
    ...components.geometry(cube({ sx: 7, sy: 0.1, sz: 5 })),
    bounds: [
      [-3.5, -0.5, -2.5],
      [3.5, 0.5, 2.5],
    ],
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
loadScene(getURL(`assets/models/CesiumMan/CesiumMan.glb`), {
  scale: [0.8, 0.8, 0.8],
  position: [0.5, -0.35, 0],
});

//buster drone
loadScene(getURL(`assets/models/buster-drone/buster-drone-etc1s-draco.glb`), {
  scale: [0.006, 0.006, 0.006],
  position: [-0.3, 0.25, 0],
});

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

console.log(
  "aabb cubeInstancesEntity",
  "" + cubeInstancesEntity.geometry.bounds?.[0],
  " " + cubeInstancesEntity._transform?.worldBounds?.[0]
);

setTimeout(() => {
  console.log(
    "aabb cubeInstancesEntity",
    "" + cubeInstancesEntity.geometry.bounds?.[0],
    " " + cubeInstancesEntity._transform?.worldBounds?.[0]
  );
}, 1000);

/*
gui.addColumn("Cameras");
gui.addHeader("Perspective Cam");
gui.addParam(
  "fieldOfView (rad)",
  persCameraCmp,
  "fov",
  { min: 0, max: (120 / 180) * Math.PI },
  (fov) => {
    persCameraCmp.set({ fov });
  }
);
gui.addParam("Near", persCameraCmp, "near", { min: 0, max: 5 }, (near) => {
  persCameraCmp.set({ near });
});
gui.addParam("Far", persCameraCmp, "far", { min: 5, max: 50 }, (far) => {
  persCameraCmp.set({ far });
});

gui.addHeader("Orthographic Cam");
gui.addParam("Near", orthoCameraCmp, "near", { min: 0, max: 5 }, (near) => {
  orthoCameraCmp.set({ near });
});
gui.addParam("Far", orthoCameraCmp, "far", { min: 5, max: 20 }, (far) => {
  orthoCameraCmp.set({ far });
});
gui.addParam("Zoom", orthoCameraCmp, "zoom", { min: 1, max: 5 }, (zoom) => {
  orthoCameraCmp.set({ zoom });
});

const helperEntity = createEntity({
  axisHelper: { scale: 3 },
  gridHelper: { size: 30, step: 0.5 },
});
world.add(helperEntity);
*/
world.addSystem(systems.geometry({ ctx }));
world.addSystem(systems.animation());
world.addSystem(systems.transform());
world.addSystem(systems.camera());
world.addSystem(systems.skybox({ ctx }));
world.addSystem(systems.reflectionProbe({ ctx }));
world.addSystem(systems.renderer({ ctx, outputEncoding: ctx.Encoding.Gamma }));
world.addSystem(systems.helper({ ctx }));

gui.addFPSMeeter();
ctx.frame(() => {
  world.update();
  gui.draw();
});

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

  console.log("scene", scene);
  scene.entities.forEach((entity) => {
    entity.boundingBoxHelper = components.boundingBoxHelper({
      color: [0.85, 0.5, 0.85, 1],
    });
  });
  Object.assign(scene.root.transform, transformProps);

  scene.entities.forEach((entity) => {
    world.add(entity);
  });

  //window.dispatchEvent(new CustomEvent('pex-screenshot'))
}
