import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "../index.js";

import createContext from "pex-context";
import { vec3, quat } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";
import * as SHADERS from "pex-shaders";

import { cube, icosphere, plane, cone } from "primitive-geometry";

import { getEnvMap, getURL, quatFromPointToPoint } from "./utils.js";

random.seed(0);

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

// Entities
const cameraEntity = createEntity({
  transform: components.transform({
    position: [1, 1, 5],
    rotation: quat.create(),
  }),
  camera: components.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const floorEntity = createEntity({
  transform: components.transform({
    position: [0, -1.1, 0],
  }),
  geometry: components.geometry(
    cube({ sx: 15, sy: 0.2, sz: 15, nx: 10, ny: 1, nz: 10 })
  ),
  material: components.material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 1.0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(floorEntity);

//src: https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
const perlinNoiseGLSL = /* glsl */ `
// Classic Perlin 3D Noise
// by Stefan Gustavson

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}
`;

// Instanced geometry and material with hooks and custom attributes
const grassHeight = 1.2;
const coneGeometry = cone({ height: grassHeight, radius: 0.05, nx: 4 });
for (let i = 1; i < coneGeometry.positions.length; i += 3) {
  coneGeometry.positions[i] += grassHeight / 2;
}

const grassPlaneGeometry = plane({
  sx: 5 - 0.05 * 2,
  sy: 5 - 0.05 * 2,
  nx: 48,
  ny: 48,
  direction: "y",
  quads: false,
});

const grassEntity = createEntity({
  transform: components.transform({ position: [0, -1, 0] }),
  geometry: components.geometry({
    ...coneGeometry,
    offsets: grassPlaneGeometry.positions,
    instances: grassPlaneGeometry.positions.length / 3,
    attributes: {
      aInstanceTintColor: {
        buffer: ctx.vertexBuffer(
          new Float32Array(grassPlaneGeometry.positions.length * 3).map(() =>
            random.float(0.5)
          )
        ),
        divisor: 1,
      },
    },
  }),
  material: components.material({
    baseColor: [0.2, 0.8, 0, 1],
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

${perlinNoiseGLSL}
        `,
        BEFORE_TRANSFORM: /* glsl */ `
float noiseAmountX = cnoise(aOffset.xyz * 0.3 + vec3(uTime, 0.0, 0.0));
float noiseAmountZ = cnoise(aOffset.xyz * 0.3 + vec3(0.0, 0.0, uTime));
float noiseAmountY = 0.7 + 0.7 * cnoise(aOffset.xyz * 0.3 + vec3(1.0, 0.5, 21.520));
float y = (position.y + ${grassHeight}/2.0)/${grassHeight};

vNoiseAmount = position.y / ${grassHeight};

position.x += 0.5 * noiseAmountX * (y * y);
position.z += 0.5 * noiseAmountZ * (y * y);
position.y *= 1.0 - 2.0 * (0.5 * noiseAmountX * (y * y) * 0.5 * noiseAmountZ * (y * y));
position.y *= pow(clamp(length(aOffset.xz/2.0), 0.0, 1.0), 3.0);
position.y *= noiseAmountY;

vColorNoise = position.y / ${grassHeight};
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
data.baseColor.rgb = mix(vec3(0.3, 1.0, 0.0), vec3(0.0, 0.5, 0.2), vColorNoise);
data.baseColor *= 0.4 + vNoiseAmount;
data.baseColor *= vInstanceTintColor;
//data.baseColor.g = 0.0;
        `,
      },
      uniforms: (entity) => {
        return {
          uTime: (Date.now() % 10000) / 2000,
        };
      },
    },
  }),
});
world.add(grassEntity);

// Material with hooks
const sphereEntity = createEntity({
  transform: components.transform({ position: [0, 1, 0] }),
  geometry: components.geometry(icosphere({ radius: 1, subdivisions: 4 })),
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

${perlinNoiseGLSL}
        `,
        BEFORE_TRANSFORM: /* glsl */ `
vNoiseAmount = 0.5 + 0.5 * cnoise(position.xyz * 2.0 + vec3(uTime, 0.0, 0.0));
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
data.roughness = 0.1;
data.metallic = step(0.5, vNoiseAmount);
data.baseColor = mix(vec3(2.0, 0.4, 0.0), vec3(1.0), data.metallic);
// data.baseColor = vec3();
// data.metallic = 1.0;
        `,
      },
      uniforms: (entity) => {
        return {
          uTime: (Date.now() % 1000000) / 1000,
        };
      },
    },
  }),
});
world.add(sphereEntity);

// for (let i = 0; i < 10; i++) {
//   const torusEntity = createEntity({
//     transform: components.transform({
//       position: [0, 1, 0],
//       rotation: quat.fromAxisAngle(
//         quat.create(),
//         [0, 1, 0],
//         (i / 10) * Math.PI
//       ),
//     }),
//     geometry: components.geometry(torus({ radius: 1, minorRadius: 0.02 })),
//     material: components.material({
//       baseColor: [1, 1, 1, 1],
//       metallic: 1,
//       roughness: 0.15,
//       castShadows: true,
//       receiveShadows: true,
//     }),
//     boundingBoxHelper: components.boundingBoxHelper(),
//   });
//   world.add(torusEntity);
// }

// Add skybox with helper for skybox renderer system
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

// Add light with helper for helper renderer system
const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [2, 2, 2],
    rotation: quatFromPointToPoint(
      quat.create(),
      [2, 2, 2],
      [0, 0, 0],
      [0, 1, 0]
    ),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 5,
    castShadows: true,
  }),
  lightHelper: true,
});
world.add(directionalLightEntity);

