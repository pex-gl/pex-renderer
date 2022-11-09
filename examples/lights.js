import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { mat4, quat } from "pex-math";
import { cube } from "primitive-geometry";

import normals from "angle-normals";
// import centerAndNormalize from "geom-center-and-normalize";
import gridCells from "grid-cells";

import { centerAndNormalize } from "./utils.js";

import * as d from "./assets/models/stanford-dragon/stanford-dragon.js";

const {
  camera,
  directionalLight,
  pointLight,
  spotLight,
  areaLight,
  geometry,
  material,
  orbiter,
  skybox,
  reflectionProbe,
  transform,
} = components;

const dragon = { ...d };

const ctx = createContext();
ctx.gl.getExtension("EXT_shader_texture_lod");
ctx.gl.getExtension("OES_standard_derivatives");
ctx.gl.getExtension("WEBGL_draw_buffers");
ctx.gl.getExtension("OES_texture_float");

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx);

const W = ctx.gl.drawingBufferWidth;
const H = ctx.gl.drawingBufferHeight;
const nW = 2;
const nH = 2;
let debugOnce = false;

// Utils
const cameraEntities = gridCells(W, H, nW, nH, 0).map((cell) =>
  createEntity({
    transform: transform({
      target: [0, 0, 0],
      position: [2, 2, 3],
    }),
    camera: camera({
      target: [0, 0, 0],
      // position: [2, 2, 2],
      // fov: Math.PI / 3,
      aspect: W / nW / (H / nH),
      viewport: [
        cell[0],
        // flip upside down as we are using viewport coordinates
        H - cell[1] - cell[3],
        cell[2],
        cell[3],
      ],
    }),
    orbiter: orbiter(),
    entities: [],
  })
);

// Geometry
dragon.positions = centerAndNormalize(dragon.positions);
dragon.normals = normals(dragon.cells, dragon.positions);
dragon.uvs = dragon.positions.map(() => [0, 0]);

