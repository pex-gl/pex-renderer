import createRenderer from "../index.js";
import createContext from "pex-context";
import createGUI from "pex-gui";
import { loadJson, loadImage, loadArrayBuffer } from "pex-io";
import { quat, vec3 } from "pex-math";
import { aabb } from "pex-geom";

import { box as createBox, cube } from "primitive-geometry";
import parseHdr from "parse-hdr";

import axisHelper from "../helpers/axis-helper.js";
import { computeEdges, getURL } from "./utils.js";

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
  formats: ["glTF", "glTF-Binary", "glTF-Draco", "glTF-Embedded"],
  currentFormat: 0,
};

const FORMAT_EXTENSION = new Map()
  .set("glTF", "gltf")
  .set("glTF-Binary", "glb")
  .set("glTF-Draco", "gltf")
  .set("glTF-Embedded", "gltf");

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
});
ctx.gl.getExtension("EXT_shader_texture_lod");
ctx.gl.getExtension("OES_standard_derivatives");
ctx.gl.getExtension("WEBGL_draw_buffers");
ctx.gl.getExtension("OES_texture_float");

const renderer = createRenderer({
  ctx,
  shadowQuality: 3,
  pauseOnBlur: false,
  profile: true,
  profileFlush: false,
});

const gui = createGUI(ctx);
gui.addFPSMeeter();

const sunEntity = renderer.entity([
  renderer.transform({
    position: State.sunPosition,
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([-2, -2, -2])
    ),
  }),
  renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 5,
    castShadows: State.shadows,
    bias: 0.2,
  }),
]);
renderer.add(sunEntity);

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1],
  }),
]);
renderer.add(skyboxEntity);

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()]);
renderer.add(reflectionProbeEntity);

const addEnvmap = async () => {
  const buffer = await loadArrayBuffer(getURL(`assets/envmaps/garage/garage.hdr`));
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

  skyboxEntity.getComponent("Skybox").set({ texture: panorama });
  reflectionProbeEntity.getComponent("ReflectionProbe").set({ dirty: true });
};

if (State.useEnvMap) addEnvmap();

const axesEntity = renderer.entity([axisHelper()]);
renderer.add(axesEntity);

const lineBuilder = renderer.entity([
  renderer.geometry({
    positions,
    count: 2,
    primitive: ctx.Primitive.Lines,
  }),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    castShadows: State.shadows,
    receiveShadows: State.shadows,
  }),
]);
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
  root.transform.set({
    position: [x, root.transform.position[1], z],
  });
}

function rescaleScene({ root }) {
  const sceneBounds = root.transform.worldBounds;
  const sceneSize = aabb.size(root.transform.worldBounds);
  const sceneCenter = aabb.center(root.transform.worldBounds);
  const sceneScale =
    1 / (Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2])) || 1);
  if (!aabb.isEmpty(sceneBounds)) {
    root.transform.set({
      position: vec3.scale(
        [-sceneCenter[0], -sceneBounds[0][1], -sceneCenter[2]],
        sceneScale
      ),
      scale: [sceneScale, sceneScale, sceneScale],
    });
  }
}

