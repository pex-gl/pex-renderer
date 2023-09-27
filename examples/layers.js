import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { cube, icosphere } from "primitive-geometry";
import { vec3, quat } from "pex-math";
import createGUI from "pex-gui";

import { getEnvMap } from "./utils.js";

const State = {
  blend: 0,
  drawToScreen: true,
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const groupAEntity = createEntity({
  layer: "sideA",
  transform: components.transform(),
});
world.add(groupAEntity);

const groupBEntity = createEntity({
  layer: "sideB",
  transform: components.transform(),
});
world.add(groupBEntity);

const cameraEntity = createEntity({
  transform: components.transform({
    position: [1, 1, 5],
    rotation: quat.create(),
    parent: groupAEntity.transform,
  }),
  camera: components.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    viewport: [0, 0, ctx.gl.drawingBufferWidth / 2, ctx.gl.drawingBufferHeight],
  }),
  orbiter: components.orbiter({
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity);

const cameraEntity2 = createEntity({
  transform: components.transform({
    position: [1, 1, 5],
    rotation: quat.create(),
    parent: groupBEntity.transform,
  }),
  camera: components.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    viewport: [
      ctx.gl.drawingBufferWidth / 2,
      0,
      ctx.gl.drawingBufferWidth / 2,
      ctx.gl.drawingBufferHeight,
    ],
  }),
  orbiter: components.orbiter({
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity2);

const floorEntity = createEntity({
  name: "floor",
  transform: components.transform({
    position: [0, -0.5, 0],
  }),
  geometry: components.geometry(
    cube({ sx: 5, sy: 0.2, sz: 5, nx: 10, ny: 1, nz: 10 })
  ),
  material: components.material({
    baseColor: [0.8, 0.8, 0.8, 1],
    metallic: 0,
    roughness: 1.0,
    castShadows: true,
    receiveShadows: true,
  }),
});
floorEntity.geometry.bounds = [
  [-5, -0.2, -5],
  [5, 0.2, 5],
];
world.add(floorEntity);

const sphere = icosphere({ radius: 1, subdivisions: 4 });

const sphereEntity = createEntity({
  name: "sphereEntity",
  transform: components.transform({
    position: [0, 1, 0],
    parent: groupAEntity.transform,
  }),
  geometry: components.geometry(sphere),
  material: components.material({
    baseColor: [0, 0.4, 0.8, 1],
    // baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(sphereEntity);

const sphereEntity2 = createEntity({
  name: "sphereEntity2",
  transform: components.transform({
    position: [0, 1, 0],
    parent: groupBEntity.transform,
  }),
  geometry: components.geometry(sphere),
  material: components.material({
    baseColor: [1, 0.2, 0.0, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(sphereEntity2);

const skyboxEntity = createEntity({
  transform: components.transform({
    parent: groupAEntity.transform,
  }),
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true,
    envMap: await getEnvMap(ctx, "assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr"),
  }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  transform: components.transform({
    parent: groupAEntity.transform,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbeEntity);

const skyboxEntity2 = createEntity({
  transform: components.transform({
    parent: groupBEntity.transform,
  }),
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: false,
  }),
});
world.add(skyboxEntity2);

const reflectionProbeEntity2 = createEntity({
  transform: components.transform({
    parent: groupBEntity.transform,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbeEntity2);

const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [2, 3, 1],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize(vec3.sub([0, 0, 0], [2, 3, 1]))
    ),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 1,
    castShadows: true,
  }),
  lightHelper: components.lightHelper({ color: [1, 0, 0, 1] }),
});
world.add(directionalLightEntity);

const drawTexturesMixedCmd = {
  name: "drawTexture",
  pipeline: ctx.pipeline({
    vert: /* glsl */ `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord0;

      varying vec2 vTexCoord0;

      void main() {
        vTexCoord0 = aTexCoord0;

        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `,
    frag: /* glsl */ `
      precision highp float;

      varying vec2 vTexCoord0;

      uniform sampler2D uTexture;
      uniform sampler2D uTexture2;
      uniform float uBlend;

      void main() {
        gl_FragColor = mix(
          texture2D(uTexture, vTexCoord0),
          texture2D(uTexture2, vTexCoord0),
          uBlend
        );
        gl_FragColor = texture2D(uTexture, vTexCoord0);
        if (vTexCoord0.x + (1.0 - vTexCoord0.y) > uBlend * 2.0) {
          gl_FragColor = texture2D(uTexture2, vTexCoord0);
        }
        gl_FragColor.rgb = gl_FragColor.rgb / (1.0 + gl_FragColor.rgb);
        gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0/2.2));
      }`,
  }),
  attributes: {
    aPosition: ctx.vertexBuffer([-1, -1, 1, -1, 1, 1, -1, 1]),
    aTexCoord0: ctx.vertexBuffer([0, 0, 1, 0, 1, 1, 0, 1]),
  },
  indices: ctx.indexBuffer([0, 1, 2, 0, 2, 3]),
  uniforms: {
    uTexture: null,
  },
};

// GUI
const gui = createGUI(ctx);
gui.addColumn("Settings");
gui.addFPSMeeter();

gui.addParam("DrawToScreen", State, "drawToScreen");
gui.addParam("Blend", State, "blend", { min: 0, max: 1 });

// Events
let debugOnce = false;

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;

  cameraEntity.camera.viewport = [
    0,
    0,
    //ctx.gl.drawingBufferWidth / 2,
    ctx.gl.drawingBufferWidth,
    ctx.gl.drawingBufferHeight,
  ];
  cameraEntity2.camera.viewport = [
    //ctx.gl.drawingBufferWidth / 2,
    10,
    10,
    ctx.gl.drawingBufferWidth / 3,
    ctx.gl.drawingBufferHeight / 3,
  ];
};

window.addEventListener("resize", onResize);
onResize();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

let delta = 0;

ctx.frame(() => {
  delta += 0.01;

  const cameraEntity = world.entities.find((entity) => entity.camera);
  const cameraEntities = world.entities.filter((entity) => entity.camera);

  renderEngine.systems.find(
    (renderer) => renderer.type == "render-pipeline-system"
  ).shadowQuality = 5;

  renderEngine.update(world.entities);
  const framebufferTexturesPerCamera = renderEngine.render(
    world.entities,
    cameraEntities,
    // cameraEntity,
    { drawToScreen: State.drawToScreen, shadowQuality: 1 }
  );

  if (!State.drawToScreen) {
    let blend = (delta % 6) / 3;
    if (blend > 1) blend = 2 - blend;
    if (State.blend > 0) blend = State.blend;

    ctx.submit(drawTexturesMixedCmd, {
      uniforms: {
        uTexture: framebufferTexturesPerCamera[0].color,
        uTexture2: framebufferTexturesPerCamera[1].color,
        uBlend: blend,
      },
    });
  }

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
