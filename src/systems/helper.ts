import { avec3, avec4, mat4, quat, vec3 } from "pex-math";
import createGeomBuilder from "geom-builder";

import { entity, components } from "../index.js";
import { getAttributeData } from "./geometry.js";
import { TEMP_MAT4, TEMP_VEC3 } from "../utils.js";

import type { GeomBuilder } from "geom-builder";
import type { AABB } from "pex-geom";
import type { Mat4, TypedArray, Vec3 } from "pex-math";
import type {
  AttributeData,
  CameraComponentOptions,
  Color,
  Entity,
  EntityId,
  GeometryAttribute,
  GeometryComponentOptions,
  GridHelperComponentOptions,
  PointLightComponentOptions,
  RenderEngine,
  RenderView,
  SkinComponentOptions,
  SpotLightComponentOptions,
} from "../types.js";

// pex-math vectors are `number[]` of a known length, which
// `noUncheckedIndexedAccess` cannot see — indexing one otherwise yields
// `number | undefined` at every component.
type Vec3Elements = [number, number, number];

/**
 * Geom-builder's arrays, named after the attributes it was created with, plus
 * the flag the geometry system re-uploads on.
 */
type HelperGeometry = GeomBuilder &
  GeometryComponentOptions & {
    positions: Float32Array & { dirty?: boolean };
    vertexColors: Float32Array & { dirty?: boolean };
    addPosition(position: Vec3): void;
    addVertexColor(color: Color): void;
  };

/** One of the three entities the system draws every helper into. */
interface HelperEntity extends Omit<Entity, "geometry"> {
  geometry: HelperGeometry;
}
type HelperEntities = [HelperEntity, HelperEntity, HelperEntity];

const createHelperGeometry = () =>
  Object.assign(
    createGeomBuilder({ positions: 3, vertexColors: 4 }),
    components.geometry(),
  ) as HelperGeometry;

const pointsToLine = (points: Vec3[], closed = false) =>
  points.reduce<Vec3[]>((line, p, i) => {
    if (!closed && i > 0) {
      line.push([...points[i - 1]!], p);
    } else {
      line.push(p, [...points[(i + 1) % points.length]!]);
    }
    return line;
  }, []);

const getBBoxPositionsList = (bbox: AABB) => {
  const [[minX, minY, minZ], [maxX, maxY, maxZ]] = bbox as [
    Vec3Elements,
    Vec3Elements,
  ];

  // prettier-ignore
  return [
    [minX, minY, minZ], [maxX, minY, minZ],
    [minX, minY, minZ], [minX, maxY, minZ],
    [minX, minY, minZ], [minX, minY, maxZ],
    [maxX, maxY, maxZ], [minX, maxY, maxZ],
    [maxX, maxY, maxZ], [maxX, minY, maxZ],
    [maxX, maxY, maxZ], [maxX, maxY, minZ],
    [maxX, minY, minZ], [maxX, minY, maxZ],
    [maxX, minY, minZ], [maxX, maxY, minZ],
    [minX, maxY, minZ], [maxX, maxY, minZ],
    [minX, maxY, minZ], [minX, maxY, maxZ],
    [minX, minY, maxZ], [minX, maxY, maxZ],
    [minX, minY, maxZ], [maxX, minY, maxZ],
  ];
};

const getCirclePoints = ({
  steps,
  axis = [0, 1],
  radius = 1,
  center = [0, 0, 0],
}: {
  steps: number;
  axis?: number[];
  radius?: number;
  center?: Vec3;
}) => {
  const points: Vec3[] = [];

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const x = Math.cos(t);
    const y = Math.sin(t);
    const pos = [0, 0, 0];
    pos[axis[0]!] = x;
    pos[axis[1]!] = y;
    vec3.scale(pos, radius);
    vec3.add(pos, center);
    points.push(pos);
  }

  return points;
};

// prettier-ignore
const getPrismPositions = ({ radius }: { radius: number }) => ([
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
]);

const getQuadPositions = ({ width = 1, height = 1, size = 2 } = {}) =>
  // prettier-ignore
  ([
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
  ] satisfies Vec3Elements[]).map((p) => [(p[0] * width) / 2, (p[1] * height) / 2, p[2]]);

