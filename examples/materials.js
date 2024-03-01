import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { vec3, quat, mat2x3, mat3, vec2 } from "pex-math";
import * as io from "pex-io";

import { sphere } from "primitive-geometry";
import gridCells from "grid-cells";

import { getEnvMap, getTexture, getURL } from "./utils.js";

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const gui = createGUI(ctx);
gui.addFPSMeeter().setPosition(10, 40);
gui.addStats();

const H = ctx.gl.drawingBufferHeight;
const nW = 4;
const nH = 3;

// Materials
const transform23 = mat2x3.create();
mat2x3.scale(transform23, [1.5, 1.5]);
const transform = mat3.fromMat2x3(mat3.create(), transform23);

const materials = {
  Default: {},
  Unlit: {
    unlit: true,
    baseColor: [1, 0, 0, 0.5],
  },
  "Unlit Base Color Texture": {
    unlit: true,
    baseColor: [1, 1, 1, 0.5],
    baseColorTexture: await getTexture(
      ctx,
      getURL(
        `assets/materials/plastic-green.material/plastic-green_basecolor.png`,
      ),
      ctx.Encoding.SRGB,
    ),
  },
  "Base Color": {
    roughness: 0.5,
    metallic: 0,
    baseColor: [0.1, 0.5, 0.8, 1.0],
  },
  Transparent: {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 0.5],
    blend: true,
    depthWrite: false,
    blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.One,
  },
  Refraction: {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 0.5],
    transmission: 0.1,
    refraction: 0.5,
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.Zero,
    blendDstAlphaFactor: ctx.BlendFactor.Zero,
  },
  // Base color map
  "Base Color Texture": {
    baseColor: [1.0, 1.0, 1.0, 1.0],
    metallic: 0,
    roughness: 1,
    baseColorTexture: {
      texture: await getTexture(
        ctx,
        getURL(`assets/textures/uv-wide/uv-wide.png`),
        ctx.Encoding.SRGB,
      ),
      matrix: transform,
    },
  },
  // Roughness map
  "Roughness Texture": {
    baseColor: [1.0, 1.0, 0.9, 1.0],
    metallic: 1,
    roughness: 1,
    roughnessTexture: await getTexture(
      ctx,
      getURL(`assets/textures/roughness-test/roughness-test.png`),
    ),
  },
  // Basic PBR maps
  "Basic PBR Textures": {
    baseColorTexture: await getTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_basecolor.png`),
      ctx.Encoding.SRGB,
    ),
    roughnessTexture: await getTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_roughness.png`),
    ),
    metallicTexture: await getTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_metallic.png`),
    ),
    normalTexture: await getTexture(
      ctx,
      getURL(`assets/materials/plastic-red.material/plastic-red_n.png`),
    ),
  },
  // Emissive
  "Emissive Texture": {
    baseColor: [1, 1, 1, 1],
    baseColorTexture: await getTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_basecolor.png`,
      ),
    ),
    roughnessTexture: await getTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_roughness.png`,
      ),
    ),
    metallicTexture: await getTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_metallic.png`,
      ),
    ),
    normalTexture: await getTexture(
      ctx,
      getURL(`assets/materials/plastic-glow.material/plastic-glow_n.png`),
    ),
    emissiveColor: [1, 1, 1, 1],
    emissiveColorTexture: await getTexture(
      ctx,
      getURL(
        `assets/materials/plastic-glow.material/plastic-glow_emissive.png`,
      ),
      ctx.Encoding.SRGB,
    ),
    emissiveIntensity: 4,
  },
  // Alpha map
  "Alpha Texture": {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 1],
    alphaTest: 0.5,
    cullFace: false,
    baseColorTexture: await getTexture(
      ctx,
      getURL(`assets/textures/alpha-test-mask/alpha-test-mask.png`),
      ctx.Encoding.SRGB,
    ),
    alphaTexture: await getTexture(
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
    //   texture: await getTexture(
    //     ctx,
    //     getURL(
    //       `glTF-Sample-Models/2.0/SheenCloth/glTF/technicalFabricSmall_sheen_256.png`
    //     ),
    //     ctx.Encoding.SRGB
    //   ),
    //   scale: [30, -30],
    // },
    // sheenRoughnessTexture: {
    //   texture: await getTexture(
    //     ctx,
    //     getURL(
    //       `glTF-Sample-Models/2.0/SheenCloth/glTF/technicalFabricSmall_sheen_256.png`
    //     ),
    //     ctx.Encoding.SRGB
    //   ),
    //   scale: [30, -30],
    // },
  },
};

const materialNames = Object.keys(materials);
const materialValues = Object.values(materials);

// Meshes
const sphereGeometry = sphere({ nx: 32, ny: 32 });

const geometry = {
  positions: { buffer: ctx.vertexBuffer(sphereGeometry.positions) },
  normals: { buffer: ctx.vertexBuffer(sphereGeometry.normals) },
  uvs: { buffer: ctx.vertexBuffer(sphereGeometry.uvs) },
  cells: { buffer: ctx.indexBuffer(sphereGeometry.cells) },
};

for (let i = 0; i < nW * nH; i++) {
  const layer = `cell${i}`;
  const cameraEntity = createEntity({
    layer,
    transform: components.transform({
      position: [0, 0, 2],
    }),
    camera: components.camera({
      fov: Math.PI / 4,
    }),
    orbiter: components.orbiter({ element: ctx.gl.canvas }),
  });
  world.add(cameraEntity);

  const material = materialValues[i];
  if (!material) continue;

  const materialEntity = createEntity({
    layer,
    transform: components.transform(),
    geometry: components.geometry(geometry),
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
    intensity: 1,
  }),
});
world.add(directionalLightEntity);

const skyEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [0, 5, -5],
    envMap: await getEnvMap(ctx, "assets/envmaps/garage/garage.hdr"),
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

// Events
let debugOnce = false;

const headers = materialNames.map((headerTitle) => gui.addHeader(headerTitle));

const viewportToCanvasPosition = (viewport, height) => [
  viewport[0] / pixelRatio,
  (height * (1 - viewport[1] / height - viewport[3] / height)) / pixelRatio,
];

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });

  const W = width * pixelRatio;
  const H = height * pixelRatio;

  const cells = gridCells(W, H, nW, nH, 0).map((cell) => [
    cell[0],
    H - cell[1] - cell[3],
    cell[2],
    cell[3],
  ]);

  cells.forEach((cell, i) => {
    const labelPosition = [10, 10];
    vec2.add(labelPosition, viewportToCanvasPosition(cell, H));
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
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((entity) => entity.camera),
  );

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