// Add segment geometry for line renderer system
const lineGeometry = { positions: [], vertexColors: [], count: 0 };

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
    lineGeometry.positions.push(prevPos);
    lineGeometry.vertexColors.push([1, 1, 0, 1]);
    lineGeometry.positions.push([x, y, z]);
    lineGeometry.vertexColors.push([1, 0, 0, 1]);
  }
  prevPos = [x, y, z];
}
lineGeometry.count = lineGeometry.positions.length / 2;
const linesEntity = createEntity({
  geometry: components.geometry(lineGeometry),
  material: components.material({
    type: "line",
    baseColor: [1, 1, 1, 1],
    lineWidth: 20,
  }),
  transform: components.transform(),
});
world.add(linesEntity);

// Load glTF
const scene = await loaders.gltf(
  getURL("assets/models/buster-drone/buster-drone-etc1s-draco.glb"),
  {
    ctx,
    dracoOptions: { transcoderPath: getURL("assets/decoders/draco/") },
    basisOptions: { transcoderPath: getURL("assets/decoders/basis/") },
  }
);
const sceneEntities = scene[0].entities;
const root = sceneEntities[0];
root.transform.scale ||= [1, 1, 1];
vec3.scale(root.transform.scale, 0.005);
vec3.add(root.transform.position, [0, 0.55, 0]);
world.entities.push(...sceneEntities);

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
    (renderer) => renderer.type == "standard-renderer"
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
  ].map((value) => ({ name: value || "No debug", value }))
);
gui.addColumn("Camera");
gui.addRadioList(
  "Tone Map",
  cameraEntity.camera,
  "toneMap",
  ["none", ...Object.keys(SHADERS.toneMap)].map((value) => ({
    name: value,
    value: value === "none" ? null : value.toLowerCase(),
  }))
);

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerWidth;
  ctx.set({ pixelRatio, width, height });
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

let prevTime = Date.now();

ctx.frame(() => {
  const now = Date.now();
  const deltaTime = (now - prevTime) / 1000;
  prevTime = now;

  renderEngine.update(world.entities, deltaTime);
  renderEngine.render(world.entities, cameraEntity);

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
