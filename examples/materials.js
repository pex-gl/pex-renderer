import createRenderer from "../index.js";
import createContext from "pex-context";
import createGUI from "pex-gui";
import { vec3, quat } from "pex-math";
import random from "pex-random";
import * as io from "pex-io";
import { sphere } from "primitive-geometry";
import gridCells from "grid-cells";
import parseHdr from "parse-hdr";
import { getTexture, getURL } from "./utils.js";

const State = {
  sunPosition: [0, 5, -5],
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: [],
  rgbm: false,
  exposure: 1,
};

random.seed(10);

const ctx = createContext({
  powerPreference: "high-performance",
});
ctx.gl.getExtension("EXT_shader_texture_lod");
ctx.gl.getExtension("OES_standard_derivatives");
ctx.gl.getExtension("WEBGL_draw_buffers");
ctx.gl.getExtension("OES_texture_float");
ctx.gl.getExtension("EXT_texture_filter_anisotropic");

const renderer = createRenderer({
  ctx,
  pauseOnBlur: true,
  rgbm: State.rgbm,
  shadowQuality: 2,
});

const gui = createGUI(ctx);
gui.enabled = false;

const W = ctx.gl.drawingBufferWidth;
const H = ctx.gl.drawingBufferHeight;
const nW = 8;
const nH = 3;
let debugOnce = false;

// Materials
let materials = [
  {
    baseColor: [1.0, 1.0, 1.0, 1.0],
    metallic: 0,
    roughness: 1,
    baseColorMap: getURL(`assets/textures/uv-wide/uv-wide.png`),
  },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 0 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 1 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 2 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 3 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 4 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 5 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 6 / 6 },
  {
    baseColor: [1.0, 1.0, 0.9, 1.0],
    metallic: 1,
    roughness: 1,
    roughnessMap: getURL(`assets/textures/roughness-test/roughness-test.png`),
  },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 0 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 1 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 2 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 3 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 4 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 5 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 6 / 6 },
  null,
  {
    unlit: true,
    baseColor: [1, 1, 1, 0.5],
    baseColorMap: getURL(
      `assets/materials/plastic-green.material/plastic-green_basecolor.png`
    ),
  },
  {
    baseColorMap: getURL(
      `assets/materials/plastic-green.material/plastic-green_basecolor.png`
    ),
    roughnessMap: getURL(
      `assets/materials/plastic-green.material/plastic-green_roughness.png`
    ),
    metallicMap: getURL(
      `assets/materials/plastic-green.material/plastic-green_metallic.png`
    ),
    normalMap: getURL(
      `assets/materials/plastic-green.material/plastic-green_n.png`
    ),
  },
  {
    baseColorMap: getURL(
      `assets/materials/plastic-red.material/plastic-red_basecolor.png`
    ),
    roughnessMap: getURL(
      `assets/materials/plastic-red.material/plastic-red_roughness.png`
    ),
    metallicMap: getURL(
      `assets/materials/plastic-red.material/plastic-red_metallic.png`
    ),
    normalMap: getURL(
      `assets/materials/plastic-red.material/plastic-red_n.png`
    ),
  },
  {
    baseColorMap: getURL(
      `assets/materials/plastic-glow.material/plastic-glow_basecolor.png`
    ),
    roughnessMap: getURL(
      `assets/materials/plastic-glow.material/plastic-glow_roughness.png`
    ),
    metallicMap: getURL(
      `assets/materials/plastic-glow.material/plastic-glow_metallic.png`
    ),
    normalMap: getURL(
      `assets/materials/plastic-glow.material/plastic-glow_n.png`
    ),
    emissiveColor: [1, 1, 1, 1],
    emissiveColorMap: getURL(
      `assets/materials/plastic-glow.material/plastic-glow_emissive.png`
    ),
    emissiveIntensity: 4,
  },
  { roughness: 2 / 7, metallic: 0, baseColor: [0.1, 0.5, 0.8, 1.0] },
  {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 0.5],
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.One,
  },
  {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 1],
    alphaTest: 0.5,
    cullFace: false,
    baseColorMap: getURL(`assets/textures/alpha-test-mask/alpha-test-mask.png`),
    alphaMap: getURL(`assets/textures/checkerboard/checkerboard.png`),
  },
];

