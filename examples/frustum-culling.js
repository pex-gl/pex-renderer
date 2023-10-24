import {
  world as createWorld,
  entity as createEntity,
  renderGraph as createRenderGraph,
  resourceCache as createResourceCache,
  systems,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";
import { cube } from "primitive-geometry";

random.seed(0);

const State = {
  autoRotate: true,
  rotation: 0,
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });

const world = createWorld();
const renderGraph = createRenderGraph(ctx);
const resourceCache = createResourceCache(ctx);

// Entities
const cameraPosition = [0, 0.35, 0];
const cameraEntity = createEntity({
  transform: components.transform({ position: cameraPosition }),
  camera: components.camera({
    fov: Math.PI / 6,
    near: 0.5,
    far: 5,
    target: [0, cameraPosition[1], -4],
    culling: true,
    clearColor: [0.01, 0.01, 0.01, 1],
  }),
  cameraHelper: components.cameraHelper(),
});
world.add(cameraEntity);
const fixCameraEntity = createEntity({
  transform: components.transform({
    position: [3, 3, 3],
    rotation: quat.fromEuler(quat.create(), [-Math.PI / 2, 0, 0]),
  }),
  camera: components.camera(),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(fixCameraEntity);

const floorEntity = createEntity({
  transform: components.transform({
    position: [0, -0.1, 0],
  }),
  geometry: components.geometry(cube({ sx: 2, sy: 0.05, sz: 2 })),
  material: components.material({
    baseColor: [1, 0.8, 0.2, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(floorEntity);

const CUBE_INSTANCES = 128;

const cubeGeometry = cube({ sx: 1, sy: 0.25, sz: 1 });
for (let i = 0; i < CUBE_INSTANCES; i++) {
  const cubesEntity = createEntity({
    transform: components.transform({
      // position: random.vec3(1.2).map((n, i) => n + Math.sign(n) * 0.25),
      position: [
        random.float(-1, 1),
        random.float(-0.2, 0.2),
        random.float(-1, 1),
      ],
      scale: new Array(3).fill(random.float(0.1, 0.2)),
    }),
    geometry: components.geometry(cubeGeometry),
    material: components.material({
      baseColor: [1, 0, 1, 0.5],
      castShadows: true,
      receiveShadows: true,
      extensions: ctx.capabilities.isWebGL2
        ? {}
        : {
            GL_OES_standard_derivatives: "require",
          },
      hooks: {
        vert: {
          DECLARATIONS_END: /* glsl */ `varying vec3 vPositionWorld;`,
          END: /* glsl */ `vPositionWorld = positionWorld.xyz;`,
        },
        frag: {
          DECLARATIONS_END: /* glsl */ `varying vec3 vPositionWorld;`,
          END: /* glsl */ `
vec3 fdx = vec3(dFdx(vPositionWorld.x), dFdx(vPositionWorld.y), dFdx(vPositionWorld.z));
vec3 fdy = vec3(dFdy(vPositionWorld.x), dFdy(vPositionWorld.y), dFdy(vPositionWorld.z));
vec3 normalView = normalize(cross(fdx, fdy));

  #if (__VERSION__ < 300)
    gl_FragData[0] *= vec4(normalView * 0.5 + 0.5, 1.0);
  #else
    outColor *= vec4(normalView * 0.5 + 0.5, 1.0);
  #endif
          `,
        },
      },
    }),
    boundingBoxHelper: components.boundingBoxHelper(),
  });
  world.add(cubesEntity);
}

const geometrySystem = systems.geometry({ ctx });
const transformSystem = systems.transform();
const cameraSystem = systems.camera();

const lightSystem = systems.light();
const renderPipelineSystem = systems.renderPipeline({
  ctx,
  resourceCache,
  renderGraph,
  outputEncoding: ctx.Encoding.Linear,
  shadowQuality: 3,
});

const basicRendererSystem = systems.renderer.basic({
  ctx,
  resourceCache,
  renderGraph,
});
const helperRendererSystem = systems.renderer.helper({ ctx });

const createView = (cameraEntity, viewport) => ({
  viewport,
  cameraEntity,
  draw(cb) {
    const W = ctx.gl.drawingBufferWidth;
    const H = ctx.gl.drawingBufferHeight;
    const renderView = {
      viewport: [
        viewport[0] * W,
        viewport[1] * H,
        viewport[2] * W,
        viewport[3] * H,
      ],
      cameraEntity,
      camera: cameraEntity.camera,
    };
    cameraEntity.camera.aspect =
      renderView.viewport[2] / renderView.viewport[3];
    cameraEntity.camera.dirty = true;
    cameraSystem.update(world.entities);

    cb(renderView, viewport);
  },
});

const view1 = createView(cameraEntity, [0.0, 0.0, 0.5, 1]);
const view2 = createView(fixCameraEntity, [0.5, 0.0, 0.5, 1]);

const rotateCamera = (angle) => {
  quat.targetTo(
    cameraEntity.transform.rotation,
    [Math.cos(angle), cameraPosition[1], Math.sin(angle)],
    [0, 0, 0],
  );
  cameraEntity.transform.dirty = true;
};

// GUI
const gui = createGUI(ctx);
gui.addFPSMeeter();
gui.addParam("Auto Rotate", State, "autoRotate");
gui.addParam(
  "Rotation",
  State,
  "rotation",
  { min: 0, max: 2 * Math.PI },
  () => {
    rotateCamera(State.rotation);
  },
);
rotateCamera(State.rotation);

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  ctx.set({
    pixelRatio,
    width: window.innerWidth,
    height: window.innerHeight,
  });
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

let delta = 0;

ctx.frame(() => {
  if (State.autoRotate) {
    delta += 0.005;
    rotateCamera(delta);
    State.rotation = delta % (Math.PI * 2);
  }

  resourceCache.beginFrame();
  renderGraph.beginFrame();

  geometrySystem.update(world.entities);
  transformSystem.update(world.entities);
  cameraSystem.update(world.entities);

  lightSystem.update(world.entities);

  view1.draw((renderView) => {
    renderPipelineSystem.update(world.entities, {
      renderers: [basicRendererSystem],
      renderView: renderView,
    });
  });

  const entitiesInView = renderPipelineSystem.cullEntities(
    world.entities,
    cameraEntity.camera,
  );
  world.entities.forEach((entity) => {
    if (!(entity.material && entity.geometry)) return;
    if (entitiesInView.includes(entity)) {
      entity.material.baseColor =
        entity === floorEntity ? [0.5, 0.5, 0, 1] : [0.5, 0, 0, 1];
    } else {
      entity.material.baseColor = [1, 1, 1, 1];
    }
  });
  // console.log("entitiesInView", world.entities.length, entitiesInView.length);

  view2.draw((renderView) => {
    renderPipelineSystem.update(world.entities, {
      renderers: [basicRendererSystem, helperRendererSystem],
      renderView: renderView,
    });
  });

  renderGraph.endFrame();
  resourceCache.endFrame();

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
