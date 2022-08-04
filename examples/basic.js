import {
  world as createWorld,
  entity as createEntity,
  systems,
  components,
  loaders,
} from "../index.js";
import createContext from "pex-context";
import { cube, torus } from "primitive-geometry";
import { vec3, quat, mat4 } from "pex-math";
import * as io from "pex-io";
import { aabb } from "pex-geom";
import createGUI from "pex-gui";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";

const {
  camera,
  directionalLight,
  geometry,
  material,
  orbiter,
  skybox,
  reflectionProbe,
  transform,
} = components;

const ctx = createContext({
  type: "webgl",
});
ctx.gl.getExtension("OES_element_index_uint"); //TEMP

const world = createWorld();

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
  world.entities.forEach((e) => {
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

const cameraEntity = createEntity({
  transform: transform({ position: [0, 0, 3] }),
  camera: camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity);

const cubeEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(cube({ sx: 2, sy: 0.1, sz: 2 })),
  material: material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 0.2,
  }),
});
world.add(cubeEntity);

const torusEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(torus({ radius: 1 })),
  material: material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.5,
  }),
});
world.add(torusEntity);

const skyboxEnt = createEntity({
  skybox: skybox({
    sunPosition: [1, 1, 1],
  }),
});
world.add(skyboxEnt);

const reflectionProbeEnt = createEntity({
  reflectionProbe: reflectionProbe(),
});
world.add(reflectionProbeEnt);

const directionalLightEntity = createEntity(
  {
    transform: transform({
      position: [2, 2, 2],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      ),
    }),
    directionalLight: directionalLight({
      color: [1, 1, 1, 2], //FIXME: instencity is copied to alpha in pex-renderer
      intensity: 1,
      castShadows: true,
    }),
    // ambientLight: ambientLight({
    //   color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    //   intensity: 1,
    //   castShadows: true,
    // }),
    // lightHelper(), //TODO:
  }
  // ["cell0"]
);
world.add(directionalLightEntity);

world.addSystem(systems.geometry({ ctx }));
world.addSystem(systems.transform());
world.addSystem(systems.camera());
world.addSystem(systems.skybox({ ctx }));
world.addSystem(systems.reflectionProbe({ ctx }));
world.addSystem(systems.renderer({ ctx }));

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
  console.log("loaders.gltf");
  // debugger;
  try {
    const scene = await loaders.gltf(
      "examples/assets/models/buster-drone/buster-drone-etc1s-draco.glb",
      {
        ctx,
        dracoOptions: {
          transcoderPath: new URL(
            "assets/decoders/draco/",
            import.meta.url
          ).toString(),
        },
        basisOptions: {
          transcoderPath: new URL(
            "assets/decoders/basis/",
            import.meta.url
          ).toString(),
        },
      }
    ); //ok
    console.log("Scene", scene);
    const sceneEntities = scene[0].entities;
    //scene[0].entities.forEach((entity) => world.add(entity));
    window.world = world;
    world.entities.push(...sceneEntities);
    sceneEntities.forEach((e) => {
      if (e.material) {
        // e.material.unlit = false;
        e.material.depthTest = true;
        e.material.depthWrite = true;
        e.material.needsPipelineUpdate = true;
      }
    });
    console.log("updating systems");
    world.update(); //force scene hierarchy update
    rescaleScene(sceneEntities[0]); //TODO: race condition: sometime scene bounding box is not yet updated and null

    console.log("entities", entities);
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

  world.update(); //force update reflection probe
  skyboxEnt._skybox.texture = panorama; //TODO: remove _skybox
  skyboxEnt._skybox.dirty = true; //TODO: check if this works

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
    world.update();
  } catch (e) {
    console.error(e);
  }

  gui.draw();

  ctx.debug(false);

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
