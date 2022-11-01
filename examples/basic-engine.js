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
import { vec3, quat, mat4, utils } from "pex-math";
import * as io from "pex-io";
import createGUI from "pex-gui";
import parseHdr from "parse-hdr";

const { EPSILON } = utils;

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

const ctx = createContext({});
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

let debugNextFrame = false;

const gui = createGUI(ctx);
gui.addColumn("Settings");
gui.addFPSMeeter();

gui.addButton("Set camera pos/target", () => {
  vec3.set(cameraEntity.transform.position, [3, 1, 1]);
  vec3.set(cameraEntity.orbiter.target, [2, 0, 0]);
});

gui.addButton("Set camera pos/dir", () => {
  vec3.set(cameraEntity.transform.position, [3, 1, 1]);
  quat.targetTo(
    cameraEntity.transform.rotation,
    [3, 1, 1],
    [0, 1, 2],
    [0, 1, 0]
  );
});

const opts = {
  pointLightPosition: [0, 0.2, 0],
  directionalLightPosition: [2, 2, 2],
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

gui.addParam(
  "Directional light pos",
  opts,
  "directionalLightPosition",
  {
    min: -3,
    max: 3,
  },
  (pos) => {
    vec3.set(directionalLightEntity.transform.position, pos);
    quatFromPointToPointFacingZPos(
      directionalLightEntity.transform.rotation,
      pos,
      [0, 0, 0],
      [0, 1, 0]
    );
    directionalLightEntity.transform.dirty = true;
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

gui.addParam("Camera pos", cameraEntity.transform, "position", {
  min: -5,
  max: 5,
});

gui.addParam("Orbiter Distance", cameraEntity.orbiter, "distance", {
  min: 0.5,
  max: 10,
});

gui.addParam("Orbiter Lon", cameraEntity.orbiter, "lon", {
  min: -360,
  max: 360,
});

gui.addParam("Prboter Lat", cameraEntity.orbiter, "lat", {
  min: -89.5,
  max: 89.5,
});

const tempVec1 = vec3.create();
const tempVec2 = vec3.create();

const tempMat41 = mat4.create();

function quatFromPointToPointFacingZPos(q, eye, target, up) {
  let forwardX = target[0] - eye[0];
  let forwardY = target[1] - eye[1];
  let forwardZ = target[2] - eye[2];

  let upX = up[0];
  let upY = up[1];
  let upZ = up[2];

  let len = forwardX * forwardX + forwardY * forwardY + forwardZ * forwardZ;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
    forwardX *= len;
    forwardY *= len;
    forwardZ *= len;
  }

  let rightX = upY * forwardZ - upZ * forwardY;
  let rightY = upZ * forwardX - upX * forwardZ;
  let rightZ = upX * forwardY - upY * forwardX;

  const m = tempMat41;
  m[0] = rightX;
  m[1] = rightY;
  m[2] = rightZ;
  m[3] = 0.0;
  m[4] = upX;
  m[5] = upY;
  m[6] = upZ;
  m[7] = 0.0;
  m[8] = forwardX;
  m[9] = forwardY;
  m[10] = forwardZ;
  m[11] = 0.0;
  m[12] = 0.0;
  m[13] = 0.0;
  m[14] = 0.0;
  m[15] = 1.0;
  return quat.fromMat4(q, m);
}

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
    castShadows: true,
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
    castShadows: true,
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
    castShadows: true,
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
      baseColor: [1, 1, 1, 1],
      metallic: 1,
      roughness: 0.15,
      castShadows: true,
      receiveShadows: true,
    }),
    boundingBoxHelper: components.boundingBoxHelper(),
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
    rotation: quatFromPointToPointFacingZPos(
      quat.create(),
      [2, 2, 2],
      [0, 0, 0],
      [0, 1, 0]
    ),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
  }),
  lightHelper: components.lightHelper({ color: [1, 0, 0, 1] }),
});
world.add(directionalLightEntity);

const axis = [
  [
    [0.2, 0, 0],
    [1, 0, 0, 1],
  ],
  [
    [0, 0.2, 0],
    [0, 1, 0, 1],
  ],
  [
    [0, 0, 0.2],
    [0, 0, 1, 1],
  ],
].forEach(([pos, color]) => {
  const ent = createEntity({
    transform: transform({
      position: pos,
    }),
    geometry: cube({ sx: pos[0] + 0.1, sy: pos[1] + 0.1, sz: pos[2] + 0.1 }),
    material: material({ unlit: true, baseColor: color }),
  });
  ent.transform.parent = directionalLightEntity.transform;
  world.add(ent);
});

const pointLightEntity = createEntity({
  transform: transform({
    position: [2.2, 2.2, 2.2],
  }),
  pointLight: pointLight({
    color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 0.2,
    castShadows: true,
  }),
  lightHelper: components.lightHelper({ color: [1, 0, 0, 1] }),
});
world.add(pointLightEntity);

const segmentsGeom = {
  positions: [],
  vertexColors: [],
  count: 0,
};

let prevPos = null;
for (let i = 0; i < 128; i++) {
  const x =
    2 *
    Math.sin((i / 128) * Math.PI * 4) *
    Math.cos(((0.2 * i) / 128) * Math.PI * 4);
  const y = 2 * Math.cos((i / 128) * Math.PI * 4);
  const z =
    2 *
    Math.sin((i / 128) * Math.PI * 4 + 2.323) *
    Math.sin(((0.2 * i) / 128) * Math.PI * 4);
  if (prevPos) {
    segmentsGeom.positions.push(prevPos);
    segmentsGeom.vertexColors.push([1, 0, 1, 0.5]);
    segmentsGeom.positions.push([x, y, z]);
    segmentsGeom.vertexColors.push([1, 0, 1, 0.5]);
  }
  prevPos = [x, y, z];
}
segmentsGeom.count = segmentsGeom.positions.length / 2;
const segmentsEntity = createEntity({
  geometry: components.geometry(segmentsGeom),
  material: components.material({ type: "segments", baseColor: [1, 1, 1, 1] }),
  transform: components.transform(),
});
world.add(segmentsEntity);

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

  if (
    !reflectionProbeTexturePreview &&
    reflectionProbeEnt?._reflectionProbe?._reflectionMap
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
    const standardRenderer = renderEngine.renderers.find(
      (renderer) => renderer.type == "standard-renderer"
    );
    console.log(
      "standardRenderer",
      standardRenderer,
      renderEngine,
      renderEngine.renderers[0]
    );
    gui.addColumn("Renderer");
    const options = [
      "",
      "data.baseColor",
      "data.emissiveColor",
      "data.texCoord0",
      "data.diffuseColor",
      "data.metallic",
      "data.roughness",
      "data.normalView",
      "data.directColor",
      "data.indirectDiffuse",
      "data.indirectSpecular",
      "vNormalView",
      "vNormalWorld",
    ].map((value) => {
      return { name: value || "No debug", value };
    });
    gui.addRadioList("Debug", standardRenderer, "debugRender", options);
  }

  gui.draw();
});
