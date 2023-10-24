import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";
import createContext from "pex-context";
import { quat, mat4, vec3, vec4 } from "pex-math";
import createGUI from "pex-gui";
import * as io from "pex-io";
import merge from "geom-merge";
import parseObj from "geom-parse-obj";
import centerAndNormalize from "geom-center-and-normalize";

import { cube, sphere } from "primitive-geometry";
import { getURL } from "./utils.js";

const TEMP_MAT4 = mat4.create();
const Y_UP = Object.freeze([0, 1, 0]);

function mat4fromPointToPoint(
  a,
  [eyex, eyey, eyez],
  [targetx, targety, targetz],
  [upx, upy, upz] = Y_UP,
) {
  let z0 = targetx - eyex;
  let z1 = targety - eyey;
  let z2 = targetz - eyez;

  let len = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);

  if (len) {
    len = 1 / len;
    z0 *= len;
    z1 *= len;
    z2 *= len;
  } else {
    z0 = 0;
    z1 = 0;
    z2 = 1;
  }

  let x0 = upy * z2 - upz * z1;
  let x1 = upz * z0 - upx * z2;
  let x2 = upx * z1 - upy * z0;

  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);

  if (len) {
    len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
  } else {
    x0 = 1;
    x1 = 0;
    x2 = 0;
  }

  upx = z1 * x2 - z2 * x1;
  upy = z2 * x0 - z0 * x2;
  upz = z0 * x1 - z1 * x0;

  len = Math.sqrt(upx * upx + upy * upy + upz * upz);

  if (len) {
    len = 1 / len;
    upx *= len;
    upy *= len;
    upz *= len;
  } else {
    upx = 0;
    upy = 1;
    upz = 0;
  }

  a[0] = x0;
  a[1] = x1;
  a[2] = x2;
  a[3] = 0;
  a[4] = upx;
  a[5] = upy;
  a[6] = upz;
  a[7] = 0;
  a[8] = z0;
  a[9] = z1;
  a[10] = z2;
  a[11] = 0;
  a[12] = 0;
  a[13] = 0;
  a[14] = 0;
  a[15] = 1;
  return a;
}

function fromPointToPoint(a, eye, target, up) {
  return quat.fromMat4(a, mat4fromPointToPoint(TEMP_MAT4, eye, target, up));
}

const ctx = createContext({
  canvas: document.querySelector("canvas"),
  pixelRatio: devicePixelRatio,
});

const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const gui = createGUI(ctx);

const W = window.innerWidth * devicePixelRatio;
const H = window.innerHeight * devicePixelRatio;

const helperEntity = createEntity({
  transform: components.transform({ scale: [2, 2, 2] }),
  axesHelper: components.axesHelper(),
});
world.add(helperEntity);

const targetX = 0.5;
const targetY = 0.25;
const cameraEntity = createEntity({
  transform: components.transform({ position: [targetX, targetY, 2] }),
  camera: components.camera({
    viewport: [0, 0, W, H],
  }),
  orbiter: components.orbiter({
    target: [targetX, targetY, 0],
  }),
  // cameraHelper: true,
});
world.add(cameraEntity);

const skybox = createEntity({
  transform: components.transform(),
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: false,
  }),
});
world.add(skybox);

const reflectionProbe = createEntity({
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbe);
const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  directionalLight: components.directionalLight({
    intensity: 2,
    castShadows: false,
  }),
});
world.add(directionalLightEntity);

