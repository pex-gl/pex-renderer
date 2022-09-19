import {
  world as createWorld,
  entity as createEntity,
  renderGraph as createRenderGraph,
  resourceCache as createResourceCache,
  systems,
  components,
  loaders,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { vec3, quat } from "pex-math";
import random from "pex-random";
import * as io from "pex-io";
import { sphere } from "primitive-geometry";
import gridCells from "grid-cells";
import parseHdr from "parse-hdr";
import parseObj from "geom-parse-obj";
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
  type: "webgl",
  pixelRatio: 1.5,
});
ctx.gl.getExtension("EXT_shader_texture_lod");
ctx.gl.getExtension("OES_standard_derivatives");
ctx.gl.getExtension("WEBGL_draw_buffers");
ctx.gl.getExtension("OES_texture_float");
ctx.gl.getExtension("EXT_texture_filter_anisotropic");

const world = (window.world = createWorld());
const renderGraph = createRenderGraph(ctx);
const resourceCache = createResourceCache(ctx);

const gui = createGUI(ctx, {
  responsive: false,
});
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
  {}, //default material
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
    baseColor: [1, 1, 1, 1],
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
    depthWrite: false,
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

function countByProp(list, prop) {
  return list.reduce((countBy, o) => {
    if (!countBy[o[prop]]) countBy[o[prop]] = 0;
    countBy[o[prop]]++;
    return countBy;
  }, {});
}

gui.addFPSMeeter().setPosition(10, 10);
gui.addButton("Resources", () => {
  const countByClass = countByProp(ctx.resources, "class");
  const textures = ctx.resources.filter((o) => o.class == "texture");
  const countByPixelFormat = countByProp(textures, "pixelFormat");
  console.log(
    "Resources",
    countByClass,
    countByPixelFormat,
    ctx.resources,
    resourceCache
  );
});

function resize() {
  ctx.set({
    pixelRatio: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const W = window.innerWidth * 1.5;
  const H = window.innerHeight * 1.5;

  let cells = gridCells(W, H, nW, nH, 0).map(
    (
      cell // flip upside down as we are using viewport coordinates
    ) => [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
  );

  world.entities
    .filter((e) => e.camera)
    .forEach((cameraEntity, i) => {
      cameraEntity.camera.viewport = cells[i];
      cameraEntity.camera.aspect = cells[i][2] / cells[i][3];
      cameraEntity.camera.dirty = true;
    });
}

window.addEventListener("resize", resize);
resize();

cells.forEach((cell, cellIndex) => {
  const layer = `cell${cellIndex}`;
  const material = materials[cellIndex];
  if (!material) return;
  const cameraCmp = components.camera({
    fov: Math.PI / 3,
    aspect: W / nW / (H / nH),
    viewport: cell,
    exposure: State.exposure,
  });
  // const postProcessingCmp = renderer.postProcessing({
  //   fxaa: true,
  // });

  if (material.emissiveColor) {
    // postProcessingCmp.set({
    //   bloom: true,
    //   bloomIntensity: 0.5,
    //   bloomThreshold: 3,
    //   bloomRadius: 1.25,
    // });
  }

  const cameraEntity = createEntity({
    camera: cameraCmp,
    transform: components.transform({
      positions: [0, 0, 1.2],
    }),
    orbiter: components.orbiter({
      position: [0, 0, 2.5],
      // distance: 2, //FIXME: this is needed?
      element: ctx.gl.canvas,
    }),
    layer: layer,
  });
  world.add(cameraEntity);
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
    material.castShadows = false;
    material.receiveShadows = false;
  })
);

let sphereGeom = sphere({ nx: 32, ny: 32 });

const sphereMesh = {
  positions: { buffer: ctx.vertexBuffer(sphereGeom.positions) },
  normals: { buffer: ctx.vertexBuffer(sphereGeom.normals) },
  uvs: { buffer: ctx.vertexBuffer(sphereGeom.uvs) },
  cells: { buffer: ctx.indexBuffer(sphereGeom.cells) },
};

cells.forEach((cell, cellIndex) => {
  const layer = `cell${cellIndex}`;
  const material = materials[cellIndex];
  if (!material) return;

  const materialEntity = createEntity({
    transform: components.transform(),
    geometry: components.geometry(sphereMesh),
    material: components.material(material),
    layer: layer,
  });
  world.add(materialEntity);
});

// Sky
(async () => {
  const buffer = await io.loadArrayBuffer(
    getURL("assets/envmaps/garage/garage.hdr")
  );
  //const buffer = await io.loadArrayBuffer(getURL(`assets/envmaps/garage.hdr`))
  // const buffer = await io.loadArrayBuffer(getURL(`assets/envmaps/Mono_Lake_B.hdr`))
  const hdrImg = parseHdr(buffer);
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true,
  });

  const sun = components.directionalLight({
    color: [1, 1, 1, 2],
    intensity: 1,
    castShadows: false,
  });
  const sunEntity = createEntity({
    transform: components.transform({
      position: [-2, 2, 2],
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize([-2, -2, -1])
      ),
    }),
    directionalLight: sun,
  });
  world.add(sunEntity);

  const skybox = components.skybox({
    sunPosition: State.sunPosition,
    envMap: panorama,
  });

  const reflectionProbe = components.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false,
  });

  const skyEntity = createEntity({
    skybox: skybox,
    reflectionProbe: reflectionProbe,
  });
  world.add(skyEntity);
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.toggleEnabled();
  if (key === "d") debugOnce = true;
});

const geometrySys = systems.geometry({ ctx });
const transformSys = systems.transform();
const cameraSys = systems.camera();
const skyboxSys = systems.skybox({ ctx });
const reflectionProbeSys = systems.reflectionProbe({ ctx });
const renderPipelineSys = systems.renderPipeline({
  ctx,
  resourceCache,
  renderGraph,
  outputEncoding: ctx.Encoding.Linear,
});

//const standardRendererSys = systems.renderer.standard({
const standardRendererSys = systems.renderer.standard({
  ctx,
  resourceCache,
  renderGraph,
});
const basicRendererSys = systems.renderer.basic({
  ctx,
  resourceCache,
  renderGraph,
});
const skyboxRendererSys = systems.renderer.skybox({ ctx });

ctx.frame(() => {
  ctx.debug(debugOnce);
  debugOnce = false;

  geometrySys.update(world.entities);
  transformSys.update(world.entities);
  skyboxSys.update(world.entities);
  reflectionProbeSys.update(world.entities, {
    renderers: [skyboxRendererSys],
  });
  cameraSys.update(world.entities);

  world.entities
    .filter((e) => e.camera)
    .forEach((cameraEntity) => {
      resourceCache.beginFrame();
      renderGraph.beginFrame();

      const viewEntities = world.entities.filter(
        (e) => e.layer == cameraEntity.layer || !e.layer
      );
      const renderView = {
        camera: cameraEntity.camera,
        cameraEntity: cameraEntity,
        viewport: cameraEntity.camera.viewport,
      };
      renderPipelineSys.update(viewEntities, {
        renderers: [standardRendererSys, skyboxRendererSys],
        // renderers: [basicRendererSys, skyboxRendererSys],
        renderView: renderView,
      });
      renderGraph.endFrame();
      resourceCache.endFrame();
    });

  // Hide skybox after first frame
  // const skyboxEntity = world.entities.find((e) => e.skybox);
  // if (skyboxEntity) {
  //TODO: who will dispose removed skybox?
  // skyboxEntity.skybox = null;
  // }

  gui.draw();
});
