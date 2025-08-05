import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat, vec3 } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";

import { cube, torus, sphere, roundedCube } from "primitive-geometry";

import { getEnvMap } from "./utils.js";

import dot from "./graph-viz.js";

random.seed(2);

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

renderEngine.renderGraph.renderPass = (opts) => {
  if (dot) {
    const passId =
      opts.pass?.id ||
      "RenderPass " + renderEngine.renderGraph.renderPasses.length;
    const passName = opts.name || opts.pass?.name || null;

    dot.passNode(passId, passName.replace(" ", "\n"));

    const colorTextureId = opts?.pass?.opts?.color?.[0].id;
    const colorTextureName = opts?.pass?.opts?.color?.[0].name;
    if (colorTextureId) {
      dot.resourceNode(colorTextureId, colorTextureName.replace(" ", "\n"));
      dot.edge(passId, colorTextureId);
    } else {
      dot.edge(passId, "Window");
    }

    const depthTextureId = opts?.pass?.opts?.depth?.id;
    const depthTextureName = opts?.pass?.opts?.depth?.name;
    if (depthTextureId) {
      dot.resourceNode(depthTextureId, depthTextureName.replace(" ", "\n"));
      dot.edge(passId, depthTextureId);
    }
    if (opts.uses) {
      opts.uses.forEach((tex) => {
        if (dot) dot.edge(tex.id, passId);
      });
    }
  }

  if (opts.uses && ctx.debugMode) console.log("render-graph uses", opts.uses);

  renderEngine.renderGraph.renderPasses.push(opts);
};

