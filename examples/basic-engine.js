import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "../index.js";
import createContext from "pex-context";
import { cube, torus, sphere } from "primitive-geometry";
import { vec3, quat, mat4 } from "pex-math";
import * as io from "pex-io";
import createGUI from "pex-gui";
import parseHdr from "parse-hdr";

const {
  camera,
  directionalLight,
  pointLight,
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

window.addEventListener("resize", () => {
  ctx.set({
    pixelRatio: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  cameraEntity.camera.aspect = window.innerWidth / window.innerHeight;
  cameraEntity.camera.dirty = true;
});

const world = createWorld();

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

const opts = {
  pointLightPosition: [0, 0.2, 0],
};

gui.addParam(
  "Point light pos",
  opts,
  "pointLightPosition",
  {
    min: -5,
    max: 5,
  },
  (pos) => {
    pointLightEntity.transform = {
      position: pos,
    };
  }
);

const cameraEntity = createEntity({
  transform: transform({ position: [0, 0, 1] }),
  camera: camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
    position: [0, 1, 2],
  }),
});
world.add(cameraEntity);

const cubeEntity = createEntity({
  transform: transform({
    position: [0, -1, 0],
  }),
  geometry: geometry(cube({ sx: 5, sy: 0.2, sz: 5, nx: 10, ny: 1, nz: 10 })),
  material: material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 0.2,
    // castShadows: true,
    receiveShadows: true,
  }),
});
// world.add(cubeEntity);

const walls = [
  { position: [0, -2.5, 0], size: [5, 0.1, 5] },
  { position: [0, 2.5, 0], size: [5, 0.1, 5] },
  { position: [2.5, 0, 0], size: [0.1, 5, 5] },
  { position: [-2.5, 0, 0], size: [0.1, 5, 5] },
  { position: [0, 0, 2.5], size: [5, 5, 0.1] },
  { position: [0, 0, -2.5], size: [5, 5, 0.1] },
].forEach((wall) => {
  const cubeEntity = createEntity({
    transform: transform({
      position: wall.position,
    }),
    geometry: geometry(
      cube({ sx: wall.size[0], sy: wall.size[1], sz: wall.size[2] })
    ),
    material: material({
      baseColor: [0, 1, 0, 1],
      metallic: 0,
      roughness: 0.9,
      // castShadows: true,
      receiveShadows: true,
    }),
  });
  // world.add(cubeEntity);
});

const torusEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(torus({ radius: 1, minorRadius: 0.2 })),
  material: material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.15,
    castShadows: true,
    receiveShadows: true,
  }),
});
// world.add(torusEntity);

for (let i = 0; i < 10; i++) {
  const torusEntity = createEntity({
    transform: transform({
      position: [0, 1, 0],
      rotation: quat.fromAxisAngle(
        quat.create(),
        [0, 1, 0],
        (i / 10) * Math.PI
      ),
    }),
    geometry: geometry(torus({ radius: 1, minorRadius: 0.02 })),
    material: material({
      baseColor: [0, 0, 1, 1],
      metallic: 0,
      roughness: 0.15,
      castShadows: true,
      receiveShadows: true,
    }),
  });
  world.add(torusEntity);
}

const skyboxEnt = createEntity({
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true,
  }),
});
world.add(skyboxEnt);

const reflectionProbeEnt = createEntity({
  reflectionProbe: reflectionProbe(),
});
world.add(reflectionProbeEnt);

const directionalLightEntity = createEntity({
  transform: transform({
    position: [2, 2, 2],
    rotation: quat.fromMat4(
      quat.create(),
      targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
    ),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
  }),
});
// world.add(directionalLightEntity);

const pointLightEntity = createEntity({
  geometry: sphere({ radius: 1 }),
  material: {
    metallic: 0,
    roughness: 0,
    baseColor: [1, 1, 1, 1],
    depthTest: true,
    depthWrite: true,
  },
  transform: transform({
    position: [0, 0.5, 0],
  }),
  pointLight: pointLight({
    color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
  }),
});
world.add(pointLightEntity);

async function loadScene() {
  console.log("loadScene loaders.gltf");
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
    console.log("loadScene Scene", scene);
    const sceneEntities = scene[0].entities;
    const root = sceneEntities[0];
    if (!root.transform.scale) {
      root.transform.scale = [1, 1, 1];
    }
    vec3.scale(root.transform.scale, 0.005);
    vec3.add(root.transform.position, [0, 0.55, 0]);

    world.entities.push(...sceneEntities);
    sceneEntities.forEach((e) => {
      if (e.material) {
        e.material.depthTest = true;
        e.material.depthWrite = true;
        e.material.needsPipelineUpdate = true;
      }
    });
  } catch (e) {
    console.error(e);
  }
}

// loadScene();

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

  skyboxEnt.skybox.envMap = panorama; //TODO: remove _skybox

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

let prevTime = Date.now();
const renderEngine = createRenderEngine({ ctx });

let pointLightShadowmapPreview;

let reflectionProbeTexturePreview = null;

ctx.frame(() => {
  const now = Date.now();
  const deltaTime = (now - prevTime) / 1000;
  prevTime = now;

  const cameraEntity = world.entities.find((e) => e.camera);

  renderEngine.update(world.entities, deltaTime);
  renderEngine.render(world.entities, cameraEntity);

  // const time = Date.now() / 500;
  // pointLightEntity.transform.position = [
  //   Math.sin(time) * Math.cos(time),
  //   -0.3 * Math.sin(time / 2),
  //   1.5 * Math.cos(time),
  // ];
  // pointLightEntity.transform.dirty = true;

  if (
    !reflectionProbeTexturePreview &&
    reflectionProbeEnt._reflectionProbe._reflectionMap
  ) {
    reflectionProbeTexturePreview = gui.addTexture2D(
      "ReflectionMap",
      reflectionProbeEnt._reflectionProbe._reflectionMap
    );
  }

  if (!pointLightShadowmapPreview) {
    pointLightShadowmapPreview = gui.addTextureCube(
      "PointLightShadowmap",
      pointLightEntity.pointLight._shadowCubemap
    );
  }

  gui.draw();
});
