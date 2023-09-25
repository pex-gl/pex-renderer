import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { mat4, quat, vec3 } from "pex-math";
import * as io from "pex-io";
import { aabb } from "pex-geom";
import random from "pex-random";
import createGUI from "pex-gui";

import { cube, roundedCube, capsule, sphere } from "primitive-geometry";
// import normals from "angle-normals";
// import centerAndNormalize from "geom-center-and-normalize";
import parseHdr from "parse-hdr";

import { dragon, getTexture, getURL } from "./utils.js";

random.seed(14);

const State = {
  enabled: true,

  sunPosition: [0, 1, -5],
  elevation: 25,
  azimuth: -45,

  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],

  autofocus: true,

  aa: true,
  fog: true,
  bloom: true,
  dof: true,
  lut: true,
  colorCorrection: true,
  vignette: true,
};

// const pixelRatio = devicePixelRatio;
const pixelRatio = 1;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

window.renderEngine = renderEngine;
window.world = world;

// Entities
const helperEntity = createEntity({
  transform: components.transform({ position: [0, 0.01, 0] }),
  axesHelper: components.axesHelper(),
  gridHelper: components.gridHelper(),
});
world.add(helperEntity);
// Scale scene to macro, 1m -> 5cm
const s = 1;
// const s = 0.05;
const scene = createEntity({
  transform: components.transform({ scale: [s, s, s] }),
});

world.add(scene);

// Geometry
const dragonBounds = aabb.create();
aabb.fromPoints(dragonBounds, dragon.positions);

// Camera
const camera = components.camera({
  fov: Math.PI / 6,
  aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  exposure: 1,
  fStop: 0.7,
});
const postProcessing = components.postProcessing({
  // ssao: true,
  dof: {
    debug: false,
    focusDistance: 7,
  },
  aa: {
    type: "fxaa2",
    spanMax: 8,
  },
  fog: {
    color: [0.5, 0.5, 0.5],
    start: 5,
    density: 0.15,

    sunPosition: [1, 1, 1],
    sunDispertion: 0.2,
    sunIntensity: 0.1,
    sunColor: [0.98, 0.98, 0.7],
    inscatteringCoeffs: [0.3, 0.3, 0.3],
  },
  bloom: {
    threshold: 1,
    radius: 1,
    intensity: 0.1,
  },
  lut: {
    texture: await getTexture(
      ctx,
      getURL(`assets/textures/lut/lookup-autumn.png`),
      ctx.Encoding.Linear,
      {
        min: ctx.Filter.Nearest,
        mag: ctx.Filter.Nearest,
        mipmap: false,
        flipY: false,
        aniso: 0,
        pixelFormat: ctx.PixelFormat.RGBA32F,
      }
    ),
  },
  colorCorrection: {
    brightness: 0,
    contrast: 1,
    saturation: 1,
    hue: 0,
  },
  vignette: {
    radius: 0.8,
    intensity: 0.2,
  },
  opacity: 1,
});
const cameraEntity = createEntity({
  transform: components.transform({ position: [-3, s * 4, s * 8] }),
  camera,
  orbiter: components.orbiter({ element: ctx.gl.canvas, target: [0, 1, 0] }),
  postProcessing,
});
world.add(cameraEntity);