const getPyramidEdgePositions = ({
  sx,
  sy = sx,
  sz = sx,
}: {
  sx: number;
  sy?: number;
  sz?: number;
}) => [
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
const getDirectionalLight = ({ transform }: Entity) => {
  const size = vec3.length(transform!.scale!);
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

// A gizmo has to be drawable, and an infinite range has no extent to draw.
const HELPER_RANGE = 10;
const helperRange = (range?: number) =>
  Number.isFinite(range) ? range! : HELPER_RANGE;

const getPointLight = (pointLight: PointLightComponentOptions) => {
  const radius = helperRange(pointLight.range) / 2;
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

const getSpotLight = (spotLight: SpotLightComponentOptions) => {
  const distance = helperRange(spotLight.range);
  const radius = distance * Math.tan(spotLight.outerConeAngle!);
  const innerRadius = distance * Math.tan(spotLight.innerConeAngle!);

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
        true,
      ),
    )
    .concat(
      pointsToLine(
        getCirclePoints({
          radius: innerRadius,
          center: [0, 0, distance],
          ...spotLightCircleOptions,
        }),
        true,
      ),
    );
};

const areaLightCircleOptions = { axis: [0, 1], radius: 0.5 };

const getAreaLight = ({ areaLight, transform }: Entity) => {
  const size = vec3.length(transform!.scale!);
  if (areaLight!.disk) {
    const steps = 16;
    const circlePoints = getCirclePoints({ ...areaLightCircleOptions, steps });
    const z = [0, 0, size];

    return pointsToLine(circlePoints, true)
      .concat(circlePoints.flatMap((p) => [[...p], vec3.add([...p], z)]))
      .concat(
        // prettier-ignore
        [
          [...circlePoints[steps / 8]!], [...circlePoints[steps * (5 / 8)]!],
          [...circlePoints[steps * (3 / 8)]!], [...circlePoints[steps * (7 / 8)]!],
        ],
      );
  }
  return getQuadPositions({ size });
};

// Cameras
const getPerspectiveCamera = (camera: CameraComponentOptions) => {
  const { fov, near, far, aspect } = camera as Required<CameraComponentOptions>;

  const nearHalfHeight = Math.tan(fov / 2) * near;
  const farHalfHeight = Math.tan(fov / 2) * far;
  const nearHalfWidth = nearHalfHeight * aspect;
  const farHalfWidth = farHalfHeight * aspect;

  return [
    ...getPyramidEdgePositions({
      sx: farHalfWidth,
      sy: farHalfHeight,
      sz: -far,
    }),

    ...pointsToLine([
      [-farHalfWidth, farHalfHeight, -far],
      [farHalfWidth, farHalfHeight, -far],
      [farHalfWidth, -farHalfHeight, -far],
      [-farHalfWidth, -farHalfHeight, -far],
      [-farHalfWidth, farHalfHeight, -far],
    ]),

    ...pointsToLine([
      [-nearHalfWidth, nearHalfHeight, -near],
      [nearHalfWidth, nearHalfHeight, -near],
      [nearHalfWidth, -nearHalfHeight, -near],
      [-nearHalfWidth, -nearHalfHeight, -near],
      [-nearHalfWidth, nearHalfHeight, -near],
    ]),
  ];
};

const getOrthographicCamera = (camera: CameraComponentOptions) => {
  const { near, far, zoom, left, right, top, bottom, view } =
    camera as Required<CameraComponentOptions>;

  let minX = (right + left) / 2 - (right - left) / (2 / zoom);
  let maxX = (right + left) / 2 + (right - left) / (2 / zoom);
  let maxY = (top + bottom) / 2 + (top - bottom) / (2 / zoom);
  let minY = (top + bottom) / 2 - (top - bottom) / (2 / zoom);

  if (view) {
    const size = view.size!;
    const totalSize = view.totalSize!;
    const offset = view.offset!;

    const zoomW = 1 / zoom / (size[0]! / totalSize[0]!);
    const zoomH = 1 / zoom / (size[1]! / totalSize[1]!);
    const scaleW = (right - left) / size[0]!;
    const scaleH = (top - bottom) / size[1]!;

    minX += scaleW * (offset[0]! / zoomW);
    maxX = minX + scaleW * (size[0]! / zoomW);
    maxY -= scaleH * (offset[1]! / zoomH);
    minY = maxY - scaleH * (size[1]! / zoomH);
  }
  return getBBoxPositionsList([
    [minX, maxY, -near],
    [maxX, minY, -far],
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
const getGridLines = ({
  size = 1,
  step = 10,
}: GridHelperComponentOptions = {}) => {
  // TODO: acount for transform scale?
  const subdivisions = Math.max(Math.ceil(size), 2);
  const halfSize = size * 0.5;

  return Array.from({ length: step + 1 }, (_, k) => {
    const offset = size * (k / step) - halfSize;
    const a = [-halfSize, 0, offset];
    const b = [halfSize, 0, offset];

    return pointsToLine(
      Array.from({ length: subdivisions }, (_, l) =>
        vec3.lerp([...a], b, l / (subdivisions - 1)),
      ),
    );
  });
};
const getGrid = (grid: GridHelperComponentOptions) => [
  ...getGridLines(grid).flat(),
  ...getGridLines(grid)
    .flat()
    .map((p) => p.reverse()),
];
/** One flat typed array, or one array per vertex. */
const isFlatArray = (data: AttributeData): data is TypedArray =>
  !Array.isArray(data[0]);

const getVertexAttributeData = (
  geometry: GeometryComponentOptions,
  attributeName: string,
) => {
  // Attributes are reached by name, which the component type spells out one by
  // one rather than as an index signature.
  const attribute = (geometry as Record<string, GeometryAttribute | undefined>)[
    attributeName
  ];
  return attribute && getAttributeData(attribute);
};
const getVertexVector = (
  geometry: GeometryComponentOptions,
  attributeName: string,
  size = 0.1,
  modelMatrix: Mat4,
) => {
  const positions = getVertexAttributeData(geometry, "positions");
  const attribute = getVertexAttributeData(geometry, attributeName);

  if (!attribute || !positions) return [];

  const instances = geometry.instanceCount || 1;

  const isAttributeFlatArray = isFlatArray(attribute);
  const isPositionsFlatArray = isFlatArray(positions);
  const positionCount = positions.length / (isPositionsFlatArray ? 3 : 1);

  const offsets = geometry.offsets as AttributeData | undefined;
  const isOffsetsFlatArray = !!offsets && isFlatArray(offsets);

  const scales = geometry.scales as AttributeData | undefined;
  const isScalesFlatArray = !!scales && isFlatArray(scales);

  const rotations = geometry.rotations as AttributeData | undefined;
  const isRotationsFlatArray = !!rotations && isFlatArray(rotations);

  const lines: Vec3[] = Array.from({ length: instances * positionCount * 2 });

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
        avec3.set(offset as unknown as TypedArray, 0, offsets, i);
      } else {
        vec3.set(offset, offsets[i]!);
      }
    }
    if (scales) {
      if (isScalesFlatArray) {
        avec3.set(scale as unknown as TypedArray, 0, scales, i);
      } else {
        vec3.set(scale, scales[i]!);
      }
    }
    if (rotations) {
      if (isRotationsFlatArray) {
        avec4.set(rotation as unknown as TypedArray, 0, rotations, i);
      } else {
        quat.set(rotation, rotations[i]!);
      }
      mat4.fromQuat(TEMP_MAT4, rotation);
    }

    for (let j = 0; j < positionCount; j++) {
      if (isPositionsFlatArray) {
        avec3.set(worldPosition as unknown as TypedArray, 0, positions, j);
      } else {
        vec3.set(worldPosition, positions[j]!);
      }
      if (isAttributeFlatArray) {
        avec3.set(vector as unknown as TypedArray, 0, attribute, j);
      } else {
        vec3.set(vector, attribute[j]!);
      }

      vec3.set(TEMP_VEC3, worldPosition);
      vec3.addScaled(TEMP_VEC3, vector, size);
      vec3.set(vector, TEMP_VEC3);

      if (scales) {
        worldPosition[0]! *= scale[0]!;
        worldPosition[1]! *= scale[1]!;
        worldPosition[2]! *= scale[2]!;

        vector[0]! *= scale[0]!;
        vector[1]! *= scale[1]!;
        vector[2]! *= scale[2]!;
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

const SKIN_MAT4 = mat4.create();
const SKIN_PARENT_MAT4 = mat4.create();
const getPositionFromMat4 = (m: Mat4): Vec3 => [m[12]!, m[13]!, m[14]!];

const getSkeleton = (skin: SkinComponentOptions, modelMatrix: Mat4) => {
  const positions: Vec3[] = [];
  // const distances = [];

  mat4.set(TEMP_MAT4, modelMatrix);
  mat4.invert(TEMP_MAT4);

  // let maxDistance = Number.NEGATIVE_INFINITY;

  const joints = skin.joints!;

  for (let i = 0; i < joints.length; i++) {
    const joint = joints[i]!;

    const jointMatrix = joint._transform?.modelMatrix;
    const parentMatrix =
      joint.transform?.parent?.entity?._transform?.modelMatrix;

    if (jointMatrix && parentMatrix) {
      mat4.set(SKIN_PARENT_MAT4, TEMP_MAT4);
      mat4.mult(SKIN_PARENT_MAT4, parentMatrix);
      positions.push(getPositionFromMat4(SKIN_PARENT_MAT4));

      mat4.set(SKIN_MAT4, TEMP_MAT4);
      mat4.mult(SKIN_MAT4, jointMatrix);
      positions.push(getPositionFromMat4(SKIN_MAT4));

      // const d = vec3.distance(a, b);
      // distances.push(d);
      // maxDistance = Math.max(maxDistance, d);
    }
  }

  return positions;
};

// TODO:
// - cache helpers
// - don't recompute shared helpers for each camera

/** Helper system */
export default () => ({
  type: "helper-system",
  cache: {} as Record<EntityId, HelperEntities>,
  debug: false,
  lineWidth: 2,
  getEntities: (cacheId: number): HelperEntities => [
    entity({
      name: `helper-${cacheId}`,
      transform: components.transform(),
      geometry: createHelperGeometry(),
      material: components.material({
        type: "line",
        lineWidth: 1,
        perspectiveScaling: false,
        depthWriteEnabled: true,
      }),
    }),
    entity({
      name: `helper-no-depth-${cacheId}`,
      transform: components.transform(),
      geometry: createHelperGeometry(),
      material: components.material({
        type: "line",
        lineWidth: 1,
        perspectiveScaling: false,
        depthWriteEnabled: false,
        depthCompare: "always",
      }),
    }),
    entity({
      name: `helper-biased-${cacheId}`,
      transform: components.transform(),
      geometry: createHelperGeometry(),
      material: components.material({
        type: "line",
        lineWidth: 1,
        perspectiveScaling: false,
        depthWriteEnabled: true,
        depthBias: -16,
        depthBiasSlopeScale: 0,
      }),
    }),
  ],
  addToBuilder(
    builder: HelperGeometry,
    positions: Vec3[],
    color: Color | Color[] = [0.23, 0.23, 0.23, 1],
    lineWidth: number,
    modelMatrix?: Mat4,
  ) {
    const colors = Array.isArray(color[0]) ? (color as Color[]) : null;
    // Assigned either once here or per position below.
    let vertexColor!: Color;

    if (!colors) {
      vertexColor = [...(color as Color)];
      vertexColor[3]! *= lineWidth;
    }

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]!;
      if (modelMatrix) vec3.multMat4(position, modelMatrix);

      if (colors) {
        vertexColor = [...colors[i % colors.length]!];
        vertexColor[3]! *= lineWidth;
      }

      builder.addPosition(position);
      builder.addVertexColor(vertexColor);
    }
  },
  update(
    entities: Entity[],
    {
      renderView,
      renderEngine,
    }: { renderView: RenderView; renderEngine: Pick<RenderEngine, "systems"> },
  ) {
    const cacheId = renderView.cameraEntity!.id;

    const helperEntities = (this.cache[cacheId] ||= this.getEntities(cacheId));

    const [
      { geometry: geomBuilder },
      { geometry: geomNoDepthBuilder },
      { geometry: geomBiasedBuilder },
    ] = helperEntities;

    geomBuilder.reset();
    geomNoDepthBuilder.reset();
    geomBiasedBuilder.reset();

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;

      const modelMatrix = entity._transform?.modelMatrix;
      const lineWidth = this.lineWidth;

      if (entity.transform?.worldBounds && entity.boundingBoxHelper) {
        this.addToBuilder(
          geomBiasedBuilder,
          getBBoxPositionsList(entity.transform.worldBounds),
          entity.boundingBoxHelper.color,
          lineWidth,
        );
      }

      if (entity.vertexHelper) {
        const helpers = Array.isArray(entity.vertexHelper)
          ? entity.vertexHelper
          : [entity.vertexHelper];
        for (let j = 0; j < helpers.length; j++) {
          const helper = helpers[j]!;
          if ((entity.geometry as Record<string, unknown>)[helper.attribute!]) {
            this.addToBuilder(
              geomBuilder,
              getVertexVector(
                entity.geometry!,
                helper.attribute!,
                helper.size,
                modelMatrix!,
              ),
              helper.color,
              lineWidth * 0.2, // Vertex helpers are usually denser
            );
          }
        }
      }

      if (entity.skin && entity.skeletonHelper) {
        this.addToBuilder(
          geomNoDepthBuilder,
          getSkeleton(entity.skin, modelMatrix!),
          entity.skeletonHelper.color,
          lineWidth,
          modelMatrix,
        );
      }

      if (entity.lightHelper) {
        if (entity.directionalLight) {
          this.addToBuilder(
            geomBuilder,
            getDirectionalLight(entity),
            entity.directionalLight.color,
            lineWidth,
            modelMatrix,
          );
        }
        if (entity.pointLight) {
          this.addToBuilder(
            geomBuilder,
            getPointLight(entity.pointLight),
            entity.pointLight.color,
            lineWidth,
            modelMatrix,
          );
        }
        if (entity.spotLight) {
          this.addToBuilder(
            geomBuilder,
            getSpotLight(entity.spotLight),
            entity.spotLight.color,
            lineWidth,
            modelMatrix,
          );
        }
        if (entity.areaLight) {
          this.addToBuilder(
            geomBuilder,
            getAreaLight(entity),
            entity.areaLight.color,
            lineWidth,
            modelMatrix,
          );
        }
      }

      if (
        entity.cameraHelper &&
        entity.camera &&
        renderView.camera !== entity.camera
      ) {
        this.addToBuilder(
          geomBuilder,
          entity.camera.projection === "orthographic"
            ? getOrthographicCamera(entity.camera)
            : getPerspectiveCamera(entity.camera),
          entity.cameraHelper.color,
          lineWidth,
          modelMatrix,
        );
      }
      if (entity.gridHelper) {
        this.addToBuilder(
          geomBuilder,
          getGrid(entity.gridHelper),
          entity.gridHelper.color,
          lineWidth,
          modelMatrix,
        );
      }
      if (entity.axesHelper) {
        this.addToBuilder(
          geomBiasedBuilder,
          AXES_POSITIONS.map((p) => [...p]),
          AXES_COLORS.map((p) => [...p]),
          lineWidth,
          modelMatrix,
        );
      }
    }

    for (let i = 0; i < helperEntities.length; i++) {
      const entity = helperEntities[i]!;

      // Clean up geom-builder
      entity.geometry.positions.fill(0, entity.geometry.count * 3);
      entity.geometry.vertexColors.fill(0, entity.geometry.count * 4);

      // Set as dirty
      entity.geometry.positions.dirty = true;
      entity.geometry.vertexColors.dirty = true;

      if (entity.geometry.bounds) entity.geometry.bounds.dirty = true;
    }

    // Update entities
    renderEngine.systems
      .find(({ type }) => type === "geometry-system")!
      .update(helperEntities);
    renderEngine.systems
      .find(({ type }) => type === "transform-system")!
      .update(helperEntities);

    return { entities: helperEntities };
  },
});
