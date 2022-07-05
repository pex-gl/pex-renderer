import createRenderer from "../index.js";
import createContext from "pex-context";
import createGUI from "pex-gui";
import { loadJson, loadImage, loadArrayBuffer } from "pex-io";
import { quat, vec3, mat4 } from "pex-math";
import { aabb } from "pex-geom";

import { box as createBox, cube as createCube } from "primitive-geometry";
import parseHdr from "parse-hdr";

import axisHelper from "../helpers/axis-helper.js";
import { computeEdges, getURL } from "./utils.js";

// const MODELS_PATH = "examples/glTF-Sample-Models/2.0";
const MODELS_PATH =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";

const State = {
  sunPosition: [2, 2, 2],
  selectedModel: "",
  scenes: [],
  gridSize: 1,
  showBoundingBoxes: true,
  useEnvMap: true,
  shadows: false,
  formats: [
    "glTF",
    "glTF-Binary",
    "glTF-Draco",
    "glTF-Embedded",
    "glTF-Quantized",
    "glTF-KTX-BasisU",
    "glTF-JPG-PNG",
  ],
  currentFormat: 0,
  modelName: "-",
};

const FORMAT_EXTENSION = new Map()
  .set("glTF", "gltf")
  .set("glTF-Binary", "glb")
  .set("glTF-Draco", "gltf")
  .set("glTF-Embedded", "gltf")
  .set("glTF-Quantized", "gltf")
  .set("glTF-KTX-BasisU", "gltf")
  .set("glTF-JPG-PNG", "gltf");

// Utils
const positions = [
  [0, 0, 0],
  [0, 0, 0],
];
const addLine = (a, b) => positions.push(a, b);

let pp = null;
let pq = null;
let frame = 0;
function addPointLine({ jointMatrices }, i, j) {
  const p = [
    State.positions[i * 3],
    State.positions[i * 3 + 1],
    State.positions[i * 3 + 2],
  ];
  const np = [0, 0, 0];
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), jointMatrices[State.joints[i * 4 + 0]]),
      State.weights[i * 4 + 0]
    )
  );
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), jointMatrices[State.joints[i * 4 + 1]]),
      State.weights[i * 4 + 1]
    )
  );
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), jointMatrices[State.joints[i * 4 + 2]]),
      State.weights[i * 4 + 2]
    )
  );
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), jointMatrices[State.joints[i * 4 + 3]]),
      State.weights[i * 4 + 3]
    )
  );
  const q = [
    State.positions[j * 3],
    State.positions[j * 3 + 1],
    State.positions[j * 3 + 2],
  ];
  const nq = [0, 0, 0];
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), jointMatrices[State.joints[j * 4 + 0]]),
      State.weights[j * 4 + 0]
    )
  );
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), jointMatrices[State.joints[j * 4 + 1]]),
      State.weights[j * 4 + 1]
    )
  );
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), jointMatrices[State.joints[j * 4 + 2]]),
      State.weights[j * 4 + 2]
    )
  );
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), jointMatrices[State.joints[j * 4 + 3]]),
      State.weights[j * 4 + 3]
    )
  );

  if (pp && pq) {
    // positions.length = 0
    addLine(pp, np);
    addLine(pq, nq);
    // vec3.set(np, p)
    // vec3.multMat4(np, State.body.transform.modelMatrix)
    // addLine([0, 0, 0], np)
    // vec3.set(nq, q)
    // vec3.multMat4(nq, State.body.transform.modelMatrix)
    if (frame++ % 10 === 0) {
      addLine(np, nq);
    }
  }
  pp = np;
  pq = nq;
}

// Start
const ctx = createContext({
  powerPreference: "high-performance",
  type: "webgl",
});

const renderer = createRenderer({
  ctx,
  shadowQuality: 3,
  pauseOnBlur: false,
  profile: true,
  profileFlush: false,
});
window.renderer = renderer;
window.state = State;

renderer.addSystem(renderer.geometrySystem());
renderer.addSystem(renderer.transformSystem());
renderer.addSystem(renderer.animationSystem());
renderer.addSystem(renderer.cameraSystem());
renderer.addSystem(renderer.skyboxSystem());
renderer.addSystem(renderer.reflectionProbeSystem());
renderer.addSystem(renderer.renderSystem());

function aabbToString(aabb) {
  if (!aabb) return "[]";
  return `[${aabb[0].map((f) => f.toFixed(0.1))} .. ${aabb[1].map((f) =>
    f.toFixed(0.1)
  )}]`;
}

