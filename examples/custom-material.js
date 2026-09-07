import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  shaders,
  loaders,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";
import * as SHADERS from "pex-shaders";

import { cube, icosphere, plane, cone } from "primitive-geometry";

import { getEnvMap, getURL } from "./utils.js";

random.seed(0);

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

// Entities
const cameraEntity = createEntity({
  transform: components.transform({
    position: [3, 3, 3],
    rotation: quat.create(),
  }),
  camera: components.camera({
    aspect: ctx.width / ctx.height,
  }),
  postProcessing: components.postProcessing(),
  orbiter: components.orbiter({ element: ctx.canvas }),
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

// Shared by both hooked materials below: the classic Perlin noise chunk and
// the helpers it is built on, as WGSL functions (cnoiseVec3 here).
const NOISE = /* wgsl */ `
${SHADERS.chunks.noise.common}
${SHADERS.chunks.noise.perlin}`;

const grassEntity = createEntity({
  transform: components.transform({ position: [0, floorThickness * 0.5, 0] }),
  geometry: components.geometry({
    ...coneGeometry,
    offsets: grassPlaneGeometry.positions,
    instances: grassPlaneGeometry.positions.length / 3,
    attributes: {
      // Named as the hook declares it below: pex-gpu resolves a vertex buffer
      // by the name of the shader input it feeds.
      instanceTint: {
        buffer: gpu.createBuffer(ctx, {
          usage: "vertex",
          data: new Float32Array(grassPlaneGeometry.positions.length * 3).map(
            () => random.float(0.5),
          ),
        }),
        stepMode: "instance",
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
      attributes: { instanceTint: "vec3f" },
      varyings: { noiseAmount: "f32", colorNoise: "f32", tint: "vec3f" },
      bindings: { time: "f32" },
      // Called once per entity per frame, so the blade bends the same way in
      // the shadow map, the depth pre-pass and the shaded pass.
      uniforms: () => ({ time: (performance.now() % 10000) / 2000 }),
      vertDeclarationsEnd: NOISE,
      vertBeforeTransform: /* wgsl */ `
  let frequency = input.offset * 0.3;
  let noiseAmountX = cnoiseVec3(frequency + vec3f(uHooks.time, 0.0, 0.0));
  let noiseAmountZ = cnoiseVec3(frequency + vec3f(0.0, 0.0, uHooks.time));
  let noiseAmountY = 0.7 + 0.7 * cnoiseVec3(frequency + vec3f(1.0, 0.5, 21.52));

  let y = (position.y + ${grassHeight.toFixed(2)} / 2.0) / ${grassHeight.toFixed(2)};
  let y2 = y * y;

  output.noiseAmount = position.y / ${grassHeight.toFixed(2)};

  position.x += 0.5 * noiseAmountX * y2;
  position.z += 0.5 * noiseAmountZ * y2;
  position.y *= 1.0 - 2.0 * (0.5 * noiseAmountX * y2 * 0.5 * noiseAmountZ * y2);
  position.y *= pow(clamp(length(input.offset.xz), 0.0, 1.0), 3.0);
  position.y *= noiseAmountY;

  output.colorNoise = position.y / ${grassHeight.toFixed(2)};
  output.tint = input.instanceTint;
      `,
      fragBeforeLighting: /* wgsl */ `
  data.baseColor = mix(vec3f(0.3, 1.0, 0.0), vec3f(0.0, 0.5, 0.2), input.colorNoise);
  data.baseColor *= 0.4 + input.noiseAmount;
  data.baseColor = mix(data.baseColor, input.tint, 0.3);
      `,
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
      varyings: { noiseAmount: "f32" },
      bindings: { time: "f32" },
      uniforms: () => ({ time: (performance.now() % 1000000) / 2000 }),
      vertDeclarationsEnd: NOISE,
      vertBeforeTransform: /* wgsl */ `
  let frequency = position.xyz * 2.0;
  output.noiseAmount = 0.5 + 0.5 * cnoiseVec3(frequency + vec3f(uHooks.time, 0.0, 0.0));
  position = vec4f(position.xyz + normal * output.noiseAmount, position.w);
      `,
      fragBeforeTextures: /* wgsl */ `
  let dX = dpdx(data.positionView);
  let dY = dpdy(data.positionView);
  data.normalView = normalize(cross(dX, dY));
  data.normalWorld = (data.inverseViewMatrix * vec4f(data.normalView, 0.0)).xyz;
      `,
      fragBeforeLighting: /* wgsl */ `
  data.metallic = step(0.5, input.noiseAmount);
  data.baseColor = mix(vec3f(2.0, 0.4, 0.0), vec3f(1.0), vec3f(data.metallic));
      `,
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
    backgroundBlur: 1,
    envMap: await loaders.hdr(
      ctx,
      getURL("assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr"),
    ),
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
    intensity: 100_000, // lx, a clear midday sun
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
    "data.transmission",
    "data.dispersion",
    "data.diffuseTransmission",
    "data.diffuseTransmissionColor",
    "data.diffuseTransmissionThickness",
    "data.thickness",
    "data.attenuationDistance",
    "data.attenuationColor",
    "data.ior",
    "data.ao",

    "input.normalView",
    "input.normalWorld",
  ].map((value) => ({ name: value || "No debug", value })),
);

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  gpu.resize(ctx, width, height, pixelRatio);
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  await renderEngine.render(world.entities, cameraEntity);

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
