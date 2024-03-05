import { avec3, avec4, mat4, quat, vec3 } from "pex-math";
import { pipeline as SHADERS } from "pex-shaders";
import createGeomBuilder from "geom-builder";

import createBaseSystem from "./base.js";
import { ProgramCache, TEMP_MAT4, TEMP_VEC3 } from "../../utils.js";

// Impacts program caching
// prettier-ignore
const flagDefinitions = [
  [["options", "attachmentsLocations", "color"], "LOCATION_COLOR", { type: "value" }],
  [["options", "attachmentsLocations", "normal"], "LOCATION_NORMAL", { type: "value" }],
  [["options", "attachmentsLocations", "emissive"], "LOCATION_EMISSIVE", { type: "value" }],
  [["options", "toneMap"], "TONE_MAP", { type: "value" }],
];

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

const getCirclePoints = ({ steps, axis, radius = 1, center = [0, 0, 0] }) => {
  const points = [];

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const x = Math.cos(t);
    const y = Math.sin(t);
    const pos = [0, 0, 0];
    pos[axis ? axis[0] : 0] = x;
    pos[axis ? axis[1] : 1] = y;
    vec3.scale(pos, radius);
    vec3.add(pos, center);
    points.push(pos);
  }

  return points;
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

const getQuadPositions = ({ width = 1, height = 1, size = 2 } = {}) =>
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
  ].map((p) => [(p[0] * width) / 2, (p[1] * height) / 2, p[2]]);

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
const getDirectionalLight = ({ transform }) => {
  const size = vec3.length(transform.scale);
  const prismRadius = size * 0.1;

  return getPrismPositions({ radius: prismRadius }).concat(
    // prettier-ignore
    [
      [0, 0, prismRadius], [0, 0, size],
      [prismRadius, 0, 0], [prismRadius, 0, size],
      [-prismRadius, 0, 0], [-prismRadius, 0, size],
      [0, prismRadius, 0], [0, prismRadius, size],
      [0, -prismRadius, 0], [0, -prismRadius, size]
    ],
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
    ],
  );
};

const spotLightCircleOptions = { steps: 32, axis: [0, 1] };

const getSpotLight = (spotLight) => {
  const distance = spotLight.range;
  const radius = distance * Math.tan(spotLight.angle);
  const innerRadius = distance * Math.tan(spotLight.innerAngle);

  return getPyramidEdgePositions({
    sx: radius * Math.sin(Math.PI / 4),
    sz: distance,
  })
    .concat(
      pointsToLine(
        getCirclePoints({
          radius,
          center: [0, 0, distance],
          ...spotLightCircleOptions,
        }),
      ),
    )
    .concat(
      pointsToLine(
        getCirclePoints({
          radius: innerRadius,
          center: [0, 0, distance],
          ...spotLightCircleOptions,
        }),
      ),
    );
};

const areaLightCircleOptions = { axis: [0, 1], radius: 0.5 };

const getAreaLight = ({ areaLight, transform }) => {
  const size = vec3.length(transform.scale);
  if (areaLight.disk) {
    const steps = 16;
    const circlePoints = getCirclePoints({ ...areaLightCircleOptions, steps });
    const z = [0, 0, size];

    return pointsToLine(circlePoints)
      .concat(circlePoints.flatMap((p) => [[...p], vec3.add([...p], z)]))
      .concat(
        // prettier-ignore
        [
          [...circlePoints[steps / 8]], [...circlePoints[steps * (5 / 8)]],
          [...circlePoints[steps * (3 / 8)]], [...circlePoints[steps * (7 / 8)]],
        ],
      );
  }
  return getQuadPositions({ size });
};

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

// Extras
const AXES_COLORS = [
  [1, 0, 0, 1],
  [1, 0, 0, 1],
  [0, 1, 0, 1],
  [0, 1, 0, 1],
  [0, 0, 1, 1],
  [0, 0, 1, 1],
];
const AXES_POSITIONS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 0, 0],
  [0, 1, 0],
  [0, 0, 0],
  [0, 0, 1],
];
const getGridLines = ({ size = 1, step = 10 } = {}) =>
  Array.from({ length: step + 1 }, (_, k) => {
    const halfSize = size * 0.5;
    const offset = size * (k / step) - halfSize;
    return [
      [-halfSize, 0, offset],
      [halfSize, 0, offset],
    ];
  });
