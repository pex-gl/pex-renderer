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
import { cube, sphere } from "primitive-geometry";
import { vec3, quat, mat4 } from "pex-math";
import * as io from "pex-io";
import { aabb } from "pex-geom";
import createGUI from "pex-gui";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";
import { fromHSL } from "pex-color";
import random from "pex-random";
import { serializeGraph } from "https://cdn.skypack.dev/@thi.ng/dot";

const dotGraph = {
  directed: true,
  attribs: {
    rankdir: "TB",
    fontname: "Inconsolata",
    fontsize: 9,
    fontcolor: "gray",
    labeljust: "l",
    labelloc: "b",
    node: {
      shape: "rect",
      style: "filled",
      fontname: "Arial",
      fontsize: 11,
    },
    // edge defaults
    edge: {
      arrowsize: 0.75,
      fontname: "Inconsolata",
      fontsize: 9,
    },
  },
  // graph nodes (the keys are used as node IDs)
  // use spread operator to inject style presets
  nodes: {
    // A: { shape: "rect", label: "A" },
    // B: { shape: "rect", label: "B" },
  },
  // graph edges (w/ optional ports & extra attribs)
  edges: [
    // { src: "A", dest: "B" }
  ],
};

const dot = {
  reset: () => {
    (dotGraph.nodes = {}), (dotGraph.edges = []);
  },
  node: (id, label, props) => {
    if (Array.isArray(label)) {
      label = label
        .map((label, i) => {
          return `<f${i}> ${label}`;
        })
        .join("|");
      props = {
        ...props,
        shape: "record",
      };
    }

    dotGraph.nodes[id] = { label: label || id, ...props };
  },
  passNode: (id, name) => {
    dot.node(id, name, { fillcolor: "red", fontcolor: "white" });
  },
  resourceNode: (id, name) => {
    dot.node(id, name, { fillcolor: "blue", fontcolor: "white" });
  },
  edge: (id1, id2) => {
    dotGraph.edges.push({ src: id1, dest: id2 });
  },
  render: () => {
    const dotStr = serializeGraph(dotGraph);
    console.log("dotStr", dotStr);

    hpccWasm.graphviz.layout(dotStr, "svg", "dot").then((svg) => {
      const div = document.getElementById("graphviz-container");
      div.innerHTML = svg;
    });
  },
  style: {
    texture: {
      fillcolor: "skyblue",
    },
  },
};

window.dot = dot;

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
  lightHelper,
} = components;

const ctx = createContext({
  type: "webgl",
  pixelRatio: 1.5,
});

const oldApply = ctx.apply;
ctx.apply = (...args) => {
  // const rt =
  // ctx.stack[ctx.stack.length - 1].pass?.framebuffer.color?.[0].texture;
  const cmd = args[0];
  const fbo = cmd.pass?.framebuffer;
  const rt = fbo?.color?.[0].texture; //?.framebuffer?.color?.[0];
  const dt = fbo?.depth?.texture;

  const parentFBO = ctx.stack[ctx.stack.length - 1].pass?.framebuffer;
  const rtName =
    parentFBO != fbo ? (rt?.name || rt?.id || "").replace("\n", " - ") : "";
  const dtName =
    parentFBO != fbo ? (dt?.name || dt?.id || "").replace("\n", " - ") : "";

  const inputTextures = [
    cmd.uniforms?.["uDirectionalLightShadowMaps[0]"],
    cmd.uniforms?.["uDirectionalLightShadowMaps[1]"],
  ]
    .filter((_) => _)
    .map((tex) => tex.id);

  if (ctx.debugMode)
    console.log(
      "capture commands",
      args,
      "  ".repeat(ctx.stack.length),
      cmd.name,
      rtName ? "-> [" + [rtName, dtName].join(" | ") + "]" : " ",
      inputTextures ? "<- [" + inputTextures.join(" | ") + "]" : " "
    );
  oldApply.call(ctx, ...args);
};
setTimeout(() => {
  debugNextFrame = true;
}, 500);

