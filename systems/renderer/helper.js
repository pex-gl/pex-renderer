import createGeomBuilder from "geom-builder";
import { pipeline as SHADERS } from "pex-shaders";
import { patchVS, patchFS } from "../../utils.js";
import { vec3 } from "pex-math";

const getBBoxPositionsList = function (bbox) {
  return [
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]],
  ];
};

const getCirclePositions = function (opts) {
  const { steps, axis, radius, center } = opts;
  const points = [];

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const x = Math.cos(t);
    const y = Math.sin(t);
    const pos = [0, 0, 0];
    pos[axis ? axis[0] : 0] = x;
    pos[axis ? axis[1] : 1] = y;
    vec3.scale(pos, radius || 1);
    vec3.add(pos, center || [0, 0, 0]);
    points.push(pos);
  }

  const lines = points.reduce((lines, p, i) => {
    lines.push(p);
    lines.push(points[(i + 1) % points.length]);
    return lines;
  }, []);

  return lines;
};

const getPrismPositions = function (opts) {
  const r = opts.radius;
  const position = opts.position || [0, 0, 0];
  // prettier-ignore
  const points = [
    [0, r, 0], [r, 0, 0],
    [0, -r, 0], [r, 0, 0],

    [0, r, 0], [-r, 0, 0],
    [0, -r, 0], [-r, 0, 0],

    [0, r, 0], [0, 0, r],
    [0, -r, 0], [0, 0, r],

    [0, r, 0], [0, 0, -r],
    [0, -r, 0], [0, 0, -r],

    [-r, 0, 0], [0, 0, -r],
    [r, 0, 0], [0, 0, -r],
    [r, 0, 0], [0, 0, r],
    [-r, 0, 0], [0, 0, r]
  ]
  points.forEach((p) => vec3.add(p, position));
  return points;
};

const getQuadPositions = function (opts) {
  const w = opts.width;
  const h = opts.height;
  const position = opts.position || [0, 0, 0];
  // prettier-ignore
  const points = [
    [-1, -1, 0], [1, -1, 0],
    [1, -1, 0], [1, 1, 0],
    [1, 1, 0], [-1, 1, 0],
    [-1, 1, 0], [-1, -1, 0],
    [-1, -1, 0], [1, 1, 0],
    [-1, 1, 0], [1, -1, 0],

    [-1, -1, 0], [-1, -1, 1 / 2],
    [1, -1, 0], [1, -1, 1 / 2],
    [1, 1, 0], [1, 1, 1 / 2],
    [-1, 1, 0], [-1, 1, 1 / 2],
    [0, 0, 0], [0, 0, 1 / 2]
  ]
  points.forEach((p) => {
    p[0] *= w / 2;
    p[1] *= h / 2;
    vec3.add(p, position);
  });
  return points;
};

function drawDirectionalLight(geomBuilder, entity) {
  const directionalLightGizmoPositions = getPrismPositions({
    radius: 0.3,
  }).concat(
    /* prettier-ignore */ [
      [0, 0, 0.3], [0, 0, 1],
      [0.3, 0, 0], [0.3, 0, 1],
      [-0.3, 0, 0], [-0.3, 0, 1],
      [0, 0.3, 0], [0, 0.3, 1],
      [0, -0.3, 0], [0, -0.3, 1]
    ]
  );
  // console.log("directionalLightGizmoPositions", directionalLightGizmoPositions);
  directionalLightGizmoPositions.forEach((pos) => {
    vec3.multMat4(pos, entity._transform.modelMatrix);
    geomBuilder.addPosition(pos);
    geomBuilder.addColor([1, 0, 0, 1]);
  });
}

export default function createHelperSystem({ ctx }) {
  let geomBuilder = createGeomBuilder({ colors: 1, positions: 1 });

  const DRAW_BUFFERS_EXT =
    ctx.capabilities.maxColorAttachments > 1 ? "#define USE_DRAW_BUFFERS" : "";

  const helperVert = `${SHADERS.helper.vert}`;
  const helperFrag = `
  ${DRAW_BUFFERS_EXT}
  ${SHADERS.helper.frag}`;

  const helperPositionVBuffer = ctx.vertexBuffer({ data: [0, 0, 0] });
  const helperColorVBuffer = ctx.vertexBuffer({ data: [0, 0, 0, 0] });
  const drawHelperLinesCmd = {
    pipeline: ctx.pipeline({
      vert: ctx.capabilities.isWebGL2 ? patchVS(helperVert) : helperVert,
      frag: ctx.capabilities.isWebGL2 ? patchFS(helperFrag) : helperFrag,
      depthTest: true,
      depthWrite: true,
      primitive: ctx.Primitive.Lines,
    }),
    attributes: {
      aPosition: helperPositionVBuffer,
      aVertexColor: helperColorVBuffer,
    },
    count: 1,
  };

  const helperSystem = {
    type: "camera-system",
  };

  helperSystem.renderStages = {
    opaque: (renderView, entities) => {
      const { camera } = renderView;

      geomBuilder.reset();
      for (let entity of entities) {
        if (entity.transform?.position && entity.boundingBoxHelper) {
          const positions = getBBoxPositionsList(entity.transform.worldBounds);
          positions.forEach((pos) => {
            geomBuilder.addPosition(pos);
            geomBuilder.addColor(
              entity.boundingBoxHelper?.color || [1, 0, 0, 1]
            );
          });
          // geomBuilder.addPosition([0, 0, 0]);
          // geomBuilder.addPosition(entity.transform?.position);
          // geomBuilder.addColor([1, 0, 0, 1]);
          // geomBuilder.addColor([0, 1, 0, 1]);
        }
        if (entity.lightHelper) {
          if (entity.directionalLight) {
            drawDirectionalLight(geomBuilder, entity);
          }
        }
        // if (entity.boundingBoxHelper) {
        // if (entity.transform)
        // }
      }

      ctx.update(helperPositionVBuffer, { data: geomBuilder.positions });
      ctx.update(helperColorVBuffer, { data: geomBuilder.colors });
      const cmd = drawHelperLinesCmd;
      cmd.count = geomBuilder.count;

      if (cmd.count > 0) {
        ctx.submit(cmd, {
          uniforms: {
            uProjectionMatrix: camera.projectionMatrix,
            uViewMatrix: camera.viewMatrix,
            uOutputEncoding: ctx.Encoding.Gamma,
          },
          // viewport: camera.viewport,
        });
      }
    },
  };

  helperSystem.update = (entities) => {};

  return helperSystem;
}