// Floor
const floorEntity = createEntity({
  transform: components.transform({
    position: [0, -0.4, 0],
  }),
  geometry: components.geometry(cube({ sx: 7, sy: 0.1, sz: 5 })),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    unlit: true,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(floorEntity);

// Geometries
const offset = 0.2;
const axisSize = offset * 0.45;
const z = offset * 0.8;
const cubeX = cube({ sx: axisSize, sy: axisSize * 0.05, sz: axisSize * 0.05 });
cubeX.positions = cubeX.positions.map((p, i) =>
  i % 3 === 0 ? p + axisSize / 2 : p,
);
cubeX.vertexColors = Float32Array.from(
  { length: (cubeX.positions.length / 3) * 4 },
  (_, i) => ([0, 3].includes(i % 4) ? 1 : 0),
);
const cubeY = cube({ sx: axisSize * 0.05, sy: axisSize, sz: axisSize * 0.05 });
cubeY.positions = cubeY.positions.map((p, i) =>
  i % 3 === 1 ? p + axisSize / 2 : p,
);
cubeY.vertexColors = Float32Array.from(
  { length: (cubeY.positions.length / 3) * 4 },
  (_, i) => ([1, 3].includes(i % 4) ? 1 : 0),
);
const cubeZ = cube({ sx: axisSize * 0.05, sy: axisSize * 0.05, sz: axisSize });
cubeZ.positions = cubeZ.positions.map((p, i) =>
  i % 3 === 2 ? p + axisSize / 2 : p,
);
cubeZ.vertexColors = Float32Array.from(
  { length: (cubeZ.positions.length / 3) * 4 },
  (_, i) => ([2, 3].includes(i % 4) ? 1 : 0),
);
const suzanne = parseObj(
  await io.loadText(getURL(`assets/models/suzanne/suzanne.obj`)),
)[0];
suzanne.positions = centerAndNormalize(suzanne.positions);
suzanne.positions = suzanne.positions.map((p) => p * 0.1);
suzanne.uvs = new Float32Array((suzanne.positions.length / 3) * 2);
suzanne.vertexColors = Float32Array.from(
  { length: suzanne.positions.length * 4 },
  (_, i) => ([1, 2, 3].includes(i % 4) ? 1 : 0),
);

delete suzanne.name;

const baseEntity = {
  geometry: components.geometry(merge([cubeX, cubeY, cubeZ, suzanne])),
  material: components.material(),
  // boundingBoxHelper: components.boundingBoxHelper(),
};

const base = createEntity({
  transform: components.transform({}),
  material: components.material({}),
  ...baseEntity,
});
// world.add(base);
const baseTargetEntity = {
  geometry: components.geometry(sphere({ radius: 0.025 })),
  // boundingBoxHelper: components.boundingBoxHelper(),
};

const UPS = [[1, 0, 0], Y_UP, [0, 0, 1], [1, 1, 1]];
const MATERIALS = [
  components.material({ baseColor: [1, 0.5, 0.5, 1], receiveShadows: false }),
  components.material({ baseColor: [0.5, 1, 0.5, 1], receiveShadows: false }),
  components.material({ baseColor: [0.5, 0.5, 1, 1], receiveShadows: false }),
  components.material({ baseColor: [1, 1, 0.5, 1], receiveShadows: false }),
];

const labels = [];
const labelsPositions = [];

UPS.forEach((up, index) => {
  const y = (UPS.length - 1) * offset - index * offset;
  let column = 0;

  // LOOK AT
  const lookAtPosition = [0, y, z];
  const lookAtTarget = [0, y - offset / 2, 0];
  const axesLookAt = createEntity({
    transform: components.transform({
      position: lookAtPosition,
      rotation: quat.fromMat4(
        quat.create(),
        mat4.lookAt(mat4.create(), lookAtPosition, lookAtTarget, up),
      ),
    }),
    ...baseEntity,
  });
  world.add(axesLookAt);
  const sphereLookAt = createEntity({
    transform: components.transform({ position: [...lookAtTarget] }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(sphereLookAt);
  labels[index * 8 + column] = `Look at\n${vec3.toString(up)}`;
  labelsPositions.push(lookAtPosition);
  column++;

  // TARGET TO
  const targetToPosition = [offset * column, y, z];
  const targetToTarget = [offset * column, y - offset / 2, 0];
  const axesTargetTo = createEntity({
    transform: components.transform({
      position: targetToPosition,
      rotation: quat.targetTo(
        quat.create(),
        targetToPosition,
        targetToTarget,
        up,
      ),
    }),
    ...baseEntity,
  });
  world.add(axesTargetTo);
  const sphereTargetTo = createEntity({
    transform: components.transform({ position: targetToTarget }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(sphereTargetTo);
  labels[index * 8 + column] = `Target to\n${vec3.toString(up)}`;
  labelsPositions.push(targetToPosition);
  column++;

  // FROM POINT TO POINT
  const ptpPosition = [offset * column, y, z];
  const ptpTarget = [offset * column, y - offset / 2, 0];

  const axesFromPtp = createEntity({
    transform: components.transform({
      position: ptpPosition,
      rotation: fromPointToPoint(quat.create(), ptpPosition, ptpTarget, up),
    }),
    ...baseEntity,
  });
  world.add(axesFromPtp);
  const spherePtp = createEntity({
    transform: components.transform({ position: ptpTarget }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(spherePtp);
  labels[index * 8 + column] = `From PTP\n${vec3.toString(up)}`;
  labelsPositions.push(ptpPosition);
  column++;

  // FROM TO
  const fromToPosition = [offset * column, y, z];
  const fromToTarget = [offset * column, y - offset / 2, 0];
  const axesFromTo = createEntity({
    transform: components.transform({
      position: fromToPosition,
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize(vec3.sub([...fromToTarget], fromToPosition)),
      ),
    }),
    ...baseEntity,
  });
  world.add(axesFromTo);
  const sphereTo = createEntity({
    transform: components.transform({ position: fromToTarget }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(sphereTo);
  labels[index * 8 + column] = `From to\n${vec3.toString(up)}`;
  labelsPositions.push(fromToPosition);
  column++;

  // return;

  // BACK
  const lookAtPositionBack = [offset * column, y, z];
  const lookAtTargetBack = [offset * column, y + offset / 2, z * 2];
  const axesLookAtBack = createEntity({
    transform: components.transform({
      position: lookAtPositionBack,
      rotation: quat.fromMat4(
        quat.create(),
        mat4.lookAt(mat4.create(), lookAtPositionBack, lookAtTargetBack, up),
      ),
    }),
    ...baseEntity,
  });
  world.add(axesLookAtBack);
  const sphereLookAtBack = createEntity({
    transform: components.transform({ position: [...lookAtTargetBack] }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(sphereLookAtBack);
  labels[index * 8 + column] = `Look at\n${vec3.toString(up)}`;
  labelsPositions.push(lookAtPositionBack);
  column++;

  const targetToPositionBack = [offset * column, y, z];
  const targetToTargetBack = [offset * column, y + offset / 2, z * 2];
  const axesTargetToBack = createEntity({
    transform: components.transform({
      position: targetToPositionBack,
      rotation: quat.targetTo(
        quat.create(),
        targetToPositionBack,
        targetToTargetBack,
        up,
      ),
    }),
    ...baseEntity,
  });
  world.add(axesTargetToBack);
  const sphereTargetToBack = createEntity({
    transform: components.transform({ position: targetToTargetBack }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(sphereTargetToBack);
  labels[index * 8 + column] = `Target to\n${vec3.toString(up)}`;
  labelsPositions.push(targetToPositionBack);
  column++;

  const ptpPositionBack = [offset * column, y, z];
  const ptpTargetBack = [offset * column, y + offset / 2, z * 2];
  const axesFromPtpBack = createEntity({
    transform: components.transform({
      position: ptpPositionBack,
      rotation: fromPointToPoint(
        quat.create(),
        ptpPositionBack,
        ptpTargetBack,
        up,
      ),
    }),
    ...baseEntity,
  });
  world.add(axesFromPtpBack);
  const spherePtpBack = createEntity({
    transform: components.transform({ position: ptpTargetBack }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(spherePtpBack);
  labels[index * 8 + column] = `From PTP\n${vec3.toString(up)}`;
  labelsPositions.push(ptpPositionBack);
  column++;

  const fromToPositionBack = [offset * column, y, z];
  const fromToTargetBack = [offset * column, y + offset / 2, z * 2];
  const axesFromToBack = createEntity({
    transform: components.transform({
      position: fromToPositionBack,
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize(vec3.sub([...fromToTargetBack], fromToPositionBack)),
      ),
    }),
    ...baseEntity,
  });
  world.add(axesFromToBack);
  const sphereToBack = createEntity({
    transform: components.transform({ position: fromToTargetBack }),
    ...baseTargetEntity,
    material: MATERIALS[index],
  });
  world.add(sphereToBack);
  labels[index * 8 + column] = `From to\n${vec3.toString(up)}`;
  labelsPositions.push(fromToPositionBack);
  column++;
});

const labelsDiv = labels.map((label) => {
  const div = document.createElement("div");
  div.innerText = label;
  document.body.appendChild(div);
  Object.assign(div.style, {
    position: "absolute",
    color: "black",
    backgroundColor: `rgba(255, 255, 255, 0.2)`,
    transform: `translate3d(-50%, 0, 0)`,
    fontSize: "10px",
    top: 0,
    left: 0,
    zIndex: 1,
    userSelect: "none",
  });
  return div;
});

const TEMP_VEC4 = [0, 0, 0, 0];

function cameraProject(a, camera) {
  const [x, y, width, height] = camera.viewport;

  vec4.set(TEMP_VEC4, a);
  TEMP_VEC4[3] = 1;

  vec4.multMat4(
    TEMP_VEC4,
    mat4.mult([...camera.projectionMatrix], camera.viewMatrix),
  );

  const w = TEMP_VEC4[3];
  if (w !== 0) {
    TEMP_VEC4[0] = TEMP_VEC4[0] / w;
    TEMP_VEC4[1] = TEMP_VEC4[1] / w;
    TEMP_VEC4[2] = TEMP_VEC4[2] / w;
  }

  return [
    x + (TEMP_VEC4[0] + 1) * 0.5 * width,
    y + -(TEMP_VEC4[1] - 1) * 0.5 * height,
  ];
}

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((e) => e.camera),
  );

  const camera = world.entities.find((e) => e.camera).camera;
  labelsPositions.forEach((position, i) => {
    const [x, y] = cameraProject(position, camera);
    labelsDiv[i].style.left = `${x / devicePixelRatio}px`;
    labelsDiv[i].style.top = `${y / devicePixelRatio}px`;
  });

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (newModule) {
      // renderEngine.dispose()
      location.href = location.href;
    }
  });
}
