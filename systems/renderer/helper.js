import { vec3 } from "pex-math";
import { pipeline as SHADERS } from "pex-shaders";
import createGeomBuilder from "geom-builder";
import { patchVS, patchFS } from "../../utils.js";

const pointsToLine = (points) =>
  points.reduce((line, p, i) => {
    line.push(p);
    line.push([...points[(i + 1) % points.length]]);
    return line;
  }, []);

const getBBoxPositionsList = (bbox) => [
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

const getCirclePositions = ({ steps, axis, radius, center }) => {
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

  return pointsToLine(points);
};

// prettier-ignore
const getPrismPositions = ({ radius }) => ([
  [0, radius, 0], [radius, 0, 0],
  [0, -radius, 0], [radius, 0, 0],

  [0, radius, 0], [-radius, 0, 0],
  [0, -radius, 0], [-radius, 0, 0],

  [0, radius, 0], [0, 0, radius],
  [0, -radius, 0], [0, 0, radius],

  [0, radius, 0], [0, 0, -radius],
  [0, -radius, 0], [0, 0, -radius],

  [-radius, 0, 0], [0, 0, -radius],
  [radius, 0, 0], [0, 0, -radius],
  [radius, 0, 0], [0, 0, radius],
  [-radius, 0, 0], [0, 0, radius]
])

const getQuadPositions = ({
  width = 1,
  height = 1,
  size = 2,
  position = [0, 0, 0],
} = {}) =>
  // prettier-ignore
  [
    [-1, -1, 0], [1, -1, 0],
    [1, -1, 0], [1, 1, 0],
    [1, 1, 0], [-1, 1, 0],
    [-1, 1, 0], [-1, -1, 0],
    [-1, -1, 0], [1, 1, 0],
    [-1, 1, 0], [1, -1, 0],

    [-1, -1, 0], [-1, -1, size],
    [1, -1, 0], [1, -1, size],
    [1, 1, 0], [1, 1, size],
    [-1, 1, 0], [-1, 1, size],
    [0, 0, 0], [0, 0, size]
  ].map((p) =>
    vec3.add([(p[0] * width) / 2, (p[1] * height) / 2, p[2]], position)
  );

const getPyramidEdgePositions = ({ sx, sy = sx, sz = sx }) => [
  [0, 0, 0],
  [-sx, sy, sz],
  [0, 0, 0],
  [sx, sy, sz],
  [0, 0, 0],
  [sx, -sy, sz],
  [0, 0, 0],
  [-sx, -sy, sz],
];

// Lights
const getDirectionalLight = (directionalLight) => {
  const intensity = directionalLight.intensity;
  const prismRadius = intensity * 0.1;

  return getPrismPositions({ radius: prismRadius }).concat(
    // prettier-ignore
    [
      [0, 0, prismRadius], [0, 0, intensity],
      [prismRadius, 0, 0], [prismRadius, 0, intensity],
      [-prismRadius, 0, 0], [-prismRadius, 0, intensity],
      [0, prismRadius, 0], [0, prismRadius, intensity],
      [0, -prismRadius, 0], [0, -prismRadius, intensity]
    ]
  );
};

const getPointLight = (pointLight) => {
  const radius = pointLight.range / 2;
  const prismRadius = radius * 0.1;

  return getPrismPositions({ radius: prismRadius }).concat(
    // prettier-ignore
    [
      [prismRadius, 0, 0], [radius, 0, 0],
      [-prismRadius, 0, 0], [-radius, 0, 0],
      [0, prismRadius, 0], [0, radius, 0],
      [0, -prismRadius, 0], [0, -radius, 0],
      [0, 0, prismRadius], [0, 0, radius],
      [0, 0, -prismRadius], [0, 0, -radius],
    ]
  );
};

const spotLightCircleOptions = { steps: 32, axis: [0, 1] };

const getSpotLight = (spotLight) => {
  const intensity = spotLight.intensity;
  const distance = spotLight.range;
  const radius = distance * Math.tan(spotLight.angle);
  const innerRadius = distance * Math.tan(spotLight.innerAngle);

  return getCirclePositions({
    radius: intensity * 0.1,
    ...spotLightCircleOptions,
  })
    .concat(
      getPyramidEdgePositions({
        sx: radius * Math.sin(Math.PI / 4),
        sz: distance,
      })
    )
    .concat(
      getCirclePositions({
        radius,
        center: [0, 0, distance],
        ...spotLightCircleOptions,
      })
    )
    .concat(
      getCirclePositions({
        radius: innerRadius,
        center: [0, 0, distance],
        ...spotLightCircleOptions,
      })
    );
};

const getAreaLight = (areaLight) =>
  getQuadPositions({ size: areaLight.intensity });

// Cameras
const getPerspectiveCamera = (camera) => {
  const nearHalfHeight = Math.tan(camera.fov / 2) * camera.near;
  const farHalfHeight = Math.tan(camera.fov / 2) * camera.far;
  const nearHalfWidth = nearHalfHeight * camera.aspect;
  const farHalfWidth = farHalfHeight * camera.aspect;

  return [
    ...getPyramidEdgePositions({
      sx: farHalfWidth,
      sy: farHalfHeight,
      sz: -camera.far,
    }),

    ...pointsToLine([
      [-farHalfWidth, farHalfHeight, -camera.far],
      [farHalfWidth, farHalfHeight, -camera.far],
      [farHalfWidth, -farHalfHeight, -camera.far],
      [-farHalfWidth, -farHalfHeight, -camera.far],
    ]),

    ...pointsToLine([
      [-nearHalfWidth, nearHalfHeight, -camera.near],
      [nearHalfWidth, nearHalfHeight, -camera.near],
      [nearHalfWidth, -nearHalfHeight, -camera.near],
      [-nearHalfWidth, -nearHalfHeight, -camera.near],
    ]),
  ];
};

const getOrthographicCamera = (camera) => {
  let left =
    (camera.right + camera.left) / 2 -
    (camera.right - camera.left) / (2 / camera.zoom);
  let right =
    (camera.right + camera.left) / 2 +
    (camera.right - camera.left) / (2 / camera.zoom);
  let top =
    (camera.top + camera.bottom) / 2 +
    (camera.top - camera.bottom) / (2 / camera.zoom);
  let bottom =
    (camera.top + camera.bottom) / 2 -
    (camera.top - camera.bottom) / (2 / camera.zoom);

  if (camera.view) {
    const zoomW =
      1 / camera.zoom / (camera.view.size[0] / camera.view.totalSize[0]);
    const zoomH =
      1 / camera.zoom / (camera.view.size[1] / camera.view.totalSize[1]);
    const scaleW = (camera.right - camera.left) / camera.view.size[0];
    const scaleH = (camera.top - camera.bottom) / camera.view.size[1];

    left += scaleW * (camera.view.offset[0] / zoomW);
    right = left + scaleW * (camera.view.size[0] / zoomW);
    top -= scaleH * (camera.view.offset[1] / zoomH);
    bottom = top - scaleH * (camera.view.size[1] / zoomH);
  }
  return getBBoxPositionsList([
    [left, top, -camera.near],
    [right, bottom, -camera.far],
  ]);
};

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
    type: "helper-renderer",
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
        const addToBuilder = (positions, color = [1, 1, 1, 1]) => {
          for (let i = 0; i < positions.length; i++) {
            const position = positions[i];
            vec3.multMat4(position, entity._transform.modelMatrix);
            geomBuilder.addPosition(position);
            geomBuilder.addColor(color);
          }
        };

        // TODO: cache
        if (entity.lightHelper) {
          if (entity.directionalLight) {
            addToBuilder(
              getDirectionalLight(entity.directionalLight),
              entity.directionalLight.color
            );
          }
          if (entity.pointLight) {
            addToBuilder(
              getPointLight(entity.pointLight),
              entity.pointLight.color
            );
          }
          if (entity.spotLight) {
            addToBuilder(
              getSpotLight(entity.spotLight),
              entity.spotLight.color
            );
          }
          if (entity.areaLight) {
            addToBuilder(
              getAreaLight(entity.areaLight),
              entity.areaLight.color
            );
          }
        }
        if (entity.cameraHelper && entity.camera) {
          addToBuilder(
            entity.camera.projection === "orthographic"
              ? getOrthographicCamera(entity.camera)
              : getPerspectiveCamera(entity.camera),
            entity.cameraHelper.color
          );
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