const getGrid = (grid) => [
  ...getGridLines(grid).flat(),
  ...getGridLines(grid)
    .flat()
    .map((p) => p.reverse()),
];
const getVertexVector = (geometry, attributeName, size = 0.1, modelMatrix) => {
  const positions = geometry.positions;
  const attribute = geometry[attributeName];

  if (!attribute || !positions) return [];

  const instances = geometry.instances || 1;

  const isAttributeFlatArray = !attribute[0]?.length;
  const isPositionsFlatArray = !positions[0]?.length;
  const positionCount = positions.length / (isPositionsFlatArray ? 3 : 1);

  const offsets = geometry.offsets;
  const isOffsetsFlatArray = offsets && !offsets[0]?.length;

  const scales = geometry.scales;
  const isScalesFlatArray = scales && !scales[0]?.length;

  const rotations = geometry.rotations;
  const isRotationsFlatArray = rotations && !rotations[0]?.length;

  const lines = new Array(instances * positionCount * 2);

  let cellIndex = 0;
  // TODO: gc
  const offset = vec3.create();
  const scale = [1, 1, 1];
  const rotation = quat.create();
  mat4.identity(TEMP_MAT4);

  const worldPosition = vec3.create();
  const vector = vec3.create();

  for (let i = 0; i < instances; i++) {
    if (offsets) {
      if (isOffsetsFlatArray) {
        avec3.set(offset, 0, offsets, i);
      } else {
        vec3.set(offset, offsets[i]);
      }
    }
    if (scales) {
      if (isScalesFlatArray) {
        avec3.set(scale, 0, scales, i);
      } else {
        vec3.set(scale, scales[i]);
      }
    }
    if (rotations) {
      if (isRotationsFlatArray) {
        avec4.set(rotation, 0, rotations, i);
      } else {
        quat.set(rotation, rotations[i]);
      }
      mat4.fromQuat(TEMP_MAT4, rotation);
    }

    for (let j = 0; j < positionCount; j++) {
      if (isPositionsFlatArray) {
        avec3.set(worldPosition, 0, positions, j);
      } else {
        vec3.set(worldPosition, positions[j]);
      }
      if (isAttributeFlatArray) {
        avec3.set(vector, 0, attribute, j);
      } else {
        vec3.set(vector, attribute[j]);
      }

      vec3.set(TEMP_VEC3, worldPosition);
      vec3.addScaled(TEMP_VEC3, vector, size);
      vec3.set(vector, TEMP_VEC3);

      if (scales) {
        worldPosition[0] *= scale[0];
        worldPosition[1] *= scale[1];
        worldPosition[2] *= scale[2];

        vector[0] *= scale[0];
        vector[1] *= scale[1];
        vector[2] *= scale[2];
      }

      if (rotations) {
        vec3.multMat4(worldPosition, TEMP_MAT4);
        vec3.multMat4(vector, TEMP_MAT4);
      }

      if (offsets) {
        vec3.add(worldPosition, offset);
        vec3.add(vector, offset);
      }

      vec3.multMat4(worldPosition, modelMatrix);
      vec3.multMat4(vector, modelMatrix);

      lines[cellIndex] = [...worldPosition];
      lines[cellIndex + 1] = [...vector];

      cellIndex += 2;
    }
  }

  return lines;
};

const geomBuilder = createGeomBuilder({ positions: 1, colors: 1 });

/**
 * Helper renderer
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.helper
 */
