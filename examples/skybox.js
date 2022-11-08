import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";
import createContext from "pex-context";
import * as io from "pex-io";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import { sphere } from "primitive-geometry";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";

// Set reflectionProbe entity mapSize
// -> used to create oct map
// -> oct map atlas is derived from it (size * 2, mip/rough levels)

const {
  camera,
  geometry,
  material,
  orbiter,
  skybox,
  reflectionProbe,
  transform,
} = components;

const State = {
  rotation: 1.5 * Math.PI,
  mapSizeIndex: 2,
  mapSizes: [256, 512, 1024, 2048, 4096, 8192],
};

const ctx = createContext();

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx, { scale: 1 });

const cameraEntity = createEntity({
  transform: transform({ position: [0, 0, 3] }),
  camera: camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
  }),
  orbiter: orbiter({
    position: [0, 0, 3],
  }),
});
world.add(cameraEntity);

const geomEntity = createEntity({
  transform: transform({ position: [0, 0, 0] }),
  geometry: geometry(sphere({ radius: 1 })),
  material: material({
    baseColor: [1, 1, 1, 1],
    roughness: 0,
    metallic: 1,
  }),
});
world.add(geomEntity);

const skyboxEntity = createEntity({
  transform: transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation),
  }),
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 1,
  }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  reflectionProbe: reflectionProbe({
    // rgbm: false,
    mapSize: State.mapSizes[State.mapSizeIndex],
  }),
});
world.add(reflectionProbeEntity);

(async () => {
  const buffer = await io.loadArrayBuffer(
    getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
    // getURL(`assets/envmaps/garage/garage.hdr`)
  );
  const hdrImg = parseHdr(buffer);
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true, //TODO: flipY on non dom elements is deprecated
  });

  skyboxEntity.skybox.envMap = panorama;

  reflectionProbeEntity._reflectionProbe.dirty = true;

  gui.addColumn("Settings");
  //TODO: implement component.enabled
  // gui.addParam("Enabled", skyboxEntity.skybox, "enabled", {}, (value) => {
  // skyboxCmp.set({ enabled: value });
  // });
  gui.addParam(
    "Rotation",
    State,
    "rotation",
    { min: 0, max: 2 * Math.PI },
    () => {
      quat.fromAxisAngle(
        skyboxEntity.transform.rotation,
        [0, 1, 0],
        State.rotation
      );
      reflectionProbeEntity.reflectionProbe.dirty = true;
    }
  );
  gui.addParam("BG Blur", skyboxEntity.skybox, "backgroundBlur", {}, () => {});
  gui.addRadioList(
    "Map Size",
    State,
    "mapSizeIndex",
    State.mapSizes.map((name, value) => ({
      name,
      value,
    })),
    () => {
      reflectionProbeEntity.reflectionProbe.mapSize =
        State.mapSizes[State.mapSizeIndex];
      reflectionProbeEntity._reflectionProbe.dirty = true; // TODO: is it needed?
      // TODO: update skybox too?
    }
  );
  gui.addParam("Roughness", geomEntity.material, "roughness", {}, () => {});
  gui.addColumn("Textures");
  gui.addTextureCube(
    "Cubemap",
    reflectionProbeEntity._reflectionProbe._dynamicCubemap,
    { level: 2 }
  );
  gui.addTexture2D(
    "Skybox",
    skyboxEntity.skybox.texture || skyboxEntity.skybox.envMap
  );
  gui.addTexture2D("Octmap", reflectionProbeEntity._reflectionProbe._octMap);
  gui.addTexture2D(
    "Reflection Map",
    reflectionProbeEntity._reflectionProbe._reflectionMap
  );

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  gui.draw();
});
