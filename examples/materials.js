import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import createGUI from "pex-gui";
import { vec3, quat, vec2 } from "pex-math";

import { sphere } from "primitive-geometry";
import gridCells from "grid-cells";

import { getGpuTexture, getURL } from "./utils.js";
import { getRenderPassGraphViz } from "./graph-viz.js";

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const renderPassGraphViz = getRenderPassGraphViz();
renderPassGraphViz.init(ctx, renderEngine.frameGraph);

const gui = createGUI(ctx);
gui.addFPSMeeter().setPosition(10, 40);
gui.addStats();
gui.addButton("Toggle Render Pass Graph", () => {
  renderPassGraphViz.toggle();
});

const nW = 4;
const nH = 3;

const remapRoughness = (t) => Math.pow(t, 2);

// Materials
const materials = {
  Default: {},
  Unlit: {
    unlit: true,
    baseColor: [1, 0, 0, 0.5],
  },
  "Unlit Base Color Texture": {
    unlit: true,
    baseColor: [1, 1, 1, 0.5],
    baseColorTexture: await getGpuTexture(
      ctx,
      getURL(
        `assets/materials/plastic-green.material/plastic-green_basecolor.png`,
      ),
      true,
    ),
  },
  "Base Color": {
    roughness: remapRoughness(0.5),
    metallic: 0,
    baseColor: [0.1, 0.5, 0.8, 1.0],
  },
  Transparent: {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 0.5],
    blend: true,
    depthWrite: false,
  },
  Transmission: {
    roughness: remapRoughness(0.5),
    metallic: 0,
    baseColor: [1, 1, 1, 1],
    transmission: 0.9,
    thickness: 0.9,
    attenuationDistance: 0.15,
    attenuationColor: [0.96, 0.82, 0.82],
    // dispersion: 10,
  },
  // Base color map
  "Base Color Texture": {
    baseColor: [1.0, 1.0, 1.0, 1.0],
    metallic: 0,
    roughness: 1,
    baseColorTexture: Object.assign({
      texture: await getGpuTexture(
        ctx,
        getURL(`assets/textures/uv-wide/uv-wide.png`),
        true,
      ),
      scale: [1.5, 1.5],
    }),
  },
  // Roughness map
  "Roughness Texture": {
    baseColor: [1.0, 1.0, 0.9, 1.0],
    metallic: 1,
    roughness: 1,
    roughnessTexture: await getGpuTexture(
      ctx,
      getURL(`assets/textures/roughness-test/roughness-test.png`),
    ),
  },
  // Basic PBR maps
  "Basic PBR Textures": {
    baseColorTexture: await getGpuTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_basecolor.png`),
      true,
    ),
    roughnessTexture: await getGpuTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_roughness.png`),
    ),
    metallicTexture: await getGpuTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_metallic.png`),
    ),
    normalTexture: await getGpuTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_n.png`),
    ),
  },
  // Emissive
  "Emissive Texture": {
    baseColor: [1, 1, 1, 1],
    baseColorTexture: await getGpuTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_basecolor.png`,
      ),
      true,
    ),
    roughnessTexture: await getGpuTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_roughness.png`,
      ),
    ),
    metallicTexture: await getGpuTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_metallic.png`,
      ),
    ),
    normalTexture: await getGpuTexture(
      ctx,
      getURL(`assets/materials/plastic-glow.material/plastic-glow_n.png`),
    ),
    emissiveColor: [1, 1, 1, 1],
    emissiveColorTexture: await getGpuTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_emissive.png`,
      ),
      true,
    ),
    emissiveStrength: 4,
  },
  // Alpha map
  "Alpha Texture": {
    roughness: remapRoughness(0.5),
    metallic: 0,
    baseColor: [1, 1, 1, 1],
    alphaTest: 0.5,
    cullFace: false,
    baseColorTexture: await getGpuTexture(
      ctx,
      getURL(`assets/textures/alpha-test-mask/alpha-test-mask.png`),
      true,
    ),
    alphaTexture: await getGpuTexture(
      ctx,
      getURL(`assets/textures/checkerboard/checkerboard.png`),
    ),
  },
  // Sheen
  Sheen: {
    // baseColor: [0.9, 0.9, 0.9, 1.0],
    sheenColor: [1, 1, 0, 1.0],
    sheenRoughness: 1,
    // sheenColorTexture: {
    //   texture: await getGpuTexture(
    //     ctx,
    //     getURL(
    //       `glTF-Sample-Models/2.0/SheenCloth/glTF/technicalFabricSmall_sheen_256.png`
    //     ),
    //     true,
    //   ),
    //   scales: [30, -30],
    // },
    // sheenRoughnessTexture: {
    //   texture: await getGpuTexture(
    //     ctx,
    //     getURL(
    //       `glTF-Sample-Models/2.0/SheenCloth/glTF/technicalFabricSmall_sheen_256.png`
    //     ),
    //     true,
    //   ),
    //   scales: [30, -30],
    // },
  },
  // // Specular-glossiness workflow (alternative to metallic-roughness)
  // "Specular Glossiness": {
  //   sgDiffuse: [0.8, 0.2, 0.2, 1.0],
  //   sgSpecular: [0.5, 0.5, 0.5],
  //   sgGlossiness: 0.8,
  // },
};

