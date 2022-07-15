import {
  world as createWorld,
  entity as createEntity,
  systems,
  components,
  loaders,
  entity,
} from "../index.js";
import createContext from "pex-context";
import createGUI from "pex-gui";
import { loadJson, loadImage, loadArrayBuffer } from "pex-io";
import { quat, vec3, mat4 } from "pex-math";
import { aabb } from "pex-geom";

import { box as createBox, cube as createCube } from "primitive-geometry";
import parseHdr from "parse-hdr";

import axisHelper from "../helpers/axis-helper.js";
import { computeEdges, getURL } from "./utils.js";

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

// const MODELS_PATH = "examples/glTF-Sample-Models/2.0";
const MODELS_PATH =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";

const State = {
  sunPosition: [2, 2, 2],
  selectedModel: "",
  scenes: [],
  gridSize: 1,
  boundingBoxes: true,
  floor: true,
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

// Start
const ctx = createContext({
  powerPreference: "high-performance",
});

const world = createWorld({
  //   shadowQuality: 3,
  //   pauseOnBlur: false,
  //   profile: true,
  //   profileFlush: false,
});
window.world = world;
window.state = State;

world.addSystem(systems.geometry({ ctx }));
world.addSystem(systems.transform());
world.addSystem(systems.animation());
world.addSystem(systems.camera());
world.addSystem(systems.skybox({ ctx }));
world.addSystem(systems.reflectionProbe({ ctx }));
world.addSystem(systems.renderer({ ctx, outputEncoding: ctx.Encoding.Gamma }));

const gui = createGUI(ctx);

const sunEntity = createEntity({
  transform: transform({
    position: State.sunPosition,
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([-2, -2, -2])
    ),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 0,
    castShadows: State.shadows,
    bias: 0.2,
  }),
});
world.add(sunEntity);

const skyboxEntity = createEntity({
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 0,
  }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  reflectionProbe: reflectionProbe(),
});
world.add(reflectionProbeEntity);

let floorEntity;
let cameraEntity;

const unitBox = createBox();
unitBox.cells = computeEdges(unitBox.positions, unitBox.cells, 4);
unitBox.primitive = ctx.Primitive.Lines;

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
// const axesEntity = createEntity(axisHelper());
// world.add(axesEntity);

// Utils
let debugOnce = false;
let prevTime = Date.now();

let debugCommandsOpt = null;
function optimizeCommands(commands) {
  return commands;
}

function debugScene() {
  let s = "";
  world.entities.forEach((e, i) => {
    let pad = "";
    let transform = e.transform;
    while (transform) {
      pad += "--";
      transform = transform.parent;
    }
    let bbox = e.transform?.worldBounds
      ? aabb.toString(e.transform.worldBounds)
      : "[]";
    s += `${pad} ${i} ${e.name} ${Object.keys(e).join(" | ")} | ${bbox} \n`;
  });
  console.log(s);
  console.log("world.entities", world.entities);
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

// glTF
function repositionModel({ root }) {
  const n = State.gridSize;
  const i = State.scenes.length;
  const x = 2 * (i % n) - n + 1;
  const z = 2 * Math.floor(i / n) - n + 1;

  vec3.add(root.transform.position, [x, 0, z]);
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
      sceneCenter.map((n) => -n),
      sceneScale
    );
    root.root = true;
    root.transform.scale = [sceneScale, sceneScale, sceneScale];
    root.transform = { ...root.transform };
  }
}

function onSceneLoaded(scene, grid) {
  State.scenes.push(scene);
  world.update(); // refresh scene hierarchy

  debugScene();

  rescaleScene(scene);
  if (grid) repositionModel(scene);
  world.update();

  if (State.floor) {
    const cube = createCube({ sx: 1, sy: 0.05, sz: 1 });
    floorEntity = createEntity({
      transform: transform({ position: [0, -0.525, 0] }),
      geometry: geometry(cube),
      material: material({ baseColor: [0.5, 0.5, 0.5, 1] }),
    });
    world.add(floorEntity);
  }

  if (State.boundingBoxes) {
    const bboxes = scene.entities
      .map((entity) => {
        const size = aabb.size(entity.transform.worldBounds);
        const center = aabb.center(entity.transform.worldBounds);

        const bbox = world.add(
          createEntity({
            transform: transform({
              scale: size,
              position: center,
            }),
            geometry: geometry(unitBox),
            material: material({
              unlit: true,
              baseColor: [1, 0, 0, 1],
            }),
          })
        );
        bbox.name = `${entity.name}_bbox`;
        return bbox;
      })
      .filter((e) => e);
    scene.entities = scene.entities.concat(bboxes);
  }
}

