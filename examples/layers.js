import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";
import createContext from "pex-context";
import { cube, icosphere } from "primitive-geometry";
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

const ctx = createContext({ pixelRatio: 1.5 });
ctx.gl.getExtension("OES_element_index_uint"); //TEMP
ctx.gl.getExtension("EXT_color_buffer_float");

const gui = createGUI(ctx);
gui.addColumn("Settings");
gui.addFPSMeeter();

const settings = {
  blend: 0,
  drawToScreen: true,
};
gui.addParam("DrawToScreen", settings, "drawToScreen");
gui.addParam("Blend", settings, "blend", { min: 0, max: 1 });

function resize() {
  ctx.set({
    pixelRatio: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
  });
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
}

window.addEventListener("resize", resize);

const world = createWorld();
window.world = world;

const groupAEntity = createEntity({
  layer: "sideA",
  transform: transform(),
});
world.add(groupAEntity);

const groupBEntity = createEntity({
  layer: "sideB",
  transform: transform(),
});
world.add(groupBEntity);

const cameraEntity = createEntity({
  transform: transform({
    position: [1, 1, 5],
    rotation: quat.create(),
    parent: groupAEntity.transform,
  }),
  camera: camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    viewport: [0, 0, ctx.gl.drawingBufferWidth / 2, ctx.gl.drawingBufferHeight],
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity);

const cameraEntity2 = createEntity({
  transform: transform({
    position: [1, 1, 5],
    rotation: quat.create(),
    parent: groupBEntity.transform,
  }),
  camera: camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    viewport: [
      ctx.gl.drawingBufferWidth / 2,
      0,
      ctx.gl.drawingBufferWidth / 2,
      ctx.gl.drawingBufferHeight,
    ],
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity2);

const floorEntity = createEntity({
  name: "floor",
  transform: transform({
    position: [0, -0.5, 0],
  }),
  geometry: geometry(cube({ sx: 5, sy: 0.2, sz: 5, nx: 10, ny: 1, nz: 10 })),
  material: material({
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
  transform: transform({
    position: [0, 1, 0],
    parent: groupAEntity.transform,
  }),
  geometry: geometry(sphere),
  material: material({
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
  transform: transform({
    position: [0, 1, 0],
    parent: groupBEntity.transform,
  }),
  geometry: geometry(sphere),
  material: material({
    baseColor: [1, 0.2, 0.0, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(sphereEntity2);

const skyboxEnt = createEntity({
  transform: {
    parent: groupAEntity.transform,
  },
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true,
  }),
});
world.add(skyboxEnt);

const reflectionProbeEnt = createEntity({
  transform: {
    parent: groupAEntity.transform,
  },
  reflectionProbe: reflectionProbe(),
});
world.add(reflectionProbeEnt);

const skyboxEnt2 = createEntity({
  transform: transform({
    parent: groupBEntity.transform,
  }),
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: false,
  }),
});
world.add(skyboxEnt2);

const reflectionProbeEnt2 = createEntity({
  transform: transform({
    parent: groupBEntity.transform,
  }),
  reflectionProbe: reflectionProbe(),
});
world.add(reflectionProbeEnt2);

(async () => {
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

const directionalLightEntity = createEntity({
  transform: transform({
    position: [2, 3, 1],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize(vec3.sub([0, 0, 0], [2, 3, 1]))
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

let prevTime = Date.now();
let time = 0;
const renderEngine = createRenderEngine({ ctx });

const drawTexturesMixedCmd = {
  name: "drawTexture",
  pipeline: ctx.pipeline({
    vert: /* glsl */ `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;

      varying vec2 vTexCoord;

      void main() {
        vTexCoord = aTexCoord;

        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `,
    frag: /* glsl */ `
      precision highp float;

      varying vec2 vTexCoord;

      uniform sampler2D uTexture;
      uniform sampler2D uTexture2;
      uniform float uBlend;

      void main() {
        gl_FragColor = mix(
          texture2D(uTexture, vTexCoord),
          texture2D(uTexture2, vTexCoord),
          uBlend
        );
        gl_FragColor = texture2D(uTexture, vTexCoord);
        if (vTexCoord.x + (1.0 - vTexCoord.y) > uBlend * 2.0) {
          gl_FragColor = texture2D(uTexture2, vTexCoord);
        }
        gl_FragColor.rgb = gl_FragColor.rgb / (1.0 + gl_FragColor.rgb);
        gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0/2.2));
      }`,
  }),
  attributes: {
    aPosition: ctx.vertexBuffer([
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]),
    aTexCoord: ctx.vertexBuffer([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]),
  },
  indices: ctx.indexBuffer([
    [0, 1, 2],
    [0, 2, 3],
  ]),
  uniforms: {
    uTexture: null,
  },
};

resize();

ctx.frame(() => {
  const now = Date.now();
  const deltaTime = (now - prevTime) / 1000;
  prevTime = now;
  time += deltaTime;

  const cameraEntity = world.entities.find((e) => e.camera);
  const cameraEntities = world.entities.filter((e) => e.camera);

  const renderPipelineSystem = renderEngine.systems.find(
    (renderer) => renderer.type == "render-pipeline-system"
  );
  //TODO: shadowQuality should be part of camera
  renderPipelineSystem.shadowQuality = 5;

  renderEngine.update(world.entities, deltaTime);
  const framebufferTexturesPerCamera = renderEngine.render(
    world.entities,
    cameraEntities,
    // cameraEntity,
    { drawToScreen: settings.drawToScreen, shadowQuality: 1 }
  );

  if (!settings.drawToScreen) {
    let blend = (time % 6) / 3;
    if (blend > 1) blend = 2 - blend;
    if (settings.blend > 0) blend = settings.blend;

    ctx.submit(drawTexturesMixedCmd, {
      uniforms: {
        uTexture: framebufferTexturesPerCamera[0].color,
        uTexture2: framebufferTexturesPerCamera[1].color,
        uBlend: blend,
      },
    });
  }

  gui.draw();
});
