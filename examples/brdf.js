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
  exposure: 0.8,
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
  pauseOnBlur: false,
  rgbm: State.rgbm,
  shadowQuality: 2,
});

const gui = createGUI(ctx);
const W = ctx.gl.drawingBufferWidth;
const H = ctx.gl.drawingBufferHeight;
const nW = 11;
const nH = 6;
let debugOnce = false;

// Materials
let materials = [];

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.9, 0.9, 1.0, 1.0],
    metallic: i / 10,
    roughness: 0,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.0, 0.0, 1.0, 1.0],
    metallic: 0,
    roughness: i / 10,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [1.0, 0.8, 0.0, 1.0],
    metallic: 1,
    roughness: i / 10,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.8, 0.0, 0.1, 1.0],
    metallic: 0,
    roughness: 0,
    reflectance: i / 10,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.8, 0.0, 0.1, 1.0],
    metallic: 1,
    roughness: 0.5,
    clearCoat: i / 10,
    clearCoatRoughness: 0,
  });
}

for (let i = 0; i <= 10; i++) {
  materials.push({
    baseColor: [0.8, 0.0, 0.1, 1.0],
    metallic: 1,
    roughness: 0.5,
    clearCoat: 1,
    clearCoatRoughness: i / 10,
  });
}

// Utils
let cells = gridCells(W, H, nW, nH, 0).map(
  (
    cell // flip upside down as we are using viewport coordinates
  ) => [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
);

gui
  .addHeader("Metallic")
  .setPosition(10, 10 + (ctx.gl.drawingBufferHeight * 0) / 6);
gui
  .addHeader("Roughness for non-metallic")
  .setPosition(10, 10 + (ctx.gl.drawingBufferHeight * 1) / 6);
gui
  .addHeader("Roughness for metallic")
  .setPosition(10, 10 + (ctx.gl.drawingBufferHeight * 2) / 6);
gui
  .addHeader("Reflectance")
  .setPosition(10, 10 + (ctx.gl.drawingBufferHeight * 3) / 6);
gui
  .addHeader("Clear Coat")
  .setPosition(10, 10 + (ctx.gl.drawingBufferHeight * 4) / 6);
gui
  .addHeader("Clear Coat Roughness")
  .setPosition(10, 10 + (ctx.gl.drawingBufferHeight * 5) / 6);

cells.forEach((cell, cellIndex) => {
  const tags = [`cell${cellIndex}`];
  const material = materials[cellIndex];
  if (!material) return;
  const cameraCmp = renderer.camera({
    fov: Math.PI / 3,
    aspect: W / nW / (H / nH),
    viewport: cell,
    exposure: State.exposure,
  });
  const postProcessingCmp = renderer.postProcessing({
    fxaa: true,
  });

  if (material.emissiveColor) {
    postProcessingCmp.set({
      bloom: true,
      bloomIntensity: 0.5,
      bloomThreshold: 3,
      bloomRadius: 1.25,
    });
  }

  const cameraEntity = renderer.entity(
    [
      postProcessingCmp,
      cameraCmp,
      renderer.orbiter({
        position: [0, 0, 1.2],
      }),
    ],
    tags
  );
  renderer.add(cameraEntity);
});

// Meshes
await Promise.allSettled(
  materials.map(async (material) => {
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
  if (!material) return;

  const materialEntity = renderer.entity(
    [renderer.geometry(sphere()), renderer.material(material)],
    tags
  );
  renderer.add(materialEntity);
});

// Sky
(async () => {
  const buffer = await io.loadArrayBuffer(
    getURL("assets/envmaps/Ditch-River_2k/Ditch-River_2k.hdr")
  );
  //const buffer = await io.loadArrayBuffer(getURL(`assets/envmaps/garage.hdr`))
  // const buffer = await io.loadArrayBuffer(getURL(`assets/envmaps/Mono_Lake_B.hdr`))
  const hdrImg = parseHdr(buffer);
  for (let i = 0; i < hdrImg.data.length; i += 4) {
    hdrImg.data[i + 0] *= 0.8;
    hdrImg.data[i + 1] *= 0.8;
    hdrImg.data[i + 2] *= 0.5;
  }
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
      position: [-2, 2, 2],
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize([2, -2, -1])
      ),
    }),
    sun,
  ]);
  renderer.add(sunEntity);

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

  const skybox = renderer.getComponents("Skybox")[0];
  if (skybox) {
    skybox.entity.removeComponent(skybox);
  }

  gui.draw();
});