// Utils
let cells = gridCells(W, H, nW, nH, 0).map(
  (
    cell // flip upside down as we are using viewport coordinates
  ) => [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
);

cells.forEach((cell, cellIndex) => {
  const tags = [`cell${cellIndex}`];
  const material = materials[cellIndex];
  const cameraCmp = renderer.camera({
    fov: Math.PI / 3,
    aspect: W / nW / (H / nH),
    viewport: cell,
    exposure: State.exposure,
  });
  const postProcessingCmp = renderer.postProcessing({
    fxaa: true,
  });

  if (material && material.emissiveColor) {
    postProcessingCmp.set({
      bloom: true,
      bloomIntensity: 3,
      bloomRadius: 0.55,
      bloomThreshold: 1,
    });

    gui.addParam("Bloom", postProcessingCmp, "bloom");
    gui.addParam("Bloom intensity", postProcessingCmp, "bloomIntensity", {
      min: 0,
      max: 10,
    });
    gui.addParam("Bloom threshold", postProcessingCmp, "bloomThreshold", {
      min: 0,
      max: 2,
    });
    gui.addParam("Bloom radius", postProcessingCmp, "bloomRadius", {
      min: 0,
      max: 2,
    });
  }

  const cameraEntity = renderer.entity(
    [
      postProcessingCmp,
      cameraCmp,
      renderer.orbiter({
        position: [0, 0, 2.5],
      }),
    ],
    tags
  );
  renderer.add(cameraEntity);

  // gui.addTexture2D('Depth Map', postProcessingCmp._frameDepthTex)
  // gui.addTexture2D('Normal Map', postProcessingCmp._frameNormalTex)
});
// gui.addParam('Exposure', State, 'exposure', { min: 0.01, max: 5 }, () => {
//   renderer.getComponents('Camera').forEach((camera) => {
//     camera.set({ exposure: State.exposure })
//   })
// })

// Meshes
await Promise.allSettled(
  materials.map(async (material) => {
    if (!material) return;
    if (material.baseColorMap)
      material.baseColorMap = await getTexture(
        ctx,
        material.baseColorMap,
        ctx.Encoding.SRGB
      );
    if (material.roughnessMap)
      material.roughnessMap = await getTexture(
        ctx,
        material.roughnessMap,
        ctx.Encoding.Linear
      );
    if (material.metallicMap)
      material.metallicMap = await getTexture(
        ctx,
        material.metallicMap,
        ctx.Encoding.Linear
      );
    if (material.normalMap)
      material.normalMap = await getTexture(
        ctx,
        material.normalMap,
        ctx.Encoding.Linear
      );
    if (material.alphaMap)
      material.alphaMap = await getTexture(
        ctx,
        material.alphaMap,
        ctx.Encoding.Linear
      );
    if (material.emissiveColorMap)
      material.emissiveColorMap = await getTexture(
        ctx,
        material.emissiveColorMap,
        ctx.Encoding.SRGB
      );
    material.castShadows = true;
    material.receiveShadows = true;
  })
);

cells.forEach((cell, cellIndex) => {
  const tags = [`cell${cellIndex}`];
  const material = materials[cellIndex];

  const materialEntity = renderer.entity([renderer.geometry(sphere())], tags);
  if (material) {
    materialEntity.addComponent(renderer.material(material));
  }
  renderer.add(materialEntity);
});

// Sky
(async () => {
  const buffer = await io.loadArrayBuffer(
    getURL(`assets/envmaps/garage/garage.hdr`)
  );
  const hdrImg = parseHdr(buffer);
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true,
  });

  const sun = renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 2,
    castShadows: true,
  });
  const sunEntity = renderer.entity([
    renderer.transform({
      position: [2, 2, 2],
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize([-2, -2, -2])
      ),
    }),
    sun,
  ]);
  renderer.add(sunEntity);
  gui.addTexture2D("ShadowMap", sun._shadowMap);

  const skybox = renderer.skybox({
    sunPosition: State.sunPosition,
    texture: panorama,
  });

  const reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false,
  });

  const skyEntity = renderer.entity([skybox, reflectionProbe]);
  renderer.add(skyEntity);

  gui.addTexture2D("Panorama", panorama);
  gui
    .addTextureCube("Reflection Cubemap", reflectionProbe._dynamicCubemap)
    .setPosition(180, 10);
  gui.addTexture2D("Reflection OctMap", reflectionProbe._octMap);
  gui.addTexture2D("Reflection OctMapAtlas", reflectionProbe._reflectionMap);

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.toggleEnabled();
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  ctx.debug(debugOnce);
  debugOnce = false;
  renderer.draw();

  gui.draw();
});
