import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
  entity,
} from "../index.js";

import createContext from "pex-context";
import { vec3, quat, mat4 } from "pex-math";
import * as io from "pex-io";
import createGUI from "pex-gui";
import random from "pex-random";
import {
  cube,
  torus,
  sphere,
  icosphere,
  plane,
  cone,
} from "primitive-geometry";
import parseHdr from "parse-hdr";
import { getURL } from "./utils.js";

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

random.seed(0);

const ctx = createContext();

window.addEventListener("resize", () => {
  ctx.set({
    pixelRatio: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  cameraEntity.camera.aspect = window.innerWidth / window.innerHeight;
  cameraEntity.camera.dirty = true;
});

const world = createWorld();

const gui = createGUI(ctx);
gui.addColumn("Settings");
gui.addFPSMeeter();

gui.addButton("Set camera pos/target", () => {
  vec3.set(cameraEntity.transform.position, [3, 1, 1]);
  vec3.set(cameraEntity.orbiter.target, [2, 0, 0]);
});

gui.addButton("Set camera pos/dir", () => {
  vec3.set(cameraEntity.transform.position, [3, 1, 1]);
  quat.targetTo(
    cameraEntity.transform.rotation,
    [3, 1, 1],
    [0, 1, 2],
    [0, 1, 0]
  );
});

const opts = {
  pointLightPosition: [0, 0.2, 0],
  directionalLightPosition: [2, 2, 2],
};

gui.addParam(
  "Point light pos",
  opts,
  "pointLightPosition",
  {
    min: -5,
    max: 5,
  },
  (pos) => {
    pointLightEntity.transform = {
      position: pos,
    };
  }
);

gui.addParam(
  "Directional light pos",
  opts,
  "directionalLightPosition",
  {
    min: -3,
    max: 3,
  },
  (pos) => {
    vec3.set(directionalLightEntity.transform.position, pos);
    quatFromPointToPointFacingZPos(
      directionalLightEntity.transform.rotation,
      pos,
      [0, 0, 0],
      [0, 1, 0]
    );
    directionalLightEntity.transform.dirty = true;
  }
);

const cameraEntity = createEntity({
  transform: transform({
    position: [1, 1, 5],
    rotation: quat.create(),
  }),
  camera: camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter({
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity);

gui.addParam("Camera pos", cameraEntity.transform, "position", {
  min: -5,
  max: 5,
});

gui.addParam("Orbiter Distance", cameraEntity.orbiter, "distance", {
  min: 0.5,
  max: 10,
});

gui.addParam("Orbiter Lon", cameraEntity.orbiter, "lon", {
  min: -360,
  max: 360,
});

gui.addParam("Prboter Lat", cameraEntity.orbiter, "lat", {
  min: -89.5,
  max: 89.5,
});

const tempVec1 = vec3.create();
const tempVec2 = vec3.create();

const tempMat41 = mat4.create();

function quatFromPointToPointFacingZPos(q, eye, target, up) {
  let forwardX = target[0] - eye[0];
  let forwardY = target[1] - eye[1];
  let forwardZ = target[2] - eye[2];

  let upX = up[0];
  let upY = up[1];
  let upZ = up[2];

  let len = forwardX * forwardX + forwardY * forwardY + forwardZ * forwardZ;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
    forwardX *= len;
    forwardY *= len;
    forwardZ *= len;
  }

  let rightX = upY * forwardZ - upZ * forwardY;
  let rightY = upZ * forwardX - upX * forwardZ;
  let rightZ = upX * forwardY - upY * forwardX;

  const m = tempMat41;
  m[0] = rightX;
  m[1] = rightY;
  m[2] = rightZ;
  m[3] = 0.0;
  m[4] = upX;
  m[5] = upY;
  m[6] = upZ;
  m[7] = 0.0;
  m[8] = forwardX;
  m[9] = forwardY;
  m[10] = forwardZ;
  m[11] = 0.0;
  m[12] = 0.0;
  m[13] = 0.0;
  m[14] = 0.0;
  m[15] = 1.0;
  return quat.fromMat4(q, m);
}

const floorEntity = createEntity({
  name: "floor",
  transform: transform({
    position: [0, -1.1, 0],
  }),
  geometry: geometry(cube({ sx: 15, sy: 0.2, sz: 15, nx: 10, ny: 1, nz: 10 })),
  material: material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 1.0,
    castShadows: true,
    receiveShadows: true,
  }),
});
floorEntity.geometry.bounds = [
  [-15, -0.2, -15],
  [15, 0.2, 15],
];
world.add(floorEntity);

//src: https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
const perlinNoiseGLSL = /*glsl*/ `
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

const grassHeight = 1.2;
const coneGeometry = cone({
  height: grassHeight,
  radius: 0.05,
  nx: 4,
});
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
  transform: transform({
    position: [0, -1, 0],
  }),
  geometry: geometry({
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
  material: material({
    baseColor: [0.2, 0.8, 0, 1],
    metallic: 0.2,
    roughness: 0.6,
    castShadows: true,
    receiveShadows: true,
    hooks: {
      vert: {
        DECLARATIONS_END: /*glsl*/ `
          ${perlinNoiseGLSL}
          uniform float uTime;
          varying float vNoiseAmount;
          varying float vColorNoise;
          varying vec3 vInstanceTintColor;
          attribute vec3 aInstanceTintColor;
        `,
        BEFORE_TRANSFORM: /*glsl*/ `
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
        DECLARATIONS_END: /*glsl*/ `
        varying float vNoiseAmount;
        varying float vColorNoise;
        varying vec3 vInstanceTintColor;
        `,
        BEFORE_TEXTURES: /*glsl*/ `
          vec3 dX = dFdx(data.positionView);
          vec3 dY = dFdy(data.positionView);
          // data.normalView = normalize(cross(dX, dY));
          // data.normalWorld = vec3(data.inverseViewMatrix * vec4(data.normalView, 0.0));
        `,
        BEFORE_LIGHTING: /*glsl*/ `
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
const sphereEntity = createEntity({
  name: "sphereEntity",
  transform: transform({
    position: [0, 1, 0],
  }),
  geometry: geometry(icosphere({ radius: 1, subdivisions: 4 })),
  material: material({
    baseColor: [1, 0, 1, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
    hooks: {
      vert: {
        DECLARATIONS_END: /*glsl*/ `
          ${perlinNoiseGLSL}
          uniform float uTime;
          varying float vNoiseAmount;
        `,
        BEFORE_TRANSFORM: /*glsl*/ `
          vNoiseAmount = 0.5 + 0.5 * cnoise(position.xyz * 2.0 + vec3(uTime, 0.0, 0.0));
          position.xyz += normal.xyz * vNoiseAmount;
        `,
      },
      frag: {
        DECLARATIONS_END: /*glsl*/ `
        varying float vNoiseAmount;
        `,
        BEFORE_TEXTURES: /*glsl*/ `
          vec3 dX = dFdx(data.positionView);
          vec3 dY = dFdy(data.positionView);
          data.normalView = normalize(cross(dX, dY));
          data.normalWorld = vec3(data.inverseViewMatrix * vec4(data.normalView, 0.0));
        `,
        BEFORE_LIGHTING: /*glsl*/ `
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

const cameraTargetEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(sphere({ radius: 0.2 })),
  material: material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.2,
    // castShadows: true,
    receiveShadows: true,
  }),
});
world.add(cameraTargetEntity);