const gui = createGUI(ctx);

function debugScene() {
  let s = "";
  renderer.entities.forEach((e, i) => {
    let pad = "";
    let transform = e.transform;
    while (transform) {
      pad += "--";
      transform = transform.parent;
    }
    let bbox = aabbToString(e.transform?.worldBounds);
    s += `${pad} ${i} ${e.name} ${Object.keys(e).join(" | ")} | ${bbox} \n`;
  });
  console.log(s);
  console.log("renderer.entities", renderer.entities);
}

function debugGL() {
  debugOnce = true;
}

function openModelURL() {
  window.open(
    State.url.replace(
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/",
      "https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/"
    )
  );
}

const sunEntity = renderer.entity({
  transform: renderer.transform({
    position: State.sunPosition,
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([-2, -2, -2])
    ),
  }),
  directionalLight: renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 0,
    castShadows: State.shadows,
    bias: 0.2,
  }),
});
renderer.add(sunEntity);

const skyboxEntity = renderer.entity({
  skybox: renderer.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 0,
  }),
});
renderer.add(skyboxEntity);

const reflectionProbeEntity = renderer.entity({
  reflectionProbe: renderer.reflectionProbe(),
});
renderer.add(reflectionProbeEntity);

const addEnvmap = async () => {
  const buffer = await loadArrayBuffer(
    getURL(`assets/envmaps/garage/garage.hdr`)
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
    flipY: true,
  });

  skyboxEntity.skybox.texture = panorama;
  if (skyboxEntity._skybox) {
    skyboxEntity._skybox.texture = panorama; //TODO: data ownership skybox vs _skybox
  }
  reflectionProbeEntity.reflectionProbe.dirty = true; //TODO: check if reflectionProbe.dirty is implemented
};

if (State.useEnvMap) addEnvmap();

// TODO: implement axis helper
// const axesEntity = renderer.entity([axisHelper()]);
// renderer.add(axesEntity);

const lineBuilder = renderer.entity({
  transform: renderer.transform(),
  geometry: renderer.geometry({
    positions,
    count: 2,
    primitive: ctx.Primitive.Lines, //TODO: check Primitive.Lines support
  }),
  material: renderer.material({
    baseColor: [1, 0, 0, 1],
    castShadows: State.shadows,
    receiveShadows: State.shadows,
  }),
});
// renderer.add(lineBuilder)

// glTF
function repositionModel({ root }) {
  const n = State.gridSize;
  const i = State.scenes.length;
  let x = 2 * (i % n) - n + 1;
  let z = 2 * Math.floor(i / n) - n + 1;

  if (State.selectedModel) {
    x = z = 0;
  }
  root.transform.position = [x, root.transform.position[1], z];
  root.transform = {
    ...root.transform,
  };
}

function rescaleScene({ root }) {
  const sceneBounds = root.transform.worldBounds;
  const sceneSize = aabb.size(root.transform.worldBounds);
  const sceneCenter = aabb.center(root.transform.worldBounds);
  let maxSize = Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2]));
  if (maxSize == 0 || maxSize == Infinity) maxSize = 1;
  const sceneScale = 1 / maxSize;

  if (!aabb.isEmpty(sceneBounds)) {
    root.transform.position = vec3.scale(
      [-sceneCenter[0], -sceneBounds[0][1], -sceneCenter[2]],
      sceneScale
    );
    root.root = true;
    root.transform.scale = [sceneScale, sceneScale, sceneScale];
    root.transform = {
      ...root.transform,
    };
  }
}

function onSceneLoaded(scene, grid) {
  State.scenes.push(scene);
  renderer.update(); // refresh scene hierarchy

  debugScene();

  if (grid || true) {
    //TEMP: auto scaling
    rescaleScene(scene);
    if (grid) repositionModel(scene);
    renderer.update(); //update bounding boxes after rescaling
  }

  const addFloor = true;
  if (addFloor) {
    const cube = createCube({ sx: 1, sy: 0.05, sz: 1 });
    const floorEnt = renderer.entity({
      transform: renderer.transform({ position: [0, -0.025, 0] }),
      geometry: renderer.geometry(cube),
      material: renderer.material({ baseColor: [0.5, 0.5, 0.5, 1] }),
    });
    renderer.add(floorEnt);
  }

  if (State.showBoundingBoxes) {
    const box = createBox();
    box.cells = computeEdges(box.positions, box.cells, 4);
    box.primitive = ctx.Primitive.Lines;

    const bboxes = scene.entities
      .map(({ transform, name }) => {
        const size = aabb.size(transform.worldBounds);
        const center = aabb.center(transform.worldBounds);
        // const size = [1, 1, 1];

        const bbox = renderer.add(
          renderer.entity({
            transform: renderer.transform({
              scale: size,
              position: center,
            }),
            geometry: renderer.geometry(box),
            material: renderer.material({
              unlit: true,
              baseColor: [1, 0, 0, 1],
            }),
          })
        );
        bbox.name = `${name}_bbox`;
        return bbox;
      })
      .filter((e) => e);
    scene.entities = scene.entities.concat(bboxes);
  }
}

