import {
  world as createWorld,
  entity as createEntity,
  renderGraph as createRenderGraph,
  resourceCache as createResourceCache,
  systems,
  components,
  loaders,
} from "../index.js";
import createContext from "pex-context";
import { cube, torus, sphere, roundedCube } from "primitive-geometry";
import { vec3, quat, mat4 } from "pex-math";
import * as io from "pex-io";
import { aabb } from "pex-geom";
import createGUI from "pex-gui";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";
import random from "pex-random";

random.seed(0);

const {
  camera,
  directionalLight,
  ambientLight,
  geometry,
  material,
  orbiter,
  skybox,
  reflectionProbe,
  transform,
} = components;

const ctx = createContext();
ctx.gl.getExtension("OES_element_index_uint"); //TEMP

const world = (window.world = createWorld());
const renderGraph = createRenderGraph(ctx);
const resourceCache = createResourceCache(ctx);

const cameraEntity = createEntity({
  transform: transform({ position: [0, 0, 2] }),
  camera: camera({
    fov: Math.PI * 0.1,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
    position: [15, 1, 15],
  }),
});
world.add(cameraEntity);

function resize() {
  ctx.set({
    pixelRatio: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  cameraEntity.camera.aspect = window.innerWidth / window.innerHeight;
  cameraEntity.camera.dirty = true;
}
window.addEventListener("resize", resize);
resize();

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

const floorEntity = createEntity({
  transform: transform({
    position: [0, -1.6, 0],
  }),
  geometry: geometry(cube({ sx: 100, sy: 0.01, sz: 100 })),
  material: material({
    // unlit: true,
    baseColor: [0.5, 0.5, 0.551, 1],
    metallic: 0,
    roughness: 1,
    receiveShadows: true,
    castShadows: true,

    depthWrite: true,
    // blend: true,
    // blendSrcRGBFactor: ctx.BlendFactor.Zero,
    // blendSrcAlphaFactor: ctx.BlendFactor.Zero,
    // blendDstRGBFactor: ctx.BlendFactor.SrcColor,
    // blendDstAlphaFactor: ctx.BlendFactor.SrcAlpha,
  }),
});
world.add(floorEntity);
// floorEntity.geometry.bounds = aabb.fromPoints(
//   aabb.create(),
//   floorEntity.geometry.positions
// );
floorEntity.geometry.bounds = [
  [-10, -0.1, -10],
  [10, 0.1, 10],
];

const torusEntity = createEntity({
  transform: transform({
    position: [0, 0.2, 0],
  }),
  geometry: geometry(torus({ radius: 1.5, minorRadius: 0.2 })),
  material: material({
    baseColor: [1.9, 0.5, 0.29, 0.75],
    metallic: 0,
    roughness: 0.05,
    transmission: 0.6,
    // refraction: 0.5,
    // blend: true,
    // blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    // blendSrcAlphaFactor: ctx.BlendFactor.SrcAlpha,
    // blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    // blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.Zero,
    blendDstAlphaFactor: ctx.BlendFactor.Zero,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(torusEntity);

const sphereEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(sphere({ radius: 1 })),
  material: material({
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.1,
  }),
});
// world.add(sphereEntity);

const g = {
  positions: [],
  scales: [],
  colors: [],
};
const reveal = 0.2;

const colorPalette = [];
for (let i = 0; i < 6; i++) {
  colorPalette.push([
    random.float(1.4),
    random.float(1.4),
    random.float(1.4),
    1,
  ]);
}

for (let x = -1.75; x <= 2; x += 0.5) {
  for (let z = -1.75; z <= 2; z += 0.5) {
    for (let y = -0.75; y <= 1; y += 0.5) {
      if (x < 0.25 || y < 0.25 || z < 0.25) {
        let dx = 0;
        let dy = 0;
        let dz = 0;
        if (x < -0.25) dx -= 3 * reveal;
        if (y < -0.25) dy -= 3 * reveal;
        if (z < -0.25) dz -= 3 * reveal;
        if (x > 0.25) dx += 2 * reveal;
        if (y > 0.25) dy += 2 * reveal;
        if (z > 0.25) dz += 2 * reveal;
        if (random.chance(0.5)) continue;

        g.positions.push([x + dx, y + dy, z + dz]);
        g.scales.push([0.5, 0.5, 0.5]);
        // if (random.chance(0.5)) {
        g.colors.push(random.element(colorPalette));
        // } else {
        // g.colors.push([0.1, 0.1, 0.1, 1]);
        // }
      }
    }
  }
}

const g1 = {
  positions: [],
  scales: [],
  colors: [],
};

const g2 = {
  positions: [],
  scales: [],
  colors: [],
};

g.positions.forEach((p, i) => {
  if (random.chance(0.3)) {
    g1.positions.push(p);
    g1.scales.push(g.scales[i]);
    g1.colors.push(g.colors[i]);
  } else {
    g2.positions.push(p);
    g2.scales.push(g.scales[i]);
    g2.colors.push(g.colors[i]);
  }
});

const cubesEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry({
    //...roundedCube({ sx: 0.5, sy: 0.5, sz: 0.5, radius: 0.05 }),
    ...roundedCube({ sx: 1, sy: 1, sz: 1, radius: 0.005 }),
    //offsets: new Array(32).fill(0).map(() => random.vec3(2)),
    offsets: g1.positions,
    scales: g1.scales,
    colors: g1.colors,
    // instances: 32,
    instances: g1.positions.length,
    bounds: [
      [-2, -2, -2],
      [2, 2, 2],
    ],
  }),
  material: material({
    baseColor: [1, 1, 1, 1],
    // baseColor: [0.2, 0.5, 1, 1],
    metallic: 0,
    roughness: 0.15,
    // transmission: 0.6,
    refraction: 0.5,
    //opaque mesh = no blending, it will be handled by material
    // blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.Zero,
    blendDstAlphaFactor: ctx.BlendFactor.Zero,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(cubesEntity);

const cubesEntity2 = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry({
    //...roundedCube({ sx: 0.5, sy: 0.5, sz: 0.5, radius: 0.05 }),
    ...roundedCube({ sx: 1, sy: 1, sz: 1, radius: 0.05 }),
    //offsets: new Array(32).fill(0).map(() => random.vec3(2)),
    offsets: g2.positions,
    scales: g2.scales,
    // instances: 32,
    instances: g2.positions.length,
  }),
  material: material({
    // baseColor: [1, 1.0, 1, 1],
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.5,
    transmission: 0.6,
    refraction: 0.1,
    receiveShadows: false,
    //opaque mesh = no blending, it will be handled by material
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.Zero,
    blendDstAlphaFactor: ctx.BlendFactor.Zero,
  }),
});
world.add(cubesEntity2);

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

const directionalLightEntity = createEntity(
  {
    transform: transform({
      position: [1, 1, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [-2, 2, 0])
      ),
    }),
    directionalLight: directionalLight({
      color: [1, 1, 1, 2], //FIXME: instencity is copied to alpha in pex-renderer
      intensity: 1,
      castShadows: true,
      bias: 0.03,
    }),
    // ambientLight: ambientLight({
    //   color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    //   intensity: 1,
    //   castShadows: true,
    // }),
    // lightHelper() //TODO:
  }
  // ["cell0"]
);
world.add(directionalLightEntity);

const directionalLightEntity2 = createEntity(
  {
    transform: transform({
      position: [1, 1, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [2, 2, -2])
      ),
    }),
    directionalLight: directionalLight({
      color: [1, 1, 1, 2], //FIXME: instencity is copied to alpha in pex-renderer
      intensity: 1,
      castShadows: true,
      bias: 0.03,
    }),
    // ambientLight: ambientLight({
    //   color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    //   intensity: 1,
    //   castShadows: true,
    // }),
    // lightHelper() //TODO:
  }
  // ["cell0"]
);
world.add(directionalLightEntity2);

const geometrySys = systems.geometry({ ctx });
const transformSys = systems.transform();
const cameraSys = systems.camera();
const skyboxSys = systems.skybox({ ctx });
const reflectionProbeSys = systems.reflectionProbe({ ctx });
const renderPipelineSys = systems.renderPipeline({
  ctx,
  resourceCache,
  renderGraph,
  outputEncoding: ctx.Encoding.Linear,
});
world.addSystem(renderPipelineSys);

const standardRendererSystem = systems.renderer.standard({
  ctx,
  resourceCache,
  renderGraph,
});
const basicRendererSystem = systems.renderer.basic({
  ctx,
  resourceCache,
  renderGraph,
});
const lineRendererSystem = systems.renderer.line({
  ctx,
  resourceCache,
  renderGraph,
});
const helperRendererSys = systems.renderer.helper({ ctx });
const skyboxRendererSys = systems.renderer.skybox({ ctx });

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

    // console.log("entities", entities);
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
    `examples/assets/envmaps/garage/garage.hdr`
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

  //force update reflection probe
  console.log(
    "skybox before update",
    "" + world.entities.find((e) => e.skybox)?._skybox
  );
  skyboxSys.update(world.entities);
  reflectionProbeSys.update(world.entities, {
    renderers: [skyboxRendererSys],
  });
  console.log(
    "skybox after update",
    "" + world.entities.find((e) => e.skybox)?._skybox
  );

  console.log(skyboxEnt);
  skyboxEnt.skybox.envMap = panorama; //TODO: remove _skybox
  // skyboxEnt._skybox.dirty = true; //TODO: check if this works
  // skyboxEnt._skybox._reflectionProbe = reflectionProbeEnt._reflectionProbe;

  console.log("reflectionProbeEnt", reflectionProbeEnt);
  // reflectionProbeEnt._reflectionProbe.dirty = true;

  gui.addHeader("Settings");
  gui.addParam("BG Blur", skyboxEnt.skybox, "backgroundBlur", {}, () => {});
  gui.addParam(
    "Sun Position",
    skyboxEnt.skybox,
    "sunPosition",
    { min: -1, max: 1 },
    (e) => {
      console.log("on change", e);
    }
  );
  // gui.addTexture2D(
  //   "Skybox",
  //   skyboxEnt.skybox.texture || skyboxEnt._skybox._skyTexture
  // );
  console.log(world.entities);
  // debugger;
  // gui.addTexture2D(
  //   "Reflection Probe",
  //   reflectionProbeEnt._reflectionProbe._reflectionMap
  // );

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

ctx.frame(() => {
  resourceCache.beginFrame();
  renderGraph.beginFrame();

  const now = Date.now() * 0.0005;
  if (debugNextFrame) {
    debugNextFrame = false;
    ctx.gl.getError();
    ctx.debug(true);
  }

  // skyboxEnt.skybox.sunPosition = [
  //   Math.cos(now * 2),
  //   0.5 + 0.5 * Math.cos(now * 2),
  //   -1,
  // ];

  quat.fromAxisAngle(
    torusEntity.transform.rotation,
    [0, 1, 0],
    Date.now() / 1000
  );
  torusEntity.transform.dirty = true; //UGH

  const renderView = {
    camera: cameraEntity.camera,
    cameraEntity: cameraEntity,
    viewport: [0, 0, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
  };

  try {
    // world.update();
    geometrySys.update(world.entities);
    transformSys.update(world.entities);
    skyboxSys.update(world.entities);
    reflectionProbeSys.update(world.entities, {
      renderers: [skyboxRendererSys],
    });
    cameraSys.update(world.entities);
    renderPipelineSys.update(world.entities, {
      renderers: [
        standardRendererSystem,
        lineRendererSystem,
        skyboxRendererSys,
      ],
      renderView: renderView,
    });
  } catch (e) {
    console.error(e);
    return false;
  }

  renderGraph.endFrame();
  resourceCache.endFrame();

  gui.draw();

  ctx.debug(false);

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