// Meshes
const dragonEntity = createEntity({
  transform: transform(),
  geometry: geometry(dragon),
  material: material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(dragonEntity);

const floorEntity = createEntity({
  transform: transform({
    position: [0, -0.4, 0],
  }),
  geometry: geometry(cube({ sx: 5, sy: 0.1, sz: 5 })),
  material: material({
    baseColor: [1, 1, 1, 1],
    roughness: 2 / 5,
    metallic: 0,
    receiveShadows: true,
    castShadows: false,
  }),
});
world.add(floorEntity);

// Lights
// Ambient
// const ambientLightEntity = createEntity({
//   ambientLight: ambientLight({
//     color: [0.1, 0.1, 0.1, 1],
//   }),
// });
// world.add(ambientLightEntity);

// Directional
const directionalLightCmp = directionalLight({
  color: [1, 1, 1, 1],
  intensity: 1,
  castShadows: true,
});

const directionalLightEntity = createEntity({
  transform: transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),

  material: material({
    baseColor: [1, 1, 0, 1],
  }),
  directionalLight: directionalLightCmp,
  lightHelper: true,
});
cameraEntities[0].entities.push(directionalLightEntity);

gui.addHeader("Directional").setPosition(10, 10);
gui.addParam("Intensity", directionalLightCmp, "intensity", {
  min: 0,
  max: 20,
});
// gui.addTexture2D("Shadowmap", directionalLightCmp._shadowMap);
gui.addParam("Shadows", directionalLightCmp, "castShadows");

const fixDirectionalLightEntity = createEntity({
  transform: transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  material: material({
    baseColor: [1, 1, 0, 1],
  }),
  directionalLight: directionalLight({
    color: [1, 1, 0, 1],
    intensity: 1,
    castShadows: true,
  }),
  lightHelper: true,
});
cameraEntities[0].entities.push(fixDirectionalLightEntity);

// Spot
const spotLightCmp = spotLight({
  color: [1, 1, 1, 1],
  intensity: 2,
  range: 5,
  angle: Math.PI / 6,
  innerAngle: Math.PI / 12,
  castShadows: true,
});

const spotLightEntity = createEntity({
  transform: transform({
    position: [1, 0.5, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  material: material({
    baseColor: [1, 0, 1, 1],
  }),
  spotLight: spotLightCmp,
  lightHelper: true,
});
cameraEntities[1].entities.push(spotLightEntity);

gui.addHeader("Spot").setPosition(W / 2 + 10, 10);
gui.addParam("Range", spotLightCmp, "range", {
  min: 0,
  max: 20,
});
gui.addParam("Intensity", spotLightCmp, "intensity", { min: 0, max: 20 });
gui.addParam("Angle", spotLightCmp, "angle", {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON,
});
gui.addParam("Inner angle", spotLightCmp, "innerAngle", {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON,
});
// gui.addTexture2D("Shadowmap", spotLightCmp._shadowMap);
gui.addParam("Shadows", spotLightCmp, "castShadows");

const fixSpotLightEntity = createEntity({
  transform: transform({
    position: [1, 0.5, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  material: material({
    baseColor: [1, 0, 1, 1],
  }),
  spotLight: spotLight({
    color: [1, 1, 0, 1],
    intensity: 2,
    range: 5,
    angle: Math.PI / 6,
    innerAngle: Math.PI / 12,
    castShadows: true,
  }),
  lightHelper: true,
});
cameraEntities[1].entities.push(fixSpotLightEntity);

// Point
const pointLightCmp = pointLight({
  color: [1, 1, 1, 1],
  intensity: 2,
  range: 5,
  castShadows: true,
});

const pointLightEntity = createEntity({
  transform: transform({
    position: [1, 1, 1],
  }),
  material: material({
    baseColor: [1, 1, 1, 1],
  }),
  pointLight: pointLightCmp,
  lightHelper: true,
});
cameraEntities[2].entities.push(pointLightEntity);

gui.addHeader("Point").setPosition(10, H / 2 + 10);
gui.addParam("Range", pointLightCmp, "range", {
  min: 0,
  max: 20,
});
gui.addParam("Intensity", pointLightCmp, "intensity", { min: 0, max: 20 });
// gui.addTextureCube("Shadowmap", pointLightCmp._shadowCubemap);
gui.addParam("Shadows", pointLightCmp, "castShadows");

const fixPointLightEntity = createEntity({
  transform: transform({
    position: [1, 1, 1],
  }),
  material: material({
    baseColor: [1, 1, 1, 1],
  }),
  pointLight: pointLight({
    color: [1, 1, 0, 1],
    intensity: 2,
    range: 5,
    castShadows: true,
  }),
  lightHelper: true,
});
cameraEntities[2].entities.push(fixPointLightEntity);

// Area
const areaLightCmp = areaLight({
  color: [1, 1, 1, 1],
  intensity: 4,
  castShadows: true,
});

const areaLightEntity = createEntity({
  transform: transform({
    scale: [2, 0.5, 1],
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  material: material({
    baseColor: [0, 1, 1, 1],
  }),
  areaLight: areaLightCmp,
  lightHelper: true,
});
cameraEntities[3].entities.push(areaLightEntity);

gui.addHeader("Area").setPosition(W / 2 + 10, H / 2 + 10);
// gui.addParam("Enabled", areaLightCmp, "enabled", {}, (value) => {
//   areaLightCmp.set({ enabled: value });
// });

const fixAreaLightEntity = createEntity({
  transform: transform({
    scale: [2, 0.5, 1],
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  material: material({
    baseColor: [0, 1, 1, 1],
  }),
  areaLight: areaLight({
    color: [1, 1, 0, 1],
    intensity: 4,
    castShadows: true,
  }),
  lightHelper: true,
});
cameraEntities[3].entities.push(fixAreaLightEntity);

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.toggleEnabled();
  if (key === "d") debugOnce = true;
});

let delta = 0;

ctx.frame(() => {
  delta += 0.005;

  const position = [2 * Math.cos(delta), 1, 2 * Math.sin(delta)];
  const rotation = quat.targetTo(
    quat.create(),
    position.map((n) => -n),
    [0, 0, 0]
  );

  directionalLightEntity.transform = {
    ...directionalLightEntity.transform,
    position,
    rotation,
  };
  spotLightEntity.transform = {
    ...spotLightEntity.transform,
    position,
    rotation,
  };
  pointLightEntity.transform = { ...pointLightEntity.transform, position };
  areaLightEntity.transform = {
    ...areaLightEntity.transform,
    position,
    rotation,
  };

  renderEngine.update([
    ...world.entities,
    ...cameraEntities,
    ...cameraEntities.map(({ entities }) => entities).flat(),
  ]);

  cameraEntities.forEach((cameraEntity) => {
    renderEngine.render(
      world.entities.concat(cameraEntity.entities),
      cameraEntity,
      {
        renderView: {
          camera: cameraEntity.camera,
          cameraEntity: cameraEntity,
          viewport: cameraEntity.camera.viewport,
        },
      }
    );
  });

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