let floorEntity;
let cameraEntity;

async function loadScene(url, grid) {
  const includeCameras = false;
  let scene;
  try {
    // All examples only have one scene
    State.scene = scene = (
      await renderer.loadScene(url, {
        // includeCameras: !grid,
        includeCameras: includeCameras,
        includeAnimations: true,
        includeLights: !grid,
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
      })
    )[0]; //TODO: selecting first scene by default
  } catch (e) {
    console.error(e);
    // console.timeEnd('building ' + url)
    return e;
  }

  // sort entities by depth
  scene.entities.forEach((e) => {
    var parent = e.transform;
    var depth = 0;
    var watchdog = 0;
    while (parent && watchdog++ < 100) {
      parent = parent.parent;
      depth++;
    }
    e.transform.depth = depth;
    e.transform.worldBounds = aabb.create();
  });

  scene.entities.sort((a, b) => {
    return a.transform.depth - b.transform.depth;
  });

  // TODO: add shadows on/off
  // scene.entities.forEach((entity) => {
  //   const materialCmp = entity.getComponent("Material");
  //   if (materialCmp) {
  //     materialCmp.set({
  //       castShadows: State.shadows,
  //       receiveShadows: State.shadows,
  //     });
  //   }
  // });

  scene.entities.forEach((e) => renderer.add(e));

  // Add camera for models lacking one
  if (!grid) {
    cameraEntity = scene.entities.find((e) => e.camera);

    if (!cameraEntity) {
      // Update needed for transform.worldBounds
      renderer.update(); //TODO: check if that call updates transform.worldBounds

      const far = 100;
      const sceneBounds = scene.root.transform.worldBounds;
      // const sceneSize = aabb.size(scene.root.transform.worldBounds)
      let sceneCenter = aabb.center(scene.root.transform.worldBounds);
      if (isNaN(sceneCenter[0])) {
        sceneCenter[0] = 0;
        sceneCenter[1] = 0;
        sceneCenter[2] = 0;
      }

      const boundingSphereRadius = Math.max(
        ...sceneBounds.map((bound) => vec3.distance(sceneCenter, bound))
      );

      const fov = Math.PI / 4;
      const distance = (boundingSphereRadius * 2) / Math.tan(fov / 2);
      let position = includeCameras
        ? [distance, distance, distance]
        : [2, 2, 2];

      position = [0, 0.5, 1.5];
      sceneCenter = [0, 0.5, 0];

      cameraEntity = renderer.entity({
        transform: renderer.transform(),
        camera: renderer.camera({
          near: 0.1,
          far,
          fov,
          aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
          target: sceneCenter,
          position: position,
        }),
        orbiter: renderer.orbiter({
          element: ctx.gl.canvas,
          // maxDistance: far,
          target: sceneCenter,
          position: position,
        }),
      });
      scene.entities.push(cameraEntity);
      renderer.add(cameraEntity);
    } else {
      //TODO: do i need to set dirty for camera to update?
      cameraEntity.camera.aspect =
        ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight;
      cameraEntity.camera.projectionMatrix = mat4.perspective(
        mat4.create(),
        cameraEntity.camera.fov,
        cameraEntity.camera.aspect,
        cameraEntity.camera.near,
        cameraEntity.camera.far
      );

      // Clipped models: 2CylinderEngine, EnvironmentTest
      // MultiUVTest: wrong position
      if (State.selectedModel.name !== "MultiUVTest") {
        // cameraEntity.orbiter = renderer.orbiter({
        //   // target: sceneCenter,
        //   // distance: (boundingSphereRadius * 2) / Math.tan(cameraCmp.fov / 2),
        //   position: cameraEntity.transform.position,
        //   minDistance: cameraEntity.camera.near,
        //   maxDistance: cameraEntity.camera.far,
        // });
      }
    }

    // console.timeEnd('building ' + url)
    scene.url = url;
  }

  return scene;
}