window.addEventListener("resize", () => {
  ctx.set({
    pixelRatio: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  // ctx.gl.canvas.style.width = window.innerWidth + "px";
  // ctx.gl.canvas.style.height = window.innerHeight + "px";
});

ctx.gl.getExtension("OES_element_index_uint"); //TEMP

const entities = (window.entities = []);
const renderGraph = createRenderGraph(ctx, dot);
const resourceCache = createResourceCache(ctx);

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

const stats = [
  "texture",
  "program",
  "pipeline",
  "pass",
  "indexBuffer",
  "vertexBuffer",
];
const statsControls = stats.map((statName) => {
  return { name: statName, control: gui.addLabel("-") };
});

function updateStats() {
  statsControls.forEach(({ name, control }) => {
    const stat = ctx.stats[name] || { alive: 0, total: 0 };
    control.setTitle(`${name} : ${stat.alive} / ${stat.total}`);
  });
}

gui.addButton("Debug", () => {
  debugNextFrame = true;
  console.log(ctx.stats);
  // texture2DLabel.setTitle(ctx.stats);
});

gui.addButton("Tree", () => {
  entities.forEach((e) => {
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
  transform: transform({ position: [0, 3, 3] }),
  camera: camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    target: [0, 1, 0],
    position: [0, 2, 4],
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
  }),
});
entities.push(cameraEntity);

const floorEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(cube({ sx: 3, sy: 0.1, sz: 3 })),
  material: material({
    baseColor: [1, 0.8, 0.2, 1],
    metallic: 0,
    roughness: 0.2,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
entities.push(floorEntity);

const cubesEntity = createEntity({
  transform: transform({
    position: [0, 1, 0],
  }),
  geometry: geometry({
    ...cube({ sx: 1.5, sy: 0.5, sz: 1.5 }),
    // offsets: new Array(64).fill(0).map(() => random.vec3(3)),
    instances: 64,
  }),
  // geometry: geometry({
  //   ...cube({ sx: 1, sy: 1, sz: 1 }),
  //   offsets: new Array(64).fill(0).map(() => random.vec3(3)),
  // }),
  material: material({
    baseColor: [0.2, 0.9, 0.2, 0.5],
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
entities.push(cubesEntity);

const spinningEntity = createEntity({
  transform: transform({
    position: [0, 1, 0],
  }),
  geometry: geometry(cube()),
  material: material({
    baseColor: [0.5, 0.5, 0.5, 1],
    metallic: 0,
    roughness: 0.5,
  }),
  boundingBoxHelper: components.boundingBoxHelper({
    color: [0, 0, 1, 1],
  }),
});
entities.push(spinningEntity);

const linePositions = [];
const lineVertexColors = [];
for (let i = 0; i < 10; i++) {
  linePositions.push(random.vec3(5), random.vec3(5));
  const c = fromHSL([0, 0, 0, 1], random.float(), 0.5, 0.5);
  lineVertexColors.push(c, c);
}

console.log("lineVertexColors", lineVertexColors);

const linesEntity = createEntity({
  transform: transform(),
  geometry: geometry({
    positions: linePositions,
    vertexColors: lineVertexColors,
  }),
  material: material({
    baseColor: [1, 1, 1, 1],
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
  drawSegments: true,
});
entities.push(linesEntity);

const sphereEntity = createEntity({
  transform: transform({
    position: [0, 2, 0],
  }),
  geometry: geometry(sphere()),
  material: material({
    baseColor: [1, 0, 1, 1],
    metallic: 0,
    roughness: 0.5,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
entities.push(sphereEntity);

floorEntity.geometry.bounds = aabb.fromPoints(
  aabb.create(),
  floorEntity.geometry.positions
);
spinningEntity.geometry.bounds = aabb.fromPoints(
  aabb.create(),
  spinningEntity.geometry.positions
);

const skyboxEnt = createEntity({
  skybox: skybox({
    sunPosition: [0.1, 0.04, -1],
  }),
  reflectionProbe: reflectionProbe(),
});
entities.push(skyboxEnt);

const directionalLightEntity = createEntity(
  {
    transform: transform({
      position: [2, 2, 0],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 0])
      ),
    }),
    directionalLight: directionalLight({
      color: [1, 0.1, 0.1, 1], //FIXME: intensity is copied to alpha in pex-renderer
      intensity: 3,
      castShadows: true,
    }),
    // ambientLight: ambientLight({
    // color: [0.15, 0.15, 0.15, 1],
    // }),
    lightHelper: lightHelper(),
  }
  // ["cell0"]
);
entities.push(directionalLightEntity);

const directionalLightEntity2 = createEntity(
  {
    transform: transform({
      position: [-2, 2, 0],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [-1, 1, 0])
      ),
    }),
    directionalLight: directionalLight({
      color: [0.1, 0.1, 1.0, 1], //FIXME: intensity is copied to alpha in pex-renderer
      intensity: 3,
      castShadows: true,
    }),
    // ambientLight: ambientLight({
    // color: [0.5, 0.5, 0.5, 1],
    // }),
    lightHelper: lightHelper(),
  }
  // ["cell0"]
);
entities.push(directionalLightEntity2);

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

function createView(cameraEntity, viewport) {
  const view = {
    viewport: viewport,
    cameraEntity: cameraEntity,
  };
  view.draw = function (cb) {
    const W = ctx.gl.drawingBufferWidth;
    const H = ctx.gl.drawingBufferHeight;
    const renderView = {
      viewport: [
        viewport[0] * W,
        viewport[1] * H,
        viewport[2] * W,
        viewport[3] * H,
      ],
      cameraEntity: cameraEntity,
      camera: cameraEntity.camera,
    };
    const aspect = renderView.viewport[2] / renderView.viewport[3];
    cameraEntity.camera.aspect = aspect;
    cameraEntity.camera.dirty = true;
    cameraSys.update(entities);

    cb(renderView, viewport);
  };
  return view;
}

const view1 = createView(cameraEntity, [0.0, 0.0, 0.5, 1]);
const view2 = createView(cameraEntity, [0.5, 0.0, 0.5, 1]);

let shadowMapPreview;

let frame = 0;

const clearCmd = {
  pass: ctx.pass({
    clearColor: [0.3, 0.3, 0.3, 1],
    clearDepth: 1,
  }),
};

const basicCmd = {
  name: "basicCmd",
  pipeline: ctx.pipeline({
    vert: /*glsl*/ `
    attribute vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    void main() {
      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
    }
    `,
    frag: /*glsl*/ `
    precision highp float;
    uniform vec4 uBaseColor;
    void main() {
      gl_FragData[0] = uBaseColor;
    }
    `,
    depthWrite: true,
    depthTest: true,
  }),
};

ctx.frame(() => {
  frame++;

  dot.reset();
  resourceCache.beginFrame();
  renderGraph.beginFrame();

  const now = Date.now() * 0.0005;
  if (debugNextFrame) {
    debugNextFrame = false;
    ctx.gl.getError();
    ctx.debug(true);
  }

  // skyboxEnt.skybox.sunPosition = [1 * Math.cos(now), 1, 1 * Math.sin(now)];
  quat.fromAxisAngle(
    spinningEntity.transform.rotation,
    [0, 1, 0],
    Date.now() / 1000
  );
  spinningEntity.transform.dirty = true; //UGH

  // can't just automatically render all the systems as we have two views
  // world.update();

  geometrySys.update(entities);
  transformSys.update(entities);
  skyboxSys.update(entities);
  reflectionProbeSys.update(entities);

  //draw left/bottom side
  view1.draw((renderView) => {
    renderPipelineSys.update(entities, {
      renderers: [standardRendererSystem, lineRendererSystem],
      renderView: renderView,
    });
  });

  //draw right/top side
  view2.draw((renderView) => {
    renderPipelineSys.update(entities, {
      renderers: [basicRendererSystem, lineRendererSystem, helperRendererSys],
      renderView: renderView,
    });
  });

  if (frame == 1) {
    dot.render();
  }

  if (directionalLightEntity.directionalLight._shadowMap && !shadowMapPreview) {
    //TODO: mutated texture to flip in GUI
    directionalLightEntity.directionalLight._shadowMap.flipY = true;
    shadowMapPreview = gui.addTexture2D(
      "Shadow Map " + directionalLightEntity.directionalLight._shadowMap.id,
      directionalLightEntity.directionalLight._shadowMap,
      { flipY: true }
    ); //TODO
  }

  // const drawCmd = {
  //   pass: resourceCache.pass(passDesc),
  //   pipeline: resourceCache.pipeline(pipelineDesc),
  //   uniforms: {
  //     uViewportSize: [ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
  //   },
  // };
  // const fullscreenTriangle = resourceCache.fullscreenTriangle();
  // drawCmd.attributes = fullscreenTriangle.attributes;
  // drawCmd.count = fullscreenTriangle.count;
  // ctx.submit(drawCmd);

  renderGraph.endFrame();
  resourceCache.endFrame();

  gui.draw();

  updateStats();
  ctx.debug(false);

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
