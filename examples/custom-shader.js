import createRenderer from "../index.js";
import createContext from "pex-context";
import { cube, icosphere } from "primitive-geometry";
import { quat, vec3, mat4 } from "pex-math";
import parseHdr from "parse-hdr";
import * as io from "pex-io";
import { getURL } from "./utils.js";

// TODO: missing shadow

const ctx = createContext();
const renderer = createRenderer(ctx);

const postProcessingCmp = renderer.postProcessing({
  fxaa: true,
});
const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    near: 1,
    far: 100,
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  renderer.orbiter({ position: [0, 2, 3] }),
  postProcessingCmp,
]);

renderer.add(cameraEntity);

const geom = icosphere({ radius: 1, subdivisions: 3 });

geom.uvs = new Float32Array((geom.positions.length / 3) * 2).map(
  (_, index) =>
    geom.positions[Math.round((index * 3) / 2 + (index % 2 === 0 ? 2 : 0))]
);

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
const glslNoise = /* glsl */ `
float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}
`;

//https://www.enkisoftware.com/devlogpost-20150131-1-Normal-generation-in-the-pixel-shader

const vertDefHook = /* glsl */ `uniform mat4 uProjectionMatrix;`;
const vertDefMod = /* glsl */ `
uniform mat4 uProjectionMatrix;
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
${glslNoise}`;

const vertDisplaceHook = /* glsl */ `positionView = uViewMatrix * uModelMatrix * position;`;
const vertDisplaceMod = /* glsl */ `
position.xyz += uAmplitude * normalize(position.xyz) * noise(uFrequency * vec3(position.x + uTime, position.y, position.z));
positionView = uViewMatrix * uModelMatrix * position;`;

const vertDisplaceMatHook = /* glsl */ `vPositionWorld = vec3(uModelMatrix * position);`;
const vertDisplaceMatMod = /* glsl */ `
position.xyz += uAmplitude * normalize(position.xyz) * noise(uFrequency * vec3(position.x + uTime, position.y, position.z));
vPositionWorld = vec3(uModelMatrix * position);`;

const depthFragDefHook = /* glsl */ `varying vec3 vPositionView;`;
const depthFragDefMod = /* glsl */ `
varying vec3 vPositionView;
uniform mat4 uInverseCameraViewMatrix;
uniform mat4 uInverseLightViewMatrix;
`;

const depthFragHook = /* glsl */ `getBaseColor(data);`;
const depthFragMod = /* glsl */ `
getBaseColor(data);
vec3 positionWorld = vec3(uInverseLightViewMatrix * vec4(vPositionView, 1.0));
float mask = length(positionWorld) - length(vec3(0.5));
mask = fract(mask * 5.0);
if (vTexCoord0.y > 0.0) {
  if (mask > 0.5) {
    discard;
  }
}
`;
const prePassDepthFragMod = /* glsl */ `
getBaseColor(data);
vec3 positionWorld = vec3(uInverseCameraViewMatrix * vec4(vPositionView, 1.0));
float mask = length(positionWorld) - length(vec3(0.5));
mask = fract(mask * 5.0);
if (vTexCoord0.y > 0.0) {
  // can't make it work with the mask and prepass
  // if (mask > 0.5) {
    discard;
  // }
}
`;

const fragDefHook = /* glsl */ `void main() {`;
const fragDefMod = /* glsl */ `
vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
`;

const fragHook = /* glsl */ `data.linearRoughness = data.roughness * data.roughness;`;
const fragMod = /* glsl */ `float mask = length(data.positionWorld) - length(vec3(0.5));
mask = fract(mask * 5.0);
float origMask = mask;
mask = step(mask, 0.5);
data.diffuseColor = vec3(mask) * hsv2rgb(vec3(fract(origMask * 2.0), 1.0, 0.5));
data.emissiveColor = 5.0 * data.diffuseColor;
data.f0 = vec3(1.0 - mask) * vec3(1.0, 1.0, 0.9);
data.roughness = mask;
data.linearRoughness = data.roughness * data.roughness;
vec3 dFdxPos = dFdx( data.positionWorld );
vec3 dFdyPos = dFdy( data.positionWorld );
data.normalWorld = normalize( cross(dFdxPos, dFdyPos));
data.normalView = uNormalMatrix * data.normalWorld;
data.linearRoughness = data.roughness * data.roughness;`;