async function renderModel(model, overrideFormat, grid) {
  const format = overrideFormat || State.formats[State.currentFormat];

  const url = `${MODELS_PATH}/${model.name}/${format}/${
    model.name
  }.${FORMAT_EXTENSION.get(format)}`;
  State.url = url;
  State.modelName = model.name;

  try {
    const scene = await loadScene(url, grid);

    if (scene instanceof Error) {
      throw scene;
    } else {
      onSceneLoaded(scene, grid);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    // eslint-disable-next-line no-console
    console.warn(
      `No format ${format} supported for model ${model.name}. Defaulting to glTF.`
    );
    if (!overrideFormat) {
      renderModel(model, "glTF", grid);
    }
  }
}

async function init() {
  // Get list of models locally or from the glTF repo
  let models = await loadJson(`${MODELS_PATH}/model-index.json`);

  // Add screenshots to the GUI
  const screenshots = await Promise.all(
    models.map(
      ({ name, screenshot }) =>
        loadImage({
          url: `${MODELS_PATH}/${name}/${screenshot}`,
          crossOrigin: "anonymous",
        }),
      null
    )
  );
  const thumbnails = screenshots
    .map((img) =>
      ctx.texture2D({
        data: img,
        width: img.width,
        height: img.height,
        encoding: ctx.Encoding.SRGB,
        pixelFormat: ctx.PixelFormat.RGBA8,
        flipY: true,
      })
    )
    .map((tex, i) => ({
      value: models[i],
      texture: tex,
    }));

  gui.addColumn("GLTF");
  gui.addTexture2DList(
    "Models",
    State,
    "selectedModel",
    thumbnails,
    4,
    async (model) => {
      // Clean up
      if (State.selectedModel) {
        while (State.scenes.length) {
          const oldScene = State.scenes.shift();
          // oldScene.entities.forEach((e) => e.dispose()); //TODO: dispose
        }

        if (State.scene) {
          //renderer.remove(State.scene.root); //TODO: renderer.remove()
          State.scene.entities.forEach((e) => {
            const idx = renderer.entities.indexOf(e);
            renderer.entities.splice(idx, 1);
          });
        }
        // if (floorEntity) renderer.remove(floorEntity); //renderer.remove()
      }

      // renderer.remove(cameraEntity);

      renderModel(model);
    }
  );

  gui.addColumn("Options");
  gui.addFPSMeeter();

  gui.addButton("Debug Scene Tree", debugScene);
  gui.addButton("Debug GL", debugGL);
  gui.addButton("Open Model URL", openModelURL);
  gui.addParam("Model name", State, "modelName");
  gui.addRadioList(
    "Format",
    State,
    "currentFormat",
    State.formats.map((name, value) => ({
      name,
      value,
    }))
  );

  // Filter models
  models = models.filter(({ name }) =>
    [
      // "2CylinderEngine",
      // "AlphaBlendModeTest",
      // "AnimatedCube",
      // "AnimatedMorphCube",
      // "AnimatedMorphSphere",
      // "AnimatedTriangle",
      // "AntiqueCamera",
      // "AttenuationTest",
      // "Avocado",
      // "BarramundiFish",
      // "BoomBox",
      // "BoomBoxWithAxes",
      // "Box",
      // "Box With Spaces",
      // "BoxAnimated",
      // "BoxInterleaved",
      // "BoxTextured",
      // "BoxTexturedNonPowerOfTwo",
      // "BoxVertexColors",
      // "BrainStem",
      // "Buggy",
      // "Cameras",
      // "CesiumMan",
      // "CesiumMilkTruck",
      "ClearCoatTest",
      // "Corset",
      // "Cube",
      // "DamagedHelmet",
      // "DragonAttenuation",
      // "Duck",
      // "EmissiveStrengthTest",
      // "EnvironmentTest",
      // "FlightHelmet",
      // "Fox",
      // "GearboxAssy",
      // "GlamVelvetSofa",
      // "InterpolationTest",
      // "IridescenceDielectricSpheres",
      // "IridescenceLamp",
      // "IridescenceMetallicSpheres",
      // "IridescenceSuzanne",
      // "IridescentDishWithOlives",
      // "Lantern",
      // "LightsPunctualLamp",
      // "MaterialsVariantsShoe",
      // "MetalRoughSpheres",
      // "MetalRoughSpheresNoTextures",
      // "MorphPrimitivesTest",
      // "MorphStressTest",
      // "MosquitoInAmber",
      // "MultiUVTest",
      // "NormalTangentMirrorTest",
      // "NormalTangentTest",
      // "OrientationTest",
      // "ReciprocatingSaw",
      // "RecursiveSkeletons",
      // "RiggedFigure",
      // "RiggedSimple",
      // "SciFiHelmet",
      // "SheenChair",
      // "SheenCloth",
      // "SimpleMeshes",
      // "SimpleMorph",
      // "SimpleSkin",
      // "SimpleSparseAccessor",
      // "SpecGlossVsMetalRough",
      // "SpecularTest",
      // "Sponza",
      // "StainedGlassLamp",
      // "Suzanne",
      // "TextureCoordinateTest",
      // "TextureEncodingTest",
      // "TextureLinearInterpolationTest",
      // "TextureSettingsTest",
      // "TextureTransformMultiTest",
      // "TextureTransformTest",
      // "ToyCar",
      // "TransmissionRoughnessTest",
      // "TransmissionTest",
      // "Triangle",
      // "TriangleWithoutIndices",
      // "TwoSidedPlane",
      // "Unicode\u2764\u267bTest",
      // "UnlitTest",
      // "VC",
      // "VertexColorTest",
      // "WaterBottle",
    ].includes(name)
  );

  const grid = models.length > 1;

  // Setup for grid view
  if (grid) {
    State.gridSize = Math.ceil(Math.sqrt(models.length));

    cameraEntity = renderer.entity({
      transform: renderer.transform(),
      camera: renderer.camera({
        aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      }),
      orbiter: renderer.orbiter({
        position: new Array(3).fill(State.gridSize * 2),
      }),
    });
    renderer.add(cameraEntity);

    floorEntity = renderer.entity({
      transform: renderer.transform(),
      geometry: renderer.geometry(
        createCube({ sx: 2 * State.gridSize, sy: 0.1, sz: 2 * State.gridSize })
      ),
      material: renderer.material({
        baseColor: [0.8, 0.8, 0.8, 1],
        metallic: 0,
        roughness: 1,
        castShadows: State.shadows,
        receiveShadows: State.shadows,
      }),
    });
    renderer.add(floorEntity);
  }

  // Render scene(s)
  await Promise.all(
    models.map(async (model) => {
      await renderModel(model, null, grid);
    })
  );

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
}

init();

let debugCommandsOpt = null;
function optimizeCommands(commands) {
  return commands;
}

window.addEventListener("resize", () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  ctx.set({
    width: W,
    height: H,
  });
  if (cameraEntity) {
    cameraEntity.camera.viewport = [0, 0, W, H];
    cameraEntity.camera.aspect = W / H;
  }
});