function onSceneLoaded(scene, grid) {
  State.scenes.push(scene);
  renderer.update(); // refresh scene hierarchy

  if (grid) {
    rescaleScene(scene);
    repositionModel(scene);
  }

  if (State.showBoundingBoxes) {
    const box = createBox();
    box.cells = computeEdges(box.positions, box.cells, 4);
    box.primitive = ctx.Primitive.Lines;

    const bboxes = scene.entities
      .map(({ transform, name }) => {
        const size = aabb.size(transform.worldBounds);
        const center = aabb.center(transform.worldBounds);

        const bbox = renderer.add(
          renderer.entity([
            renderer.transform({
              scale: size,
              position: center,
            }),
            renderer.geometry(box),
            renderer.material({
              baseColor: [1, 0, 0, 1],
            }),
          ])
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
  let scene;
  try {
    // console.time('building ' + url)
    // All examples only have one scene
    State.scene = scene = await renderer.loadScene(url, {
      includeCameras: !grid,
    });
  } catch (e) {
    // console.timeEnd('building ' + url)
    return e;
  }

  scene.entities.forEach((entity) => {
    const materialCmp = entity.getComponent("Material");
    if (materialCmp) {
      materialCmp.set({
        castShadows: State.shadows,
        receiveShadows: State.shadows,
      });
    }
  });

  renderer.add(scene.root);

  // Add camera for models lacking one
  if (!grid) {
    cameraEntity = scene.entities.find(({ components }) =>
      components.find(({ type }) => type === "Camera")
    );

    if (!cameraEntity) {
      // Update needed for transform.worldBounds
      renderer.update();
      const far = 10000;
      const sceneBounds = scene.root.transform.worldBounds;
      // const sceneSize = aabb.size(scene.root.transform.worldBounds)
      const sceneCenter = aabb.center(scene.root.transform.worldBounds);

      const boundingSphereRadius = Math.max(
        ...sceneBounds.map((bound) => vec3.distance(sceneCenter, bound))
      );

      const fov = Math.PI / 4;
      const distance = (boundingSphereRadius * 2) / Math.tan(fov / 2);

      cameraEntity = renderer.entity([
        renderer.camera({
          near: 0.01,
          far,
          fov,
          aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
        }),
        renderer.orbiter({
          maxDistance: far,
          target: sceneCenter,
          position: [sceneCenter[0], sceneCenter[1], distance],
        }),
      ]);
      scene.entities.push(cameraEntity);
      renderer.add(cameraEntity);
    } else {
      const cameraCmp = cameraEntity.getComponent("Camera");
      cameraCmp.set({
        near: 0.5,
        aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      });

      // Clipped models: 2CylinderEngine, EnvironmentTest
      // MultiUVTest: wrong position
      if (State.selectedModel.name !== "MultiUVTest") {
        cameraEntity.addComponent(
          renderer.orbiter({
            // target: sceneCenter,
            // distance: (boundingSphereRadius * 2) / Math.tan(cameraCmp.fov / 2),
            position: cameraEntity.transform.position,
            minDistance: cameraCmp.near,
            maxDistance: cameraCmp.far,
          })
        );
      }
    }

    // console.timeEnd('building ' + url)
    scene.url = url;
  }

  return scene;
}

async function renderModel(model, overrideFormat, grid) {
  const format = overrideFormat || State.formats[State.currentFormat];

  try {
    const scene = await loadScene(
      `${MODELS_PATH}/${model.name}/${format}/${
        model.name
      }.${FORMAT_EXTENSION.get(format)}`,
      grid
    );

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
  gui.addRadioList(
    "Format",
    State,
    "currentFormat",
    State.formats.map((name, value) => ({
      name,
      value,
    }))
  );
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
          oldScene.entities.forEach((e) => e.dispose());
        }

        if (State.scene) renderer.remove(State.scene.root);
        if (floorEntity) renderer.remove(floorEntity);
      }

      renderer.remove(cameraEntity);

      console.log(model);

      renderModel(model);
    }
  );

  // Filter models
  models = models.filter(({ name }) =>
    [
      '2CylinderEngine',
      // 'AlphaBlendModeTest',
      // 'AnimatedCube',
      // 'AnimatedMorphCube',
      // 'AnimatedMorphSphere',
      // 'AnimatedTriangle',
      // 'AntiqueCamera',
      // 'Avocado',
      // 'BarramundiFish',
      // 'BoomBox',
      // 'BoomBoxWithAxes',
      // 'Box',
      // 'BoxAnimated',
      // 'BoxInterleaved',
      // 'BoxTextured',
      // 'BoxTexturedNonPowerOfTwo',
      // 'BoxVertexColors',
      // 'BrainStem',
      // 'Buggy',
      // 'Cameras',
      // 'CesiumMan',
      // 'CesiumMilkTruck',
      // 'Corset',
      // 'Cube',
      // "DamagedHelmet",
      // 'Duck',
      // 'EnvironmentTest',
      // 'FlightHelmet',
      // 'GearboxAssy',
      // 'InterpolationTest',
      // 'Lantern',
      // 'MetalRoughSpheres',
      // 'Monster',
      // 'MorphPrimitivesTest',
      // 'MultiUVTest',
      // 'NormalTangentMirrorTest',
      // 'NormalTangentTest',
      // 'OrientationTest',
      // 'ReciprocatingSaw',
      // 'RiggedFigure',
      // 'RiggedSimple',
      // 'SciFiHelmet',
      // 'SimpleMeshes',
      // 'SimpleMorph',
      // 'SimpleSparseAccessor',
      // 'SpecGlossVsMetalRough',
      // 'Sponza',
      // 'Suzanne',
      // 'TextureCoordinateTest',
      // 'TextureSettingsTest',
      // 'TextureTransformTest',
      // 'Triangle',
      // 'TriangleWithoutIndices',
      // 'TwoSidedPlane',
      // 'UnlitTest',
      // 'VC',
      // 'VertexColorTest',
      // 'WaterBottle'
    ].includes(name)
  );

  const grid = models.length > 1;

  // Setup for grid view
  if (grid) {
    State.gridSize = Math.ceil(Math.sqrt(models.length));

    cameraEntity = renderer.entity([
      renderer.camera({
        aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      }),
      renderer.orbiter({
        position: new Array(3).fill(State.gridSize * 2),
      }),
    ]);
    renderer.add(cameraEntity);

    floorEntity = renderer.entity([
      renderer.geometry(
        cube({ sx: 2 * State.gridSize, sy: 0.1, sz: 2 * State.gridSize })
      ),
      renderer.material({
        baseColor: [0.8, 0.8, 0.8, 1],
        metallic: 0,
        roughness: 1,
        castShadows: State.shadows,
        receiveShadows: State.shadows,
      }),
    ]);
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
  cameraEntity.getComponent("Camera").set({
    viewport: [0, 0, W, H],
  });
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

ctx.frame(() => {
  ctx.debug(debugOnce);
  debugOnce = false;

  if (ctx.debugCommands && ctx.debugCommands.length) {
    if (!debugCommandsOpt) {
      debugCommandsOpt = optimizeCommands(ctx.debugCommands);
    }
    if (renderer._state.profiler) {
      renderer._state.profiler.startFrame();
    }
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
    if (renderer._state.profiler) {
      renderer._state.profiler.endFrame();
    }
  } else {
    renderer.draw();
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

  if (!renderer._state.paused) {
    gui.draw();
  }
});
