import createRenderer from "../index.js";
import createContext from "pex-context";
import { cube, torus } from "primitive-geometry";
import { vec3, quat, mat4 } from "pex-math";
import * as io from "pex-io";
import { aabb } from "pex-geom";
import createGUI from "pex-gui";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";

const ctx = createContext();
ctx.gl.getExtension("OES_element_index_uint"); //TEMP

const renderer = createRenderer(ctx);

function aabbToString(bbox) {
  return bbox.map((v) => v.map((f) => Math.floor(f * 1000) / 1000));
}

function targetTo(out, eye, target, up = [0, 1, 0]) {
  let eyex = eye[0];
  let eyey = eye[1];
  let eyez = eye[2];
  let upx = up[0];
  let upy = up[1];
  let upz = up[2];
  let z0 = eyex - target[0];
  let z1 = eyey - target[1];
  let z2 = eyez - target[2];
  let len = z0 * z0 + z1 * z1 + z2 * z2;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
    z0 *= len;
    z1 *= len;
    z2 *= len;
  }
  let x0 = upy * z2 - upz * z1;
  let x1 = upz * z0 - upx * z2;
  let x2 = upx * z1 - upy * z0;
  len = x0 * x0 + x1 * x1 + x2 * x2;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }
  out[0] = x0;
  out[1] = x1;
  out[2] = x2;
  out[3] = 0;
  out[4] = z1 * x2 - z2 * x1;
  out[5] = z2 * x0 - z0 * x2;
  out[6] = z0 * x1 - z1 * x0;
  out[7] = 0;
  out[8] = z0;
  out[9] = z1;
  out[10] = z2;
  out[11] = 0;
  out[12] = eyex;
  out[13] = eyey;
  out[14] = eyez;
  out[15] = 1;
  return out;
}

let debugNextFrame = false;

const gui = createGUI(ctx);
gui.addFPSMeeter();

gui.addButton("Debug", () => {
  debugNextFrame = true;
});

gui.addButton("Tree", () => {
  renderer.entities.forEach((e) => {
    if (!e.transform) {
      return;
    }
    let depth = 0;
    let parent = e.transform.parent;
    while (parent) {
      depth++;
      parent = parent.parent;
    }
    console.log(
      " ".repeat(depth * 5),
      e.id,
      aabbToString(e.transform.worldBounds || "[No world bounds]"),
      e
    );
  });
});

const cameraEntity = renderer.entity({
  transform: renderer.transform({ position: [0, 0, 3] }),
  camera: renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: renderer.orbiter({
    element: ctx.gl.canvas,
  }),
});
renderer.add(cameraEntity);

const cubeEntity = renderer.entity({
  transform: renderer.transform({
    position: [0, 0, 0],
  }),
  geometry: renderer.geometry(cube({ sx: 2, sy: 0.1, sz: 2 })),
  material: renderer.material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 0.2,
  }),
});
renderer.add(cubeEntity);

const torusEntity = renderer.entity({
  transform: renderer.transform({
    position: [0, 0, 0],
  }),
  geometry: renderer.geometry(torus({ radius: 1 })),
  material: renderer.material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.5,
  }),
});
renderer.add(torusEntity);

const skyboxEnt = renderer.entity({
  skybox: renderer.skybox({
    sunPosition: [1, 1, 1],
  }),
});
renderer.add(skyboxEnt);

const reflectionProbeEnt = renderer.entity({
  reflectionProbe: renderer.reflectionProbe(),
});
renderer.add(reflectionProbeEnt);

const directionalLightEntity = renderer.entity(
  {
    transform: renderer.transform({
      position: [2, 2, 2],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      ),
    }),
    directionalLight: renderer.directionalLight({
      color: [1, 1, 1, 2], //FIXME: instencity is copied to alpha in pex-renderer
      intensity: 1,
      castShadows: true,
    }),
    // ambientLight: renderer.ambientLight({
    //   color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    //   intensity: 1,
    //   castShadows: true,
    // }),
    // renderer.lightHelper(), //TODO:
  }
  // ["cell0"]
);
renderer.add(directionalLightEntity);

renderer.addSystem(renderer.geometrySystem());
renderer.addSystem(renderer.transformSystem());
renderer.addSystem(renderer.cameraSystem());
renderer.addSystem(renderer.skyboxSystem());
renderer.addSystem(renderer.reflectionProbeSystem());
renderer.addSystem(renderer.renderSystem());

function rescaleScene(root) {
  const sceneBounds = root.transform.worldBounds;
  const sceneSize = aabb.size(sceneBounds);
  const sceneCenter = aabb.center(sceneBounds);
  const sceneScale =
    2 / (Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2])) || 1);
  if (!aabb.isEmpty(sceneBounds)) {
    root.transform.position = vec3.scale(
      [-sceneCenter[0], -sceneBounds[0][1], -sceneCenter[2]],
      sceneScale
    );
    root.transform.scale = [sceneScale, sceneScale, sceneScale];
    root.transform.dirty = true;
  }
}

async function loadScene() {
  try {
    const scene = await renderer.loadScene(
      // "examples/assets/models/buster_drone/scene.gltf" //ok
      // "examples/assets/models/buster-drone-etc1s-draco.glb"
      // "examples/assets/models/duck/glTF/Duck.gltf" //ok
      // "examples/assets/models/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf" //ok
      "examples/assets/models/DamagedHelmet/glTF/DamagedHelmet.gltf" //ok
    ); //ok
    const sceneEntities = scene[0].entities;
    //scene[0].entities.forEach((entity) => renderer.add(entity));
    window.renderer = renderer;
    renderer.entities.push(...sceneEntities);
    renderer.entities.forEach((e) => {
      if (e.material) {
        // e.material.unlit = false;
        e.material.depthTest = true;
        e.material.depthWrite = true;
        e.material.needsPipelineUpdate = true;
      }
    });
    console.log("updating systems");
    renderer.update(); //force scene hierarchy update
    rescaleScene(sceneEntities[0]); //TODO: race condition: sometime scene bounding box is not yet updated and null

    console.log("entities", renderer.entities);
  } catch (e) {
    console.error(e);
  }
}

loadScene();

(async () => {
  // const buffer = await io.loadArrayBuffer(
  //   getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
  // );
  const buffer = await io.loadArrayBuffer(
    `examples/assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`
  );
  const hdrImg = parseHdr(buffer);
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear,
    flipY: true, //TODO: flipY on non dom elements is deprecated
  });

  skyboxEnt._skybox.texture = panorama;
  skyboxEnt._skybox.dirty = true; //TODO: check if this works

  renderer.draw(); //force update reflection probe
  console.log("reflectionProbeEnt", reflectionProbeEnt);
  reflectionProbeEnt._reflectionProbe.dirty = true;

  gui.addHeader("Settings");
  gui.addParam("BG Blur", skyboxEnt.skybox, "backgroundBlur", {}, () => {});
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
  const now = Date.now() * 0.0005;
  if (debugNextFrame) {
    debugNextFrame = false;
    ctx.gl.getError();
    ctx.debug(true);
  }

  skyboxEnt.skybox.sunPosition = [1 * Math.cos(now), 1, 1 * Math.sin(now)];
  quat.fromAxisAngle(
    torusEntity.transform.rotation,
    [0, 1, 0],
    Date.now() / 1000
  );
  torusEntity.transform.dirty = true; //UGH

  try {
    renderer.draw();
  } catch (e) {
    console.error(e);
  }

  gui.draw();

  ctx.debug(false);

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