export default ({ ctx }) => ({
  ...createBaseSystem(),
  type: "helper-renderer",
  cache: {
    // Cache based on: vertex source (material.vert or default), fragment source (material.frag or default) and list of flags
    programs: new ProgramCache(),
    // Cache based on: program.id
    pipelines: {},
  },
  debug: false,
  flagDefinitions,
  cmd: null,
  getVertexShader: () => SHADERS.helper.vert,
  getFragmentShader: () => SHADERS.helper.frag,
  getPipelineOptions() {
    return {
      depthTest: true,
      depthWrite: true,
      primitive: ctx.Primitive.Lines,
    };
  },
  render(renderView, entities, options) {
    geomBuilder.reset();

    const addToBuilder = (
      positions,
      color = [0.23, 0.23, 0.23, 1],
      modelMatrix,
    ) => {
      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        if (modelMatrix) vec3.multMat4(position, modelMatrix);
        geomBuilder.addPosition(position);
        geomBuilder.addColor(Array.isArray(color[0]) ? color[i] : color);
      }
    };

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const modelMatrix = entity._transform?.modelMatrix;
      if (entity.transform?.position && entity.boundingBoxHelper) {
        addToBuilder(
          getBBoxPositionsList(entity.transform.worldBounds),
          entity.boundingBoxHelper?.color || [1, 0, 0, 1],
        );
      }

      if (entity.vertexHelper) {
        const helpers = Array.isArray(entity.vertexHelper)
          ? entity.vertexHelper
          : [entity.vertexHelper];
        for (let j = 0; j < helpers.length; j++) {
          const helper = helpers[j];
          if (entity.geometry[helper.attribute]) {
            addToBuilder(
              getVertexVector(
                entity.geometry,
                helper.attribute,
                helper.size,
                modelMatrix,
              ),
              helper.color || [0, 1, 0, 1],
            );
          }
        }
      }

      // TODO: cache
      if (entity.lightHelper) {
        if (entity.directionalLight) {
          addToBuilder(
            getDirectionalLight(entity),
            entity.directionalLight.color,
            modelMatrix,
          );
        }
        if (entity.pointLight) {
          addToBuilder(
            getPointLight(entity.pointLight),
            entity.pointLight.color,
            modelMatrix,
          );
        }
        if (entity.spotLight) {
          addToBuilder(
            getSpotLight(entity.spotLight),
            entity.spotLight.color,
            modelMatrix,
          );
        }
        if (entity.areaLight) {
          addToBuilder(
            getAreaLight(entity),
            entity.areaLight.color,
            modelMatrix,
          );
        }
      }
      if (
        entity.cameraHelper &&
        entity.camera &&
        renderView.camera !== entity.camera
      ) {
        addToBuilder(
          entity.camera.projection === "orthographic"
            ? getOrthographicCamera(entity.camera)
            : getPerspectiveCamera(entity.camera),
          entity.cameraHelper.color,
          modelMatrix,
        );
      }
      if (entity.axesHelper) {
        addToBuilder(
          AXES_POSITIONS.map((p) => [...p]),
          AXES_COLORS.map((p) => [...p]),
          modelMatrix,
        );
      }
      if (entity.gridHelper) {
        addToBuilder(
          getGrid(entity.gridHelper),
          entity.gridHelper.color,
          modelMatrix,
        );
      }
    }
    if (!geomBuilder.count) return;

    const geometry = geomBuilder;

    this.cmd ||= {
      name: "drawHelperLinesCmd",
      attributes: {
        aPosition: ctx.vertexBuffer({ data: [0, 0, 0] }),
        aVertexColor: ctx.vertexBuffer({ data: [0, 0, 0, 0] }),
      },
    };

    ctx.update(this.cmd.attributes.aPosition, { data: geometry.positions });
    ctx.update(this.cmd.attributes.aVertexColor, { data: geometry.colors });

    ctx.submit(this.cmd, {
      pipeline: this.getPipeline(ctx, { geometry }, options),
      count: geometry.count,
      uniforms: {
        uExposure: renderView.exposure,
        uOutputEncoding: renderView.outputEncoding,

        uProjectionMatrix: renderView.camera.projectionMatrix,
        uViewMatrix: renderView.camera.viewMatrix,
      },
    });
  },
  renderOpaque(renderView, entities, options) {
    this.render(renderView, entities, {
      ...options,
      toneMap: renderView.toneMap,
    });
  },
});