// Meshes
const baseColorTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_basecolor.png`),
  ctx.Encoding.SRGB
);
const normalTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_n.png`)
);
const metallicTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_metallic.png`)
);
const roughnessTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_roughness.png`)
);
const emissiveColorTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-glow.material/plastic-glow_emissive.png`),
  ctx.Encoding.SRGB
);
const geometries = [
  capsule({ radius: 0.25 }),
  roundedCube({ sx: 0.75, nx: 20, radius: 0.2 }),
  sphere({ radius: 0.3 }),
];

// Ground
const floorEntity = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [0, -0.02 / 2, 0],
  }),
  geometry: components.geometry(cube({ sx: 10, sy: 0.02, sz: 10 })),
  material: components.material({
    baseColor: [0.15, 0.15, 0.2, 1.0],
    roughness: 1,
    metallic: 0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(floorEntity);

const backgroundStuffParent = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [0, 0, 0],
    scale: [1, 1, 1],
  }),
});
world.add(backgroundStuffParent);

// Black Spheres
for (let i = 0; i < 20; i++) {
  const sphereEntity = createEntity({
    transform: components.transform({
      parent: backgroundStuffParent.transform,
      position: vec3.add(random.vec3(), [0, 1, 0]),
    }),
    geometry: components.geometry(geometries[2]),
    material: components.material({
      baseColor: [0.07, 0.06, 0.0, 1.0],
      roughness: 0.2,
      metallic: 0,
      castShadows: true,
      receiveShadows: true,
    }),
  });
  world.add(sphereEntity);
}

const dragonScale = 3;
const dragonEntity = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [0, -dragonBounds[0][1] * dragonScale, 2.5],
    scale: new Array(3).fill(dragonScale),
  }),
  geometry: components.geometry(dragon),
  material: components.material({
    baseColor: [0.8, 0.8, 0.8, 1.0],
    roughness: 1,
    metallic: 0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(dragonEntity);

const heights = [2.5, 1.4, 0.5];
// Capsules, rounded cubes, spheres
for (let j = -5; j <= 5; j += 2) {
  geometries.forEach((geometry, i) => {
    const x = j * 0.6;
    let y = heights[i];
    const z = 0;
    const entity = createEntity({
      transform: components.transform({
        parent: backgroundStuffParent.transform,
        position: [x, y, z],
      }),
      geometry: components.geometry(geometry),
      material: components.material({
        baseColor: [0.9, 0.9, 0.9, 1],
        roughness: (j + 5) / 10,
        metallic: 0.0, // 0.01, // (j + 5) / 10,
        baseColorTexture,
        roughnessTexture,
        emissiveColorTexture,
        metallicTexture,
        normalTexture,
        castShadows: true,
        receiveShadows: true,
      }),
    });
    world.add(entity);
  });
}

// Lights
const pointLightEntity = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [2, 2, 2],
  }),
  geometry: components.geometry(sphere({ radius: 0.1 })),
  material: components.material({
    baseColor: [0, 0, 0, 1],
    emissiveColor: [1, 0, 0, 1],
  }),
  pointLight: components.pointLight({
    color: [1, 0, 0, 1],
    intensity: 0.05,
    radius: 3,
    castShadows: true,
  }),
});
world.add(pointLightEntity);

const areaLightEntity = createEntity({
  transform: components.transform({
    parent: backgroundStuffParent.transform,
    position: [0, 3.5, 0],
    scale: [5, 1, 0.1],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([0, -1, 0.001])
    ),
  }),
  geometry: components.geometry(cube()),
  material: components.material({
    baseColor: [0, 0, 0, 1],
    emissiveColor: [2.0, 1.2, 0.1, 1],
  }),
  areaLight: components.areaLight({
    color: [2.0, 1.2, 0.1, 1],
    intensity: 2,
    castShadows: true,
  }),
});
world.add(areaLightEntity);

// Sky
const hdrImg = parseHdr(
  await io.loadArrayBuffer(getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`))
);
const envMap = ctx.texture2D({
  data: hdrImg.data,
  width: hdrImg.shape[0],
  height: hdrImg.shape[1],
  pixelFormat: ctx.PixelFormat.RGBA32F,
  encoding: ctx.Encoding.Linear,
  flipY: true,
});

const sunEntity = createEntity({
  transform: components.transform({
    position: State.sunPosition,
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize(vec3.scale(vec3.copy(State.sunPosition), -1))
    ),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 2,
    castShadows: true,
    bias: 0.01,
  }),
});
world.add(sunEntity);

// const skyboxEntity = createEntity({
//   transform: components.transform({}),
//   skybox: components.skybox({
//     backgroundBlur: 1,
//     sunPosition: State.sunPosition,
//     envMap: panorama,
//   }),
//   reflectionProbe: components.reflectionProbe({
//     origin: [0, 0, 0],
//     size: [10, 10, 10],
//   }),
// });
// world.add(skyboxEntity);
const skyboxEntity = createEntity({
  transform: components.transform({
    // rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation),
  }),
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: false,
    envMap,
  }),
  reflectionProbe: components.reflectionProbe({}),
});
world.add(skyboxEntity);

// const elevationMat = mat4.create();
// const rotationMat = mat4.create();
// function updateSunPosition() {
//   mat4.identity(elevationMat);
//   mat4.identity(rotationMat);
//   mat4.rotate(elevationMat, (State.elevation / 180) * Math.PI, [0, 0, 1]);
//   mat4.rotate(rotationMat, (State.azimuth / 180) * Math.PI, [0, 1, 0]);

//   const sunPosition = [2, 0, 0];
//   vec3.multMat4(sunPosition, elevationMat);
//   vec3.multMat4(sunPosition, rotationMat);

//   const dir = vec3.normalize(vec3.sub([0, 0, 0], sunPosition));
//   sunEntity.transform = {
//     position: sunPosition,
//     rotation: quat.fromTo(
//       sunEntity.transform.rotation,
//       [0, 0, 1],
//       dir,
//       [0, 1, 0]
//     ),
//   };
//   skyboxEntity.skybox = { sunPosition };
//   skyboxEntity.reflectionProbe = { dirty: true };
// }

// updateSunPosition();

