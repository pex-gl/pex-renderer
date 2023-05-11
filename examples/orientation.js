import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "../index.js";
import createContext from "pex-context";
import { quat, utils, mat4, vec3 } from "pex-math";
import createGUI from "pex-gui";
import merge from "geom-merge";

import { cube, sphere } from "primitive-geometry";

const TEMP_MAT4 = mat4.create();
const Y_UP = Object.freeze([0, 1, 0]);

function mat4fromPointToPoint(
  a,
  [eyex, eyey, eyez],
  [targetx, targety, targetz],
  [upx, upy, upz] = Y_UP
) {
  let z0 = targetx - eyex;
  let z1 = targety - eyey;
  let z2 = targetz - eyez;

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

  upx = z1 * x2 - z2 * x1;
  upy = z2 * x0 - z0 * x2;
  upz = z0 * x1 - z1 * x0;

  len = upx * upx + upy * upy + upz * upz;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    upx *= len;
    upy *= len;
    upz *= len;
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

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx);

const W = window.innerWidth * devicePixelRatio;
const H = window.innerHeight * devicePixelRatio;
const splitRatio = 0.5;

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

const offset = 0.2;
const axisSize = offset * 0.45;
const z = offset * 0.8;
const cubeX = cube({ sx: axisSize, sy: axisSize * 0.05, sz: axisSize * 0.05 });
cubeX.positions = cubeX.positions.map((p, i) =>
  i % 3 === 0 ? p + axisSize / 2 : p
);
cubeX.vertexColors = Float32Array.from(
  { length: (cubeX.positions.length / 3) * 4 },
  (_, i) => ([0, 3].includes(i % 4) ? 1 : 0)
);
const cubeY = cube({ sx: axisSize * 0.05, sy: axisSize, sz: axisSize * 0.05 });
cubeY.positions = cubeY.positions.map((p, i) =>
  i % 3 === 1 ? p + axisSize / 2 : p
);
cubeY.vertexColors = Float32Array.from(
  { length: (cubeY.positions.length / 3) * 4 },
  (_, i) => ([1, 3].includes(i % 4) ? 1 : 0)
);
const cubeZ = cube({ sx: axisSize * 0.05, sy: axisSize * 0.05, sz: axisSize });
cubeZ.positions = cubeZ.positions.map((p, i) =>
  i % 3 === 2 ? p + axisSize / 2 : p
);
cubeZ.vertexColors = Float32Array.from(
  { length: (cubeZ.positions.length / 3) * 4 },
  (_, i) => ([2, 3].includes(i % 4) ? 1 : 0)
);
const baseEntity = {
  geometry: components.geometry(merge([cubeX, cubeY, cubeZ])),
  material: components.material({ unlit: true }),
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
  boundingBoxHelper: components.boundingBoxHelper(),
};

const UPS = [[1, 0, 0], Y_UP, [0, 0, 1], [1, 1, 1]];
const MATERIALS = [
  components.material({ baseColor: [1, 0.5, 0.5, 1], receiveShadows: false }),
  components.material({ baseColor: [0.5, 1, 0.5, 1], receiveShadows: false }),
  components.material({ baseColor: [0.5, 0.5, 1, 1], receiveShadows: false }),
  components.material({ baseColor: [1, 1, 0.5, 1], receiveShadows: false }),
];

UPS.forEach((up, index) => {
  const y = index * offset;
  let colum = 0;

  // LOOK AT
  const lookAtPosition = [0, y, z];
  const lookAtTarget = [0, y - offset, 0];
  const axesLookAt = createEntity({
    transform: components.transform({
      position: lookAtPosition,
      rotation: quat.fromMat4(
        quat.create(),
        mat4.lookAt(mat4.create(), lookAtPosition, lookAtTarget, up)
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
  colum++;

  // TARGET TO
  const targetToPosition = [offset * colum, y, z];
  const targetToTarget = [offset * colum, y - offset, 0];
  const axesTargetTo = createEntity({
    transform: components.transform({
      position: targetToPosition,
      rotation: quat.targetTo(
        quat.create(),
        targetToPosition,
        targetToTarget,
        up
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
  colum++;

  // FROM POINT TO POINT
  const ptpPosition = [offset * colum, y, z];
  const ptpTarget = [offset * colum, y - offset, 0];
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
  colum++;

  // BACK
  const lookAtPositionBack = [offset * colum, y, z];
  const lookAtTargetBack = [offset * colum, y + offset, z * 2];
  const axesLookAtBack = createEntity({
    transform: components.transform({
      position: lookAtPositionBack,
      rotation: quat.fromMat4(
        quat.create(),
        mat4.lookAt(mat4.create(), lookAtPositionBack, lookAtTargetBack, up)
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
  colum++;

  const targetToPositionBack = [offset * colum, y, z];
  const targetToTargetBack = [offset * colum, y + offset, z * 2];
  const axesTargetToBack = createEntity({
    transform: components.transform({
      position: targetToPositionBack,
      rotation: quat.targetTo(
        quat.create(),
        targetToPositionBack,
        targetToTargetBack,
        up
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
  colum++;

  const ptpPositionBack = [offset * colum, y, z];
  const ptpTargetBack = [offset * colum, y + offset, z * 2];
  const axesFromPtpBack = createEntity({
    transform: components.transform({
      position: ptpPositionBack,
      rotation: fromPointToPoint(
        quat.create(),
        ptpPositionBack,
        ptpTargetBack,
        up
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
  colum++;
});

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((e) => e.camera)
  );

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