// Entities
const cameraEntity = createEntity({
  transform: components.transform({ position: [3, 1.5, 3] }),
  camera: components.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

// - unlit
const floorEntity = createEntity({
  transform: components.transform({ position: [0, -0.8, 0] }),
  geometry: components.geometry(cube({ sx: 10, sy: 0.01, sz: 10 })),
  material: components.material({
    // unlit: true,
    baseColor: [1, 1, 0, 1],
    metallic: 0,
    roughness: 1,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(floorEntity);

const BlendModes = {
  refraction: {
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.Zero,
    blendDstAlphaFactor: ctx.BlendFactor.Zero,
  },
  "alpha-blend": {
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.One,
  },
};

// - opaque
const torusEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(torus({ radius: 0.8, minorRadius: 0.1 })),
  material: components.material({
    baseColor: [1.9, 0.5, 0.29, 1],
    metallic: 0,
    roughness: 0.05,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(torusEntity);

const sphereEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(sphere()),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.1,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(sphereEntity);

const g = {
  positions: [],
  scales: [],
  colors: [],
};
const reveal = 0.2;

const colorPalette = [];
for (let i = 0; i < 6; i++) {
  colorPalette.push([
    random.float(1.4),
    random.float(1.4),
    random.float(1.4),
    1,
  ]);
}

for (let x = -1.75; x <= 2; x += 0.5) {
  for (let z = -1.75; z <= 2; z += 0.5) {
    for (let y = -0.75; y <= 1; y += 0.5) {
      if (x < 0.25 || y < 0.25 || z < 0.25) {
        let dx = 0;
        let dy = 0;
        let dz = 0;
        if (x < -0.25) dx -= 3 * reveal;
        if (y < -0.25) dy -= 3 * reveal;
        if (z < -0.25) dz -= 3 * reveal;
        if (x > 0.25) dx += 2 * reveal;
        if (y > 0.25) dy += 2 * reveal;
        if (z > 0.25) dz += 2 * reveal;
        if (random.chance(0.5)) continue;

        g.positions.push([x + dx, y + dy, z + dz]);
        g.scales.push([0.5, 0.5, 0.5]);
        // if (random.chance(0.5)) {
        g.colors.push(random.element(colorPalette));
        // } else {
        // g.colors.push([0.1, 0.1, 0.1, 1]);
        // }
      }
    }
  }
}

const g1 = {
  positions: [],
  scales: [],
  colors: [],
};

const g2 = {
  positions: [],
  scales: [],
  colors: [],
};

g.positions.forEach((p, i) => {
  if (random.chance(0.2)) {
    g1.positions.push(p);
    g1.scales.push(g.scales[i]);
    g1.colors.push(g.colors[i]);
  } else {
    g2.positions.push(p);
    g2.scales.push(g.scales[i]);
    g2.colors.push(g.colors[i]);
  }
});

// - transparent
const transparentCubesEntity = createEntity({
  transform: components.transform({ scale: new Array(3).fill(0.5) }),
  geometry: components.geometry({
    ...roundedCube({ sx: 1, sy: 1, sz: 1, radius: 0.005 }),
    offsets: g1.positions,
    scales: g1.scales,
    colors: g1.colors,
    instances: g1.positions.length,
  }),
  material: components.material({
    baseColor: [1, 1, 1, 0.5],
    metallic: 0,
    roughness: 0.15,
    receiveShadows: true,
    castShadows: true,
    ...BlendModes["alpha-blend"],
  }),
});
world.add(transparentCubesEntity);

// - transmission
const transmittedCubesEntity = createEntity({
  transform: components.transform({ scale: new Array(3).fill(0.5) }),
  geometry: components.geometry({
    ...roundedCube({ sx: 0.99, radius: 0.05 }),
    offsets: g2.positions,
    scales: g2.scales,
    instances: g2.positions.length,
  }),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.5,
    transmission: 1,
    receiveShadows: false,
    thickness: 0.9,
    attenuationDistance: 0.15,
    attenuationColor: [0.96, 0.82, 0.28],
    dispersion: 10,
    ior: 1.5,
    specular: 0.1,
    specularColor: [0, 0, 1],
    cullFace: false,
  }),
});
world.add(transmittedCubesEntity);

const skyEntity = createEntity({
  skybox: components.skybox({
    backgroundBlur: false,
    envMap: await getEnvMap(ctx, "assets/envmaps/garage/garage.hdr"),
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.fromPointToPoint(quat.create(), [-2, 2, 0], [0, 0, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 2],
    intensity: 1,
    castShadows: true,
    bias: 0.03,
  }),
});
world.add(directionalLightEntity);

const directionalLightEntity2 = createEntity({
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.fromPointToPoint(quat.create(), [2, 2, -2], [0, 0, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 2],
    intensity: 1,
    castShadows: true,
    bias: 0.03,
  }),
});
world.add(directionalLightEntity2);

// GUI
const gui = createGUI(ctx);
const unitOptions = { min: 0, max: 1 };
gui.addColumn("Capture");
gui.addFPSMeeter();
const dummyTexture2D = ctx.texture2D({
  name: "dummyTexture2D",
  width: 4,
  height: 4,
});
const guiCaptureControl = gui.addTexture2D("Capture", null, { flipY: true });
gui.addRadioList(
  "Debug",
  renderEngine.renderers.find(
    (renderer) => renderer.type == "standard-renderer",
  ),
  "debugRender",
  [
    "",

    "data.texCoord0",
    "data.texCoord1",
    "data.normalView",
    "data.tangentView",
    "data.normalWorld",
    "data.NdotV",

    "data.transmission",
    "data.opacity",
    "data.roughness",
    "data.metallic",
    "data.linearRoughness",
    "data.f0",
    "data.reflectionWorld",
    "data.directColor",
    "data.diffuseColor",
    "data.indirectDiffuse",
    "data.indirectSpecular",

    "data.transmitted",
    "data.thickness",
    "data.attenuationColor",
    "data.attenuationDistance",
    "data.dispersion",
    "data.f90",
    "data.ior",

    "vNormalView",
    "vNormalWorld",
  ].map((value) => ({ name: value || "No debug", value })),
);
// renderEngine.renderers.find(
//   (renderer) => renderer.type == "standard-renderer",
// ).debugRender = "data.transmitted";

gui.addColumn("Transparent");
gui.addParam(
  "Base color",
  transparentCubesEntity.material,
  "baseColor",
  unitOptions,
);

gui.addColumn("Transmission");
gui.addParam(
  "Base color",
  transmittedCubesEntity.material,
  "baseColor",
  unitOptions,
);
gui.addParam(
  "Roughness",
  transmittedCubesEntity.material,
  "roughness",
  unitOptions,
);
gui.addParam("IOR", transmittedCubesEntity.material, "ior", {
  min: 1,
  max: 2.42,
});
gui.addParam(
  "Transmission",
  transmittedCubesEntity.material,
  "transmission",
  unitOptions,
);
gui.addLabel("Volume");
gui.addParam(
  "Thickness",
  transmittedCubesEntity.material,
  "thickness",
  unitOptions,
);
gui.addParam(
  "Attenuation Distance",
  transmittedCubesEntity.material,
  "attenuationDistance",
  { min: 0, max: 10 },
);
gui.addParam(
  "Attenuation Color",
  transmittedCubesEntity.material,
  "attenuationColor",
);
gui.addLabel("Dispersion");
gui.addParam(
  "Dispersion Strength",
  transmittedCubesEntity.material,
  "dispersion",
  { min: 0, max: 10 },
);
gui.addLabel("Specular");
gui.addParam(
  "Specular Strength",
  transmittedCubesEntity.material,
  "specular",
  unitOptions,
);
gui.addParam(
  "Specular Color",
  transmittedCubesEntity.material,
  "specularColor",
);

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

let frame = 0;

ctx.frame(() => {
  frame++;

  dot.reset();
  quat.fromAxisAngle(
    torusEntity.transform.rotation,
    [0, 1, 0],
    performance.now() * 0.001,
  );
  torusEntity.transform.dirty = true;

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  const transmissionBackgroundTexture = renderEngine.renderGraph.renderPasses
    .find(({ name }) => name.startsWith("TransmissionFrontPass"))
    ?.uses.find(({ name }) => name.startsWith("grabPassOutput"));

  guiCaptureControl.texture = transmissionBackgroundTexture || dummyTexture2D;

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  // if (frame == 1) dot.render();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