const fragOutHook = /* glsl */ `gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);`;
const fragOutMod = /* glsl */ `
if (vTexCoord0.y > 0.0) {
  if (mask < 0.5) {
    color = data.normalView * 0.5 + 0.5;
  } else {
    discard;
  }
  color = pow(color, vec3(2.2));
}
gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);
`;

const vert = /* glsl */ `
#ifdef DEPTH_PRE_PASS_ONLY
${renderer.shaders.pipeline.depthPrePass.vert
  .replace(vertDefHook, vertDefMod)
  .replace(vertDisplaceHook, vertDisplaceMod)}
#elif defined DEPTH_PASS_ONLY
${renderer.shaders.pipeline.depthPass.vert
  .replace(vertDefHook, vertDefMod)
  .replace(vertDisplaceHook, vertDisplaceMod)}
#else
${renderer.shaders.pipeline.material.vert
  .replace(vertDefHook, vertDefMod)
  .replace(vertDisplaceMatHook, vertDisplaceMatMod)}
#endif
`;
const frag = /* glsl */ `
#ifdef DEPTH_PRE_PASS_ONLY
${renderer.shaders.pipeline.depthPrePass.frag
  .replace(depthFragDefHook, depthFragDefMod)
  .replace(depthFragHook, prePassDepthFragMod)}
#elif defined DEPTH_PASS_ONLY
${renderer.shaders.pipeline.depthPass.frag
  .replace(depthFragDefHook, depthFragDefMod)
  .replace(depthFragHook, depthFragMod)}
#else
${renderer.shaders.pipeline.material.frag
  .replace(fragDefHook, fragDefMod)
  .replace(fragHook, fragMod)
  .replace(fragOutHook, fragOutMod)}
#endif
`;

const sphereGeometryCmp = renderer.geometry(geom);
const sphereMaterialCmp = renderer.material({
  baseColor: [1, 0, 0, 1],
  metallic: 0,
  roughness: 0.1,
  castShadows: true,
  receiveShadows: true,
  vert,
  frag,
  uniforms: { uTime: 0 },
  cullFace: false,
});
const sphereEntity = renderer.entity([sphereGeometryCmp, sphereMaterialCmp]);
renderer.add(sphereEntity);

const floorEntity = renderer.entity([
  renderer.transform({ position: [0, -2, 0] }),
  renderer.geometry(cube({ sx: 8, sy: 0.1, sz: 4 })),
  renderer.material({
    receiveShadows: true,
  }),
]);
renderer.add(floorEntity);

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1],
  }),
]);
renderer.add(skyboxEntity);

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()]);
renderer.add(reflectionProbeEntity);
(async () => {
  // const buffer = await io.loadArrayBuffer(getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`))
  const buffer = await io.loadArrayBuffer(
    getURL(`assets/envmaps/Road_to_MonumentValley/Road_to_MonumentValley.hdr`)
  );

  const hdrImg = parseHdr(buffer);
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true,
  });

  skyboxEntity.getComponent("Skybox").set({ texture: panorama });
  reflectionProbeEntity.getComponent("ReflectionProbe").set({ dirty: true });

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
})();

const sunEntity = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([-1, -1, 0])
    ),
  }),
  renderer.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 2,
    castShadows: true,
  }),
]);
renderer.add(sunEntity);

const start = Date.now();
ctx.frame(() => {
  const now = Date.now() * 0.0005;

  const skybox = skyboxEntity.getComponent("Skybox");
  skybox.set({
    sunPosition: [1 * Math.cos(now), 1, 1 * Math.sin(now)],
  });

  sphereMaterialCmp.set({
    uniforms: {
      uTime: (Date.now() - start) / 1000,
      uFrequency: 2.5,
      uAmplitude: 0.5,
      uInverseCameraViewMatrix:
        cameraEntity.getComponent("Camera").inverseViewMatrix,
      uInverseLightViewMatrix: mat4.invert(
        mat4.copy(sunEntity.getComponent("DirectionalLight")._viewMatrix)
      ),
    },
  });

  renderer.draw();
});
