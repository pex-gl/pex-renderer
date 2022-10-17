import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
  entity,
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

gui.addButton("Set camera pos/target", () => {
  cameraEntity.transform.position = [3, 1, 1];
  cameraEntity.orbiter.target = [2, 0, 0];
});

gui.addButton("Set camera pos/dir", () => {
  cameraEntity.transform.position = [3, 1, 1];
  quat.targetTo(
    cameraEntity.transform.rotation,
    [3, 1, 1],
    [0, 1, 1],
    [0, 1, 0]
  );
});

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
  transform: transform({
    position: [1, 1, 5],
    rotation: quat.create(),
  }),
  camera: camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity);

gui.addParam(
  "Camera pos",
  cameraEntity.transform,
  "position",
  {
    min: -5,
    max: 5,
  },
  (pos) => {
    console.log("set camera pos", pos);
  }
);

const quatTargetToOld = (q, position, target) => {
  return quat.fromTo(
    q,
    [0, 0, -1],
    vec3.normalize(vec3.sub([...target], position))
  );
};

const mat4TargetTo = (out, eye, target, up = [0, 1, 0]) => {
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
};

const mat4tmp = mat4.create();
const upTmp = [0, 1, 0];
const quatTargetTo = function (q, eye, target) {
  return quat.fromMat4(q, mat4TargetTo(mat4tmp, eye, target, upTmp));
};

quatTargetTo(
  cameraEntity.transform.rotation,
  cameraEntity.transform.position,
  [0, 0, 0]
);
// quat.fromAxisAngle(cameraEntity.transform.rotation, [1, 0, 0], 0.62);
// quat.fromTo(cameraEntity.transform.rotation, [0, 1, -1], [0, 0, -1]);
cameraEntity.transform = {
  ...cameraEntity.transform,
};

// console.log("rotation", cameraEntity._transform.modelMatrix);

const floorEntity = createEntity({
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
world.add(floorEntity);

const cameraTargetEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(sphere({ radius: 0.2 })),
  material: material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.2,
    // castShadows: true,
    receiveShadows: true,
  }),
});
world.add(cameraTargetEntity);

const orbiterTargetEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(sphere({ radius: 0.2 })),
  material: material({
    baseColor: [1, 0.5, 0, 1],
    metallic: 0,
    roughness: 0.2,
    // castShadows: true,
    receiveShadows: true,
  }),
});
world.add(orbiterTargetEntity);

const redCubeEntity = createEntity({
  transform: transform({
    position: [2, 0, 0],
  }),
  geometry: geometry(cube({ sx: 0.4 })),
  material: material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.2,
    receiveShadows: true,
  }),
});
world.add(redCubeEntity);

const greenCubeEntity = createEntity({
  transform: transform({
    position: [0, 2, 0],
  }),
  geometry: geometry(cube({ sx: 0.4 })),
  material: material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 0.2,
    receiveShadows: true,
  }),
});
world.add(greenCubeEntity);

const blueCubeEntity = createEntity({
  transform: transform({
    position: [0, 0, 2],
  }),
  geometry: geometry(cube({ sx: 0.4 })),
  material: material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.2,
    receiveShadows: true,
  }),
});
world.add(blueCubeEntity);

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

  const pos = [0, 0, -cameraEntity.orbiter._orbiter.distance];
  vec3.multMat4(pos, cameraEntity.camera.invViewMatrix);
  cameraTargetEntity.transform.position = pos;
  cameraTargetEntity.transform.dirty = true;

  orbiterTargetEntity.transform.position = vec3.add(
    [...cameraEntity.orbiter.target],
    [0, 0.2, 0]
  );
  orbiterTargetEntity.transform.dirty = true;

  if (!cameraEntity.camera.logged) {
    cameraEntity.camera.logged = true;
    console.log(
      "rotation",
      cameraEntity.camera.viewMatrix,
      mat4.lookAt(
        mat4.create(),
        cameraEntity.transform.position,
        [0, 1, 0],
        [0, 0, 0]
      )
    );
  }

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