async function loadScene(url, grid) {
  let scene;
  try {
    // All examples only have one scene
    State.scene = scene = (
      await loaders.gltf(url, {
        ctx,
        includeCameras: !grid,
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

  scene.entities.forEach((entity) => {
    if (entity.material) {
      entity.material.castShadows = State.shadows;
      entity.material.receiveShadows = State.shadows;
    }
  });

  scene.entities.forEach((e) => world.add(e));

  // Add camera for models lacking one
  if (!grid) {
    cameraEntity = scene.entities.find((e) => e.camera);

    if (!cameraEntity) {
      // Update needed for transform.worldBounds
      world.update(); //TODO: check if that call updates transform.worldBounds

      const far = 100;
      const sceneBounds = scene.root.transform.worldBounds;
      let sceneCenter = aabb.center(scene.root.transform.worldBounds);
      if (isNaN(sceneCenter[0])) {
        sceneCenter[0] = 0;
        sceneCenter[1] = 0;
        sceneCenter[2] = 0;
      }

      const fov = Math.PI / 4;
      // const boundingSphereRadius = Math.max(
      //   ...sceneBounds.map((bound) => vec3.distance(sceneCenter, bound))
      // );
      // const distance = (boundingSphereRadius * 2) / Math.tan(fov / 2);

      cameraEntity = createEntity({
        transform: transform(),
        camera: camera({
          near: 0.1,
          far,
          fov,
          aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
        }),
        orbiter: orbiter({
          element: ctx.gl.canvas,
          position: [2, 2, 2],
        }),
      });
      scene.entities.push(cameraEntity);
      world.add(cameraEntity);
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
        cameraEntity.orbiter = orbiter({
          // target: sceneCenter,
          // distance: (boundingSphereRadius * 2) / Math.tan(cameraCmp.fov / 2),
          // position: [2, 2, 2],
          position: cameraEntity.camera.position,
          // position: cameraEntity.transform.position,
          // minDistance: cameraEntity.camera.near,
          // maxDistance: cameraEntity.camera.far,
        });
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
    console.error(e);
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
      const scenes = State.scenes.length ? State.scenes : [State.scene];

      const entitiesIds = [
        ...scenes.map((scene) => scene.entities.map((e) => e.id)).flat(),
        floorEntity.id,
        cameraEntity.id,
      ].filter(Boolean);

      //TODO: renderer.remove() and dispose
      world.entities = world.entities.filter(
        (entity) => !entitiesIds.includes(entity.id)
      );

      State.scenes = [];

      await renderModel(model);
    }
  );

  gui.addColumn("Options");
  gui.addFPSMeeter();

  gui.addParam("Floor", State, "floor");
  gui.addParam("Bounding Box", State, "boundingBoxes");
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
      // "ClearCoatTest",
      // "Corset",
      // "Cube",
      // "DamagedHelmet",
      // "DragonAttenuation",
      "Duck",
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

    cameraEntity = createEntity({
      transform: transform(),
      camera: camera({
        aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      }),
      orbiter: orbiter({
        position: new Array(3).fill(State.gridSize * 2),
      }),
    });
    world.add(cameraEntity);

    if (State.floor) {
      floorEntity = createEntity({
        transform: transform({
          position: [0, -0.6, 0],
        }),
        geometry: geometry(
          createCube({
            sx: 2 * State.gridSize,
            sy: 0.1,
            sz: 2 * State.gridSize,
          })
        ),
        material: material({
          baseColor: [0.8, 0.8, 0.8, 1],
          metallic: 0,
          roughness: 1,
          castShadows: State.shadows,
          receiveShadows: State.shadows,
        }),
      });
      world.add(floorEntity);
    }
  } else {
    State.selectedModel = models[0];
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
    cameraEntity.camera.projectionMatrix = mat4.perspective(
      mat4.create(),
      cameraEntity.camera.fov,
      cameraEntity.camera.aspect,
      cameraEntity.camera.near,
      cameraEntity.camera.far
    );
  }
});

window.addEventListener("keypress", ({ key }) => {
  if (key === "d") {
    debugOnce = true;
  } else if (key === "g") {
    gui.enabled = !gui.enabled;
  }
});

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
    world.update(deltaTime);
  }

  gui.draw();
});
