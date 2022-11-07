import createRenderer from "../index.js";
import createContext from "pex-context";
import * as io from "pex-io";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import { sphere } from "primitive-geometry";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";

const State = {
  rotation: 1.5 * Math.PI,
};

const ctx = createContext();
const renderer = createRenderer(ctx);

renderer.addSystem(renderer.geometrySystem());
renderer.addSystem(renderer.transformSystem());
renderer.addSystem(renderer.cameraSystem());
renderer.addSystem(renderer.skyboxSystem());
renderer.addSystem(renderer.reflectionProbeSystem());
renderer.addSystem(renderer.renderSystem());

window.renderer = renderer; //FIXME: temp
const gui = createGUI(ctx);

const cameraEnt = renderer.entity({
  transform: renderer.transform({ position: [0, 0, 3] }),
  camera: renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
  }),
  orbiter: renderer.orbiter({
    position: [0, 0, 3],
  }),
});
renderer.add(cameraEnt);

const lightEnt = renderer.entity({
  ambientLight: renderer.ambientLight({ color: [1, 1, 1, 1] }),
});
renderer.add(lightEnt);

const geomEnt = renderer.entity({
  transform: renderer.transform({ position: [0, 0, 0] }),
  geometry: renderer.geometry(sphere({ radius: 1 })),
  material: renderer.material({
    baseColor: [1, 1, 1, 1],
    roughness: 0,
    metallic: 1,
  }),
});
renderer.add(geomEnt);

const skyboxEnt = renderer.entity({
  transform: renderer.transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation),
  }),
  skybox: renderer.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 0,
  }),
});
renderer.add(skyboxEnt);

const reflectionProbeEnt = renderer.entity({
  reflectionProbe: renderer.reflectionProbe(),
});
renderer.add(reflectionProbeEnt);

(async () => {
  const buffer = await io.loadArrayBuffer(
    getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
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

  skyboxEnt._skybox.texture = panorama;
  skyboxEnt._skybox.dirty = true; //TODO: check if this works

  renderer.draw(); //force update reflection probe
  console.log("reflectionProbeEnt", reflectionProbeEnt);
  reflectionProbeEnt._reflectionProbe.dirty = true;

  gui.addHeader("Settings");
  //TODO: implement component.enabled
  // gui.addParam("Enabled", skyboxEnt.skybox, "enabled", {}, (value) => {
  // skyboxCmp.set({ enabled: value });
  // });
  gui.addParam(
    "Rotation",
    State,
    "rotation",
    { min: 0, max: 2 * Math.PI },
    () => {
      quat.fromAxisAngle(
        skyboxEnt.transform.rotation,
        [0, 1, 0],
        State.rotation
      );
      reflectionProbeEnt.reflectionProbe.dirty = true;
    }
  );
  gui.addParam("BG Blur", skyboxEnt.skybox, "backgroundBlur", {}, () => {});
  gui.addParam(
    "Exposure",
    cameraEnt.camera,
    "exposure",
    { min: 0, max: 2 },
    () => {}
  );
  gui.addParam("Roughness", geomEnt.material, "roughness", {}, () => {});
  gui.addTexture2D(
    "Skybox",
    skyboxEnt.skybox.texture || skyboxEnt._skybox._skyTexture
  );
  gui.addTexture2D(
    "Reflection Probe",
    reflectionProbeEnt._reflectionProbe._reflectionMap
  );

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

ctx.frame(() => {
  renderer.draw();
  gui.draw();
});