renderEngine.systems
  .find(({ type }) => type === "transform-system")
  .sort(world.entities);

// const skyboxCmp = skyboxEntity.skybox;
// const reflectionProbeCmp = skyboxEntity.reflectionProbe;

// GUI
const gui = createGUI(ctx);
gui.addColumn("Attachments");
State.msg = "";
gui.addRadioList(
  "Testing",
  State,
  "msg",
  ["No AA", "FXAA 1", "FXAA 3", "FXAA 3 lod", "FXAA 3 LOW", "FXAA 3 HIGH"].map(
    (name, value) => ({
      name,
      value,
    })
  )
);
gui.addRadioList(
  "Debug Render",
  renderEngine.renderers.find(
    (renderer) => renderer.type == "standard-renderer"
  ),
  "debugRender",
  ["", "data.normalView", "data.emissiveColor", "ao"].map((value) => ({
    name: value || "No debug",
    value,
  }))
);
gui.addRadioList(
  "Debug Post-Processing",
  renderEngine.renderers.find(
    (renderer) => renderer.type == "post-processing-renderer"
  ),
  "debugRender",
  ["", "dof.main", "bloom.threshold", "bloom.downSample[3]"].map((value) => ({
    name: value || "No debug",
    value,
  }))
);
const guiNormalControl = gui.addTexture2D("Normal", null, { flipY: true });
const guiDepthControl = gui.addTexture2D("Depth", null, { flipY: true });

// gui.addTab("Scene");
// gui.addColumn("Environment");
// gui.addHeader("Sun");
// gui.addParam("Enabled", sunEntity.directionalLight, "enabled", {}, (value) => {
//   sunEntity.directionalLight = { enabled: value };
// });
// gui.addParam(
//   "Sun Elevation",
//   State,
//   "elevation",
//   { min: -90, max: 180 },
//   updateSunPosition
// );
// gui.addParam(
//   "Sun Azimuth",
//   State,
//   "azimuth",
//   { min: -180, max: 180 },
//   updateSunPosition
// );
// gui.addHeader("Skybox");
// gui.addParam("Enabled", skyboxCmp, "enabled", {}, (value) => {
//   skyboxCmp = { enabled: value };
// });
gui.addParam("Background Blur", skyboxEntity.skybox, "backgroundBlur");
// gui.addTexture2D("Env map", skyboxCmp.texture);
// gui.addHeader("Reflection probes");
// gui.addParam("Enabled", reflectionProbeCmp, "enabled", {}, (value) => {
//   reflectionProbeCmp = { enabled: value };
// });

// gui.addColumn("Material");
// gui.addParam("Base Color", State, "baseColor", { type: "color" }, () => {
//   entities.forEach((entity) => {
//     entity.material = { baseColor: State.baseColor };
//   });
// });
// gui.addParam("Roughness", State, "roughness", {}, () => {
//   entities.forEach((entity) => {
//     entity.material = { roughness: State.roughness };
//   });
// });
// gui.addParam("Metallic", State, "metallic", {}, () => {
//   entities.forEach((entity) => {
//     entity.material = { metallic: State.metallic };
//   });
// });

// gui.addColumn("Lights");
// gui.addParam(
//   "Point Light Enabled",
//   pointLightEntity.pointLight,
//   "enabled",
//   {},
//   (value) => {
//     pointLightEntity.pointLight = { enabled: value };
//     pointLightEntity.transform = { enabled: value };
//   }
// );
// gui.addParam(
//   "Point Light Pos",
//   pointLightEntity.transform,
//   "position",
//   { min: -5, max: 5 },
//   (value) => {
//     pointLightEntity.transform = { position: value };
//   }
// );
// gui.addParam(
//   "Area Light Enabled",
//   areaLightEntity.areaLight,
//   "enabled",
//   {},
//   (value) => {
//     areaLightEntity.areaLight = { enabled: value };
//     areaLightEntity.transform = { enabled: value };
//   }
// );
// gui.addParam(
//   "Area Light Col",
//   areaLightEntity.areaLight,
//   "color",
//   { type: "color" },
//   (value) => {
//     areaLightEntity.areaLight = { color: value };
//     areaLightEntity.material = { emissiveColor: value };
//   }
// );

