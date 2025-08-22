import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { vec3, quat } from "pex-math";
import { aabb } from "pex-geom";
import { loadHdr } from "pex-loaders";
import { plane, sphere } from "primitive-geometry";
import gridCells from "grid-cells";
import { getEnvMap, getTexture, getURL, dragon } from "./utils.js";

const State = {
  furnace: false,
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const gui = createGUI(ctx, { theme: { columnWidth: 360 } });
const nW = 6;

const modelGeometry = dragon;
const bbox = aabb.fromPoints(aabb.create(), modelGeometry.positions);

// Materials
const materials = {};

const getBaseColor = (t = 1) => [0.5, 0.5, 1, 1];
const getAttenuationColor = (t = 1) => [0.5, 0.5 + t * 0.5, 0.5];
const getDiffuseTransmissionColor = (t = 1) => [t * 1, 0.1, 0.1];

const materialDefaults = {
  baseColor: getBaseColor(),
  metallic: 0,
  roughness: 0,
  cullFace: false,
  receiveShadows: false,
};

const materialTransmissionDefaults = {
  transmission: 1,
};
const materialDiffuseTransmissionDefaults = {
  diffuseTransmission: 0.75,
};
const thickness = aabb.size(bbox)[2];
const materialVolumeDefaults = {
  thickness,
  attenuationDistance: thickness / 2,
  // attenuationDistance: 0.1,
};

for (let i = 0; i < nW; i++) {
  const t = i / (nW - 1);
  // materials[`ior`] ||= [];
  // materials[`ior`].push({
  //   ...materialDefaults,
  //   ior: t,
  // });
  // Transmission + Dispersion
  // materials["transmission(1) + dispersion(t)"] ||= [];
  // materials["transmission(1) + dispersion(t)"].push({
  //   ...materialDefaults,
  //   transmission: 1,
  //   dispersion: t,
  // });
  // materials["transmission(t) + dispersion(t)"] ||= [];
  // materials["transmission(t) + dispersion(t)"].push({
  //   ...materialDefaults,
  //   transmission: t,
  //   dispersion: t,
  // });

  // // Transmission
  // materials["transmission(t)"] ||= [];
  // materials["transmission(t)"].push({
  //   ...materialDefaults,
  //   transmission: t,
  // });

  // // Transmission + volume
  // materials["transmission(t) + volume"] ||= [];
  // materials["transmission(t) + volume"].push({
  //   ...materialDefaults,
  //   ...materialVolumeDefaults,
  //   transmission: t,
  // });
  // // materials[`transmission(1) + attenuationDistance(t)`] ||= [];
  // // materials[`transmission(1) + attenuationDistance(t)`].push({
  // //   ...materialDefaults,
  // //   ...materialVolumeDefaults,
  // //   transmission: 1,
  // //   attenuationDistance: t * materialVolumeDefaults.attenuationDistance,
  // // });
  // materials[`transmission(t) + attenuationColor(1)`] ||= [];
  // materials[`transmission(t) + attenuationColor(1)`].push({
  //   ...materialDefaults,
  //   ...materialVolumeDefaults,
  //   transmission: t,
  //   attenuationColor: getAttenuationColor(),
  // });
  // materials[`transmission(1) + attenuationColor(t)`] ||= [];
  // materials[`transmission(1) + attenuationColor(t)`].push({
  //   ...materialDefaults,
  //   ...materialVolumeDefaults,
  //   ...materialTransmissionDefaults,
  //   attenuationColor: getAttenuationColor(t),
  // });

  // Diffuse transmission
  materials["diffuseTransmission(t)"] ||= [];
  materials["diffuseTransmission(t)"].push({
    ...materialDefaults,
    diffuseTransmission: t,
  });
  materials["diffuseTransmissionColor(t)"] ||= [];
  materials["diffuseTransmissionColor(t)"].push({
    ...materialDefaults,
    ...materialDiffuseTransmissionDefaults,
    diffuseTransmissionColor: [t, 0, 0],
  });

  // Diffuse transmission + Volume
  materials["diffuseTransmission(t) + volume"] ||= [];
  materials["diffuseTransmission(t) + volume"].push({
    ...materialDefaults,
    ...materialVolumeDefaults,
    diffuseTransmission: t,
  });
  materials["diffuseTransmissionColor(t) + volume"] ||= [];
  materials["diffuseTransmissionColor(t) + volume"].push({
    ...materialDefaults,
    ...materialVolumeDefaults,
    ...materialDiffuseTransmissionDefaults,
    diffuseTransmissionColor: getDiffuseTransmissionColor(t),
  });
  materials["diffuseTransmissionColor(t) + volume + attenuationColor(1)"] ||=
    [];
  materials["diffuseTransmissionColor(t) + volume + attenuationColor(1)"].push({
    ...materialDefaults,
    ...materialVolumeDefaults,
    ...materialDiffuseTransmissionDefaults,
    diffuseTransmissionColor: getDiffuseTransmissionColor(t),
    attenuationColor: getAttenuationColor(),
  });
  materials["diffuseTransmissionColor(t) + volume + attenuationColor(t)"] ||=
    [];
  materials["diffuseTransmissionColor(t) + volume + attenuationColor(t)"].push({
    ...materialDefaults,
    ...materialVolumeDefaults,
    ...materialDiffuseTransmissionDefaults,
    diffuseTransmissionColor: getDiffuseTransmissionColor(t),
    attenuationColor: getAttenuationColor(t),
  });
  materials["transmission(t) + diffuseTransmission(t)/Color(1)"] ||= [];
  materials["transmission(t) + diffuseTransmission(t)/Color(1)"].push({
    ...materialDefaults,
    transmission: t,
    diffuseTransmission: t,
    diffuseTransmissionColor: getDiffuseTransmissionColor(1),
  });
}
const brdfNames = Object.keys(materials);
const brdfMaterials = Object.values(materials).flat();
const nH = brdfNames.length;

// Entities
const checkerEntity = createEntity({
  transform: components.transform({ position: [0, 0, -1] }),
  geometry: components.geometry(plane({ sx: 4, direction: "z" })),
  material: components.material({
    roughness: 0,
    metallic: 0,
    baseColorTexture: await getTexture(
      ctx,
      getURL(`assets/textures/checkerboard/checkerboard.png`),
      ctx.Encoding.SRGB,
    ),
  }),
});
world.add(checkerEntity);

const geometry = {
  positions: { buffer: ctx.vertexBuffer(modelGeometry.positions) },
  normals: { buffer: ctx.vertexBuffer(modelGeometry.normals) },
  // uvs: { buffer: ctx.vertexBuffer(modelGeometry.uvs) },
  cells: { buffer: ctx.indexBuffer(modelGeometry.cells) },
};

for (let i = 0; i < nW * nH; i++) {
  const layer = `cell${i}`;
  const cameraEntity = createEntity({
    layer,
    transform: components.transform({
      position: [0, 0, 1],
    }),
    camera: components.camera({
      fov: Math.PI / 4,
      near: 0.001,
      toneMap: "neutral",
    }),
    orbiter: components.orbiter({ element: ctx.gl.canvas }),
  });
  world.add(cameraEntity);

  const material = brdfMaterials[i];
  if (!material) continue;

  const materialEntity = createEntity({
    layer,
    transform: components.transform(),
    geometry: components.geometry(geometry),
    material: components.material(material),
  });
  world.add(materialEntity);
}

const ENV_MAP_PATH =
  location.hostname === "localhost"
    ? "examples/glTF-Sample-Environments"
    : "https://github.com/KhronosGroup/glTF-Sample-Environments/raw/main";

const envMap = await loadHdr(ctx, `${ENV_MAP_PATH}/neutral.hdr`);
const furnaceEnvMap = await getEnvMap(
  ctx,
  "assets/envmaps/furnace/furnace-4k.hdr",
);

const skyEntity = createEntity({
  skybox: components.skybox({
    envMap: State.furnace ? furnaceEnvMap : envMap,
    // backgroundBlur: 1,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const sunEntity = createEntity({
  transform: components.transform({
    position: [2, 2, 2],
    rotation: quat.fromDirection(quat.create(), vec3.normalize([-2, -2, -2])),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 1,
    castShadows: false,
  }),
});
world.add(sunEntity);

// GUI
gui.addColumn("");
gui.addFPSMeeter().setPosition(10, 40);
gui.addColumn("Resources");
gui.addParam("Furnace", State, "furnace", {}, () => {
  skyEntity.skybox.envMap = State.furnace ? furnaceEnvMap : envMap;
  skyEntity.reflectionProbe.dirty = true;
});

// Events
let debugOnce = false;

const headers = brdfNames.map((headerTitle) => gui.addHeader(headerTitle));

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });

  const W = width * pixelRatio;
  const H = height * pixelRatio;

  headers.forEach((header, i) => {
    header.setPosition(10, 10 + (i * H) / nH / pixelRatio);
  });

  const cells = gridCells(W, H, nW, nH, 0).map((cell) => [
    cell[0],
    H - cell[1] - cell[3],
    cell[2],
    cell[3],
  ]);

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

  window.dispatchEvent(new CustomEvent("screenshot"));
});