window.addEventListener("keypress", ({ key }) => {
  if (key === "d") {
    debugOnce = true;
  }
  if (key === "g") {
    gui.toggleEnabled();
  }
});

let debugOnce = false;

let prevTime = Date.now();

ctx.frame(() => {
  ctx.debug(debugOnce);
  debugOnce = false;

  if (ctx.debugCommands && ctx.debugCommands.length) {
    if (!debugCommandsOpt) {
      debugCommandsOpt = optimizeCommands(ctx.debugCommands);
    }
    // TODO: implement profiler
    // if (renderer._state.profiler) {
    // renderer._state.profiler.startFrame();
    // }

    // var camera = renderer.getComponents('Camera')[0]
    // var orbiter = renderer.getComponents('Orbiter')[0]
    // orbiter.update()
    // camera.entity.transform.update()
    // camera.update()
    // for (let cmd of debugCommandsOpt) {
    //   if (cmd.uniforms) {
    //     cmd.uniforms.viewMatrix = camera.viewMatrix
    //   }
    //   ctx.apply(cmd)
    // }

    // TODO: implement profiler
    // if (renderer._state.profiler) {
    // renderer._state.profiler.endFrame();
    // }
  } else {
    const now = Date.now();
    const deltaTime = (now - prevTime) / 1000;
    prevTime = now;
    renderer.draw(deltaTime);
  }

  if (State.body) {
    // var worldMatrix = State.body.transform.worldMatrix
    const skin = State.body.getComponent("Skin");
    addPointLine(skin, State.minXi, State.maxXi);
    lineBuilder.getComponent("Geometry").set({
      positions,
      count: positions.length,
    });
  }

  // TODO: implement pause on blur
  // if (!renderer._state.paused) {
  gui.draw();
  // }
});