// // PostProcess
// const postProcessTab = gui.addTab("PostProcess");
// postProcessTab.setActive();
gui.addColumn("Post-Processing");
gui.addParam("Enabled", State, "enabled", null, () => {
  if (State.enabled) {
    cameraEntity.postProcessing = postProcessing;
  } else {
    delete cameraEntity.postProcessing;
  }
});
gui.addParam("Exposure", camera, "exposure", { min: 0, max: 5 });
// gui.addParam("SSAO", postProcessing, "ssao");
// gui.addParam("SSAO radius", postProcessing, "ssaoRadius", {
//   min: 0,
//   max: 30,
// });
// gui.addParam("SSAO intensity", postProcessing, "ssaoIntensity", {
//   min: 0,
//   max: 10,
// });
// gui.addParam("SSAO bias", postProcessing, "ssaoBias", { min: 0, max: 1 });
// gui.addParam("SSAO blur radius", postProcessing, "ssaoBlurRadius", {
//   min: 0,
//   max: 5,
// });
// gui.addParam("SSAO blur sharpness", postProcessing, "ssaoBlurSharpness", {
//   min: 0,
//   max: 20,
// });
const enablePostProPass = (name) => {
  if (State[name]) {
    if (State[`_${name}`]) postProcessing[name] = State[`_${name}`];
  } else {
    State[`_${name}`] = postProcessing[name];
    delete postProcessing[name];
  }
};
gui.addParam("Dof", State, "dof", null, () => {
  enablePostProPass("dof");
});
// gui.addParam("DOF Debug", postProcessing, "dofDebug");
gui.addParam("DOF Focus Distance", postProcessing.dof, "focusDistance", {
  min: 0,
  max: 100,
});
// gui.addParam("DOF Autofocus", State, "autofocus");
gui.addParam("Camera FoV", camera, "fov", {
  min: 0,
  max: (Math.PI / 3) * 2,
});
gui.addParam("Camera FocalLength", camera, "focalLength", {
  min: 10,
  max: 200,
});
gui.addParam("Camera f-stop", camera, "fStop", {
  min: 0,
  max: 5.6,
});

gui.addParam("AA", State, "aa", null, () => {
  enablePostProPass("aa");
});
gui.addRadioList(
  "AA Type",
  postProcessing.aa,
  "type",
  ["fxaa2", "fxaa3"].map((value) => ({ name: value, value }))
);
gui.addParam("Fog", State, "fog", null, () => {
  enablePostProPass("fog");
});
gui.addParam("Fog color", postProcessing.fog, "color");
gui.addParam("Fog start", postProcessing.fog, "start", { min: 0, max: 10 });
gui.addParam("Fog density", postProcessing.fog, "density");

gui.addParam("Bloom", State, "bloom", null, () => {
  enablePostProPass("bloom");
});
gui.addParam("Bloom threshold", postProcessing.bloom, "threshold", {
  min: 0,
  max: 2,
});
gui.addParam("Bloom intensity", postProcessing.bloom, "intensity", {
  min: 0,
  max: 10,
});
gui.addParam("Bloom radius", postProcessing.bloom, "radius", {
  min: 0,
  max: 10,
});

gui.addParam("LUT", State, "lut", null, () => {
  enablePostProPass("lut");
});

gui.addParam("ColorCorrection", State, "colorCorrection", null, () => {
  enablePostProPass("colorCorrection");
});
gui.addParam(
  "ColorCorrection brightness",
  postProcessing.colorCorrection,
  "brightness",
  {
    min: -0.5,
    max: 0.5,
  }
);
gui.addParam(
  "ColorCorrection contrast",
  postProcessing.colorCorrection,
  "contrast",
  {
    min: 0.1,
    max: 3,
  }
);
gui.addParam(
  "ColorCorrection saturation",
  postProcessing.colorCorrection,
  "saturation",
  {
    min: 0.1,
    max: 2,
  }
);
gui.addParam("ColorCorrection hue", postProcessing.colorCorrection, "hue", {
  min: -180,
  max: 180,
});

gui.addParam("Vignette", State, "vignette", null, () => {
  enablePostProPass("vignette");
});
gui.addParam("Vignette radius", postProcessing.vignette, "radius", {
  min: 0,
  max: 1,
});
gui.addParam("Vignette intensity", postProcessing.vignette, "intensity", {
  min: 0,
  max: 1,
});

gui.addParam("Opacity", postProcessing, "opacity", { min: 0, max: 1 });

enablePostProPass("dof");
enablePostProPass("aa");
enablePostProPass("fog");
enablePostProPass("bloom");
enablePostProPass("lut");
enablePostProPass("colorCorrection");
enablePostProPass("vignette");

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  // if (State.autofocus && camera) {
  //   const distance = vec3.distance(
  //     dragonEntity.transform.worldPosition,
  //     camera.entity.transform.worldPosition
  //   );
  //   if (postProcessing.dofFocusDistance !== distance) {
  //     postProcessing = { dofFocusDistance: distance };
  //     // force redraw
  //     gui.items[0].dirty = true;
  //   }
  // }

  renderEngine.update(world.entities);
  const [{ color, normal, depth }] = renderEngine.render(
    world.entities,
    cameraEntity
  );

  guiNormalControl.texture = normal;
  guiDepthControl.texture = depth;

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
