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
import parseObj from "geom-parse-obj";
import { getURL } from "./utils.js";

// Set reflectionProbe entity size
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
  sizeIndex: 4,
  sizes: [256, 512, 1024, 2048, 4096],
};

const ctx = createContext({ pixelRatio: devicePixelRatio });

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx, { scale: 2 });
let reflectionMapPreview;

const cameraEntity = createEntity({
  transform: transform({ position: [0, 0, 22] }),
  camera: camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
  }),
  orbiter: orbiter({
    position: [0, 0, 2],
  }),
});
world.add(cameraEntity);

const clothGeom = parseObj(
  await io.loadText(getURL(`assets/models/PbdCloth/PbdCloth.obj`))
);

const geomEntity = createEntity({
  transform: transform({ position: [0, 0, 0] }),
  geometry: geometry(sphere({ radius: 1 })),
  // geometry: geometry(clothGeom),
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
    size: State.sizes[State.sizeIndex],
  }),
});
world.add(reflectionProbeEntity);
window.reflectionProbeEntity = reflectionProbeEntity;

(async () => {
  const buffer = await io.loadArrayBuffer(
    // getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
    getURL(`assets/envmaps/brown_photostudio_02_8k.hdr`)
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
    "sizeIndex",
    State.sizes.map((name, value) => ({
      name,
      value,
    })),
    () => {
      reflectionProbeEntity.reflectionProbe.size = State.sizes[State.sizeIndex];
      // reflectionProbeEntity._reflectionProbe.dirty = true; // TODO: is it needed?
      reflectionProbeEntity.reflectionProbe = components.reflectionProbe({
        size: State.sizes[State.sizeIndex],
      });
      reflectionProbeEntity._reflectionProbe = null;
      console.log(reflectionMapPreview);
      if (reflectionMapPreview) reflectionMapPreview.texture = null;
      // TODO: update skybox too?
    }
  );
  gui.addParam("Roughness", geomEntity.material, "roughness", {}, () => {});
  gui.addColumn("Textures");
  // gui.addTextureCube(
  //   "Cubemap",
  //   reflectionProbeEntity._reflectionProbe._dynamicCubemap,
  //   { level: 2 }
  // );
  // gui.addTexture2D(
  //   "Skybox",
  //   skyboxEntity.skybox.texture || skyboxEntity.skybox.envMap
  // );

  reflectionMapPreview = gui.addTexture2D(
    "Reflection Map",
    reflectionProbeEntity._reflectionProbe._reflectionMap
  );
  gui.addTexture2D("Octmap", reflectionProbeEntity._reflectionProbe._octMap);

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);
  if (reflectionMapPreview && !reflectionMapPreview?.texture) {
    reflectionMapPreview.texture =
      reflectionProbeEntity._reflectionProbe._reflectionMap;
  }

  gui.draw();
});
