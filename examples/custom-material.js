import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";
import * as SHADERS from "pex-shaders";

import { cube, icosphere, plane, cone } from "primitive-geometry";

import { getEnvMap } from "./utils.js";

random.seed(0);

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

// Entities
const cameraEntity = createEntity({
  transform: components.transform({
    position: [3, 3, 3],
    rotation: quat.create(),
  }),
  camera: components.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  postProcessing: components.postProcessing(),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const floorSize = 5;
const floorThickness = floorSize * 0.01;

const floorEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(
    cube({ sx: floorSize, sy: floorThickness, sz: floorSize }),
  ),
  material: components.material({
    baseColor: [0.7, 0.7, 0, 1],
    metallic: 0,
    roughness: 1,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(floorEntity);

// Instanced geometry with custom attributes and material with hooks
const grassHeight = floorSize * 0.1;
const coneGeometry = cone({
  height: grassHeight,
  radius: grassHeight * 0.05,
  nx: 4,
});
for (let i = 1; i < coneGeometry.positions.length; i += 3) {
  coneGeometry.positions[i] += grassHeight / 2;
}

const grassPlaneGeometry = plane({
  sx: floorSize * 0.65,
  nx: 48,
  direction: "y",
});

const grassEntity = createEntity({
  transform: components.transform({ position: [0, floorThickness * 0.5, 0] }),
  geometry: components.geometry({
    ...coneGeometry,
    offsets: grassPlaneGeometry.positions,
    instances: grassPlaneGeometry.positions.length / 3,
    attributes: {
      aInstanceTintColor: {
        buffer: ctx.vertexBuffer(
          new Float32Array(grassPlaneGeometry.positions.length * 3).map(() =>
            random.float(0.5),
          ),
        ),
        divisor: 1,
      },
    },
  }),
  material: components.material({
    baseColor: [0, 0, 0, 1],
    metallic: 0.2,
    roughness: 0.6,
    castShadows: true,
    receiveShadows: true,
    hooks: {
      vert: {
        DECLARATIONS_END: /* glsl */ `
attribute vec3 aInstanceTintColor;
uniform float uTime;
varying float vNoiseAmount;
varying float vColorNoise;
varying vec3 vInstanceTintColor;

${SHADERS.chunks.noise.common}
${SHADERS.chunks.noise.perlin}
        `,
        BEFORE_TRANSFORM: /* glsl */ `
vec3 frequency = aOffset.xyz * 0.3;
float noiseAmountX = cnoise(frequency + vec3(uTime, 0.0, 0.0));
float noiseAmountZ = cnoise(frequency + vec3(0.0, 0.0, uTime));
float noiseAmountY = 0.7 + 0.7 * cnoise(frequency + vec3(1.0, 0.5, 21.520));

float y = (position.y + ${grassHeight.toFixed(2)} / 2.0) / ${grassHeight.toFixed(2)};
float y2 = y * y;

vNoiseAmount = position.y / ${grassHeight.toFixed(2)};

position.x += 0.5 * noiseAmountX * y2;
position.z += 0.5 * noiseAmountZ * y2;
position.y *= 1.0 - 2.0 * (0.5 * noiseAmountX * y2 * 0.5 * noiseAmountZ * y2);
position.y *= pow(clamp(length(aOffset.xz / 1.0), 0.0, 1.0), 3.0);
position.y *= noiseAmountY;

vColorNoise = position.y / ${grassHeight.toFixed(2)};
vInstanceTintColor = aInstanceTintColor;
        `,
      },
      frag: {
        DECLARATIONS_END: /* glsl */ `
varying float vNoiseAmount;
varying float vColorNoise;
varying vec3 vInstanceTintColor;
        `,
        BEFORE_LIGHTING: /* glsl */ `
data.baseColor = mix(vec3(0.3, 1.0, 0.0), vec3(0.0, 0.5, 0.2), vColorNoise);
data.baseColor *= 0.4 + vNoiseAmount;
data.baseColor = mix(data.baseColor, vInstanceTintColor, 0.3);
        `,
      },
      uniforms: (entity) => {
        return {
          uTime: (performance.now() % 10000) / 2000,
        };
      },
    },
  }),
});
world.add(grassEntity);

// Material with hooks
const sphereEntity = createEntity({
  transform: components.transform({ position: [0, 1, 0] }),
  geometry: components.geometry(
    icosphere({ radius: floorSize * 0.05, subdivisions: 4 }),
  ),
  material: components.material({
    baseColor: [1, 0, 1, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
    hooks: {
      vert: {
        DECLARATIONS_END: /* glsl */ `
uniform float uTime;
varying float vNoiseAmount;

${SHADERS.chunks.noise.common}
${SHADERS.chunks.noise.perlin}
        `,
        BEFORE_TRANSFORM: /* glsl */ `
vec3 frequency = position.xyz * 2.0;
vNoiseAmount = 0.5 + 0.5 * cnoise(frequency + vec3(uTime, 0.0, 0.0));
position.xyz += normal.xyz * vNoiseAmount;
        `,
      },
      frag: {
        DECLARATIONS_END: /* glsl */ `
varying float vNoiseAmount;
        `,
        BEFORE_TEXTURES: /* glsl */ `
vec3 dX = dFdx(data.positionView);
vec3 dY = dFdy(data.positionView);
data.normalView = normalize(cross(dX, dY));
data.normalWorld = vec3(data.inverseViewMatrix * vec4(data.normalView, 0.0));
        `,
        BEFORE_LIGHTING: /* glsl */ `
data.metallic = step(0.5, vNoiseAmount);
data.baseColor = mix(vec3(2.0, 0.4, 0.0), vec3(1.0), data.metallic);
        `,
      },
      uniforms: (entity) => {
        return {
          uTime: (performance.now() % 1000000) / 2000,
        };
      },
    },
  }),
});
world.add(sphereEntity);

// Add segment geometry for line renderer system
const lineGeometry = { positions: [], vertexColors: [] };
let lineColors = [
  [1, 1, 0, 1],
  [1, 0, 0, 1],
];

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

  lineColors.reverse();

  if (prevPos) {
    lineGeometry.positions.push(prevPos);
    lineGeometry.vertexColors.push(lineColors[0]);
    lineGeometry.positions.push([x, y, z]);
    lineGeometry.vertexColors.push(lineColors[1]);
  }
  prevPos = [x, y, z];
}
const linesEntity = createEntity({
  transform: components.transform({ position: [0, 1, 0] }),
  geometry: components.geometry(lineGeometry),
  material: components.material({
    type: "line",
    baseColor: [1, 1, 1, 1],
    lineWidth: 30,
  }),
});
world.add(linesEntity);

const skyboxEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true,
    envMap: await getEnvMap(ctx, "assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr"),
  }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbeEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [2, 2, 2],
    rotation: quat.fromPointToPoint(quat.create(), [2, 2, 2], [0, 0, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 5,
    castShadows: true,
  }),
  lightHelper: true,
});
world.add(directionalLightEntity);

// Update for GUI
renderEngine.update(world.entities);
renderEngine.render(world.entities, cameraEntity);

// GUI
const gui = createGUI(ctx);
gui.addColumn("Renderer");
gui.addFPSMeeter();
gui.addRadioList(
  "Debug",
  renderEngine.renderers.find(
    (renderer) => renderer.type == "standard-renderer",
  ),
  "debugRender",
  [
    "",

    "data.texCoord0",
    "data.texCoord1",
    "data.normalView",
    "data.tangentView",
    "data.normalWorld",
    "data.NdotV",

    "data.baseColor",
    "data.emissiveColor",
    "data.opacity",
    "data.roughness",
    "data.metallic",
    "data.linearRoughness",
    "data.f0",
    "data.clearCoat",
    "data.clearCoatRoughness",
    "data.clearCoatLinearRoughness",
    "data.clearCoatNormal",
    "data.reflectionWorld",
    "data.directColor",
    "data.diffuseColor",
    "data.indirectDiffuse",
    "data.indirectSpecular",
    "data.sheenColor",
    "data.sheenRoughness",
    "data.sheen",

    "data.ao",
    "vNormalView",
    "vNormalWorld",
  ].map((value) => ({ name: value || "No debug", value })),
);

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