const materialValues = Object.values(materials);

// Meshes
const sphereGeometry = sphere({ nx: 32, ny: 32 });

for (let i = 0; i < nW * nH; i++) {
  const material = materialValues[i];

  const layer = `cell${i}`;
  const cameraEntity = createEntity({
    layer,
    transform: components.transform({
      position: [0, 0, 2],
    }),
    camera: components.camera(),
    postProcessing: components.postProcessing({
      // bloom: material.emissiveColor && components.postProcessing.bloom(),
    }),
    orbiter: components.orbiter({ element: ctx.canvas }),
  });
  world.add(cameraEntity);

  if (!material) continue;

  const materialEntity = createEntity({
    layer,
    transform: components.transform(),
    geometry: components.geometry(sphereGeometry),
    material: components.material(material),
  });
  world.add(materialEntity);
}

// Sky
const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [-2, 2, 2],
    rotation: quat.fromDirection(quat.create(), vec3.normalize([-2, -2, -1])),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 2],
    intensity: 100_000, // lx, a clear midday sun
  }),
});
world.add(directionalLightEntity);

const skyEntity = createEntity({
  skybox: components.skybox({
    envMap: await loaders.hdr(ctx, getURL("assets/envmaps/garage/garage.hdr")),
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

// Events
let debugOnce = false;

const headers = Object.keys(materials).map((headerTitle) =>
  gui.addHeader(headerTitle),
);

const viewportToCanvasPosition = (viewport) => [
  viewport[0] / pixelRatio,
  viewport[1] / pixelRatio,
];

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  gpu.resize(ctx, width, height, pixelRatio);

  const W = width * pixelRatio;
  const H = height * pixelRatio;

  const cells = gridCells(W, H, nW, nH, 0);

  cells.forEach((cell, i) => {
    const labelPosition = [10, 10];
    vec2.add(labelPosition, viewportToCanvasPosition(cell));
    headers[i]?.setPosition(...labelPosition);
  });

  world.entities
    .filter((entity) => entity.camera)
    .forEach((cameraEntity, i) => {
      cameraEntity.camera.viewport = cells[i];
      cameraEntity.camera.aspect = cells[i][2] / cells[i][3];
      cameraEntity.camera.dirty = true;
    });
};

window.addEventListener("resize", onResize);
onResize();

window.addEventListener("keydown", ({ key }) => {
  // if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  await renderEngine.render(
    world.entities,
    world.entities.filter((entity) => entity.camera),
  );

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