const orbiterTargetEntity = createEntity({
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry(sphere({ radius: 0.2 })),
  material: material({
    baseColor: [1, 0.5, 0, 1],
    metallic: 0,
    roughness: 0.2,
    // castShadows: true,
    receiveShadows: true,
  }),
});
world.add(orbiterTargetEntity);

const redCubeEntity = createEntity({
  transform: transform({
    position: [2, 0, 0],
  }),
  geometry: geometry(cube({ sx: 0.4 })),
  material: material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
// world.add(redCubeEntity);

const greenCubeEntity = createEntity({
  transform: transform({
    position: [0, 2, 0],
  }),
  geometry: geometry(cube({ sx: 0.4 })),
  material: material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
// world.add(greenCubeEntity);

const blueCubeEntity = createEntity({
  transform: transform({
    position: [0, 0, 2],
  }),
  geometry: geometry(cube({ sx: 0.4 })),
  material: material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
// world.add(blueCubeEntity);

for (let i = 0; i < 10; i++) {
  const torusEntity = createEntity({
    transform: transform({
      position: [0, 1, 0],
      rotation: quat.fromAxisAngle(
        quat.create(),
        [0, 1, 0],
        (i / 10) * Math.PI
      ),
    }),
    geometry: geometry(torus({ radius: 1, minorRadius: 0.02 })),
    material: material({
      baseColor: [1, 1, 1, 1],
      metallic: 1,
      roughness: 0.15,
      castShadows: true,
      receiveShadows: true,
    }),
    boundingBoxHelper: components.boundingBoxHelper(),
  });
  // world.add(torusEntity);
}

const hdrImg = parseHdr(
  await io.loadArrayBuffer(
    getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
    // getURL(`assets/envmaps/garage/garage.hdr`)
  )
);
const envMap = ctx.texture2D({
  data: hdrImg.data,
  width: hdrImg.shape[0],
  height: hdrImg.shape[1],
  pixelFormat: ctx.PixelFormat.RGBA32F,
  encoding: ctx.Encoding.Linear,
  flipY: true,
});

const skyboxEntity = createEntity({
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true,
    envMap,
  }),
});
world.add(skyboxEntity);

const reflectionProbeEnt = createEntity({
  reflectionProbe: reflectionProbe(),
});
world.add(reflectionProbeEnt);

const directionalLightEntity = createEntity({
  transform: transform({
    position: [2, 2, 2],
    rotation: quatFromPointToPointFacingZPos(
      quat.create(),
      [2, 2, 2],
      [0, 0, 0],
      [0, 1, 0]
    ),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 5,
    castShadows: true,
  }),
  lightHelper: components.lightHelper({ color: [1, 0, 0, 1] }),
});
world.add(directionalLightEntity);

const axis = [
  [
    [0.2, 0, 0],
    [1, 0, 0, 1],
  ],
  [
    [0, 0.2, 0],
    [0, 1, 0, 1],
  ],
  [
    [0, 0, 0.2],
    [0, 0, 1, 1],
  ],
].forEach(([pos, color]) => {
  const ent = createEntity({
    transform: transform({
      position: pos,
    }),
    geometry: cube({ sx: pos[0] + 0.1, sy: pos[1] + 0.1, sz: pos[2] + 0.1 }),
    material: material({ unlit: true, baseColor: color }),
  });
  ent.transform.parent = directionalLightEntity.transform;
  // world.add(ent);
});

const pointLightEntity = createEntity({
  transform: transform({
    position: [2.2, 2.2, 2.2],
  }),
  pointLight: pointLight({
    color: [1, 1, 1, 1], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 0.2,
    castShadows: true,
  }),
  // lightHelper: components.lightHelper({ color: [1, 0, 0, 1] }),
});
// world.add(pointLightEntity);

const segmentsGeom = {
  positions: [],
  vertexColors: [],
  count: 0,
};

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
    segmentsGeom.positions.push(prevPos);
    segmentsGeom.vertexColors.push([1, 0, 1, 0.5]);
    segmentsGeom.positions.push([x, y, z]);
    segmentsGeom.vertexColors.push([1, 0, 1, 0.5]);
  }
  prevPos = [x, y, z];
}
segmentsGeom.count = segmentsGeom.positions.length / 2;
const segmentsEntity = createEntity({
  geometry: components.geometry(segmentsGeom),
  material: components.material({ type: "segments", baseColor: [1, 1, 1, 1] }),
  transform: components.transform(),
});
// world.add(segmentsEntity);

async function loadScene() {
  console.log("loadScene loaders.gltf");
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
    console.log("loadScene Scene", scene);
    const sceneEntities = scene[0].entities;
    const root = sceneEntities[0];
    if (!root.transform.scale) {
      root.transform.scale = [1, 1, 1];
    }
    vec3.scale(root.transform.scale, 0.005);
    vec3.add(root.transform.position, [0, 0.55, 0]);

    world.entities.push(...sceneEntities);
    sceneEntities.forEach((e) => {
      if (e.material) {
        e.material.depthTest = true;
        e.material.depthWrite = true;
        e.material.needsPipelineUpdate = true;
      }
    });
  } catch (e) {
    console.error(e);
  }
}

// loadScene();

let prevTime = Date.now();
const renderEngine = createRenderEngine({ ctx });

let pointLightShadowmapPreview;
let directionalLightShadowmapPreview;

let reflectionProbeTexturePreview = null;

ctx.frame(() => {
  const now = Date.now();
  const deltaTime = (now - prevTime) / 1000;
  prevTime = now;

  const cameraEntity = world.entities.find((e) => e.camera);

  renderEngine.update(world.entities, deltaTime);
  renderEngine.render(world.entities, cameraEntity);

  const pos = [0, 0, -cameraEntity.orbiter._orbiter.distance];
  vec3.multMat4(pos, cameraEntity.camera.invViewMatrix);
  cameraTargetEntity.transform.position = pos;
  cameraTargetEntity.transform.dirty = true;

  orbiterTargetEntity.transform.position = vec3.add(
    [...cameraEntity.orbiter.target],
    [0, 0.2, 0]
  );
  orbiterTargetEntity.transform.dirty = true;

  if (!cameraEntity.camera.logged) {
    cameraEntity.camera.logged = true;
    console.log(
      "rotation",
      cameraEntity.camera.viewMatrix,
      mat4.lookAt(
        mat4.create(),
        cameraEntity.transform.position,
        [0, 1, 0],
        [0, 0, 0]
      )
    );
  }

  if (
    !reflectionProbeTexturePreview &&
    reflectionProbeEnt?._reflectionProbe?._reflectionMap
  ) {
    reflectionProbeTexturePreview = gui.addTexture2D(
      "ReflectionMap",
      reflectionProbeEnt._reflectionProbe._reflectionMap
    );
  }

  if (!pointLightShadowmapPreview) {
    pointLightShadowmapPreview = true;
    // pointLightShadowmapPreview = gui.addTextureCube(
    //   "PointLightShadowmap",
    //   pointLightEntity.pointLight._shadowCubemap
    // );
    if (
      directionalLightEntity.directionalLight._shadowMap &&
      !directionalLightShadowmapPreview
    ) {
      directionalLightShadowmapPreview = gui.addTexture2D(
        "DirectionalLightShadowmap",
        directionalLightEntity.directionalLight._shadowMap
      );
    }
    const standardRenderer = renderEngine.renderers.find(
      (renderer) => renderer.type == "standard-renderer"
    );
    console.log(
      "standardRenderer",
      standardRenderer,
      renderEngine,
      renderEngine.renderers[0]
    );
    gui.addColumn("Renderer");
    const options = [
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

      "ao",
      "vNormalView",
      "vNormalWorld",
    ].map((value) => {
      return { name: value || "No debug", value };
    });
    gui.addRadioList("Debug", standardRenderer, "debugRender", options);
  }

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
