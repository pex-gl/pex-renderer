import { mat4 } from "pex-math";
import { fromLinear } from "pex-color";

import { components, entity as createEntity, systems } from "../../index.js";
import {
  NAMESPACE,
  mapKeys,
  pointIntensityToPower,
  spotIntensityToPower,
} from "../../utils.js";

import type { GltfDocument, ResolvedGltfNode } from "./document.js";
import type { Entity } from "../../types.js";

// glTF attribute semantic -> pex geometry component field.
const PEX_ATTRIBUTE_NAME_MAP: Record<string, string> = {
  POSITION: "positions",
  NORMAL: "normals",
  TANGENT: "tangents",
  TEXCOORD_0: "uvs",
  TEXCOORD_1: "uvs1",
  JOINTS_0: "joints",
  WEIGHTS_0: "weights",
  COLOR_0: "vertexColors",
  // Instanced (EXT_mesh_gpu_instancing)
  TRANSLATION: "offsets",
  ROTATION: "rotations",
  SCALE: "scales",
};
// Geometry fields already generic/passthrough — not remapped.
const GEOMETRY_PASSTHROUGH = new Set([
  "bounds",
  "count",
  "instanceCount",
  "topology",
]);

function mapAttributeName(name: string): string {
  return PEX_ATTRIBUTE_NAME_MAP[name] ?? name.toLowerCase();
}

function mapGeometry(geometry: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in geometry) {
    if (key === "indices") {
      result.cells = geometry[key];
    } else if (GEOMETRY_PASSTHROUGH.has(key)) {
      result[key] = geometry[key];
    } else if (PEX_ATTRIBUTE_NAME_MAP[key]) {
      result[PEX_ATTRIBUTE_NAME_MAP[key]] = geometry[key];
    } else if (key.startsWith("_")) {
      // Application-specific semantics, which mesh.primitive and
      // EXT_mesh_gpu_instancing both spell with a leading underscore. Keyed by
      // the WGSL vertex input a material hook declares to read it — so `_COLOR`
      // lands on the instanced `color` input the renderers already know.
      (result.attributes ??= {})[key.slice(1).toLowerCase()] = geometry[key];
    } else {
      // A spec semantic we do not implement: the second UV set is the last one
      // the shaders declare, and one joints/weights set the last skin influence.
      console.debug(`${NAMESPACE} glTF loader: unsupported attribute`, key);
    }
  }

  return result;
}

// Material component fields follow the glTF vocabulary, so mapping is a
// passthrough bar two things: the spec's `Factor` suffix, which the components
// drop, and colour factors, which the shaders expect sRGB-encoded (they decode
// internally) while glTF authors them linear.
const srgb = (color: number[]): number[] =>
  fromLinear(
    [],
    color[0]!,
    color[1]!,
    color[2]!,
    color.length === 4 ? color[3]! : 1,
  );
const SRGB_MATERIAL_FACTORS: Record<string, (color: number[]) => number[]> = {
  baseColorFactor: srgb,
  emissiveFactor: srgb,
  sheenColorFactor: srgb,
  sgDiffuseFactor: srgb,
  // uMaterial.sgSpecular is a vec3f and fromLinear always writes an alpha.
  sgSpecularFactor: (color) => srgb(color).slice(0, 3),
};
// glTF material fields mapMaterial consumes itself rather than carries over.
const MATERIAL_CONSUMED = new Set([
  "name",
  "unlit",
  "doubleSided",
  "alphaMode",
]);

function mapMaterial(material: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {
    name: material.name,
    unlit: material.unlit || undefined,
    cullMode: material.doubleSided ? "none" : "back",
    castShadows: true,
    receiveShadows: true,
  };

  for (const key in material) {
    if (MATERIAL_CONSUMED.has(key)) continue;
    const value = material[key];
    if (value === undefined) continue;
    const toSrgb = SRGB_MATERIAL_FACTORS[key];
    result[key.replace(/Factor$/, "")] = toSrgb ? toSrgb(value) : value;
  }

  // depthWriteEnabled follows from blend in the renderers, as the spec requires.
  if (material.alphaMode === "BLEND") result.blend = "normal";

  return result;
}

// KHR_lights_punctual measures directional lights in lux, which is
// pex-renderer's unit too, but point and spot lights in candela, where
// pex-renderer authors luminous power. This is the only place candela exists.
function buildLightComponent(light: Record<string, any>) {
  const common = {
    // Same sRGB convention as material factors: the shader decodes the light
    // colour, and glTF authors it linear.
    color: srgb(light.color),
    // An absent range is infinite, which is the components' own default.
    ...(light.range !== undefined && { range: light.range }),
  };

  switch (light.type) {
    case "directional":
      return components.directionalLight({
        ...common,
        intensity: light.intensity,
      });
    case "point":
      return components.pointLight({
        ...common,
        intensity: pointIntensityToPower(light.intensity),
      });
    case "spot":
      return components.spotLight({
        ...common,
        // The spec defines the intensity as the brightness inside the inner
        // cone, so the beam is focused by definition.
        intensity: spotIntensityToPower(
          light.intensity,
          light.outerConeAngle,
          true,
        ),
        focusedSpot: true,
        innerConeAngle: light.innerConeAngle,
        outerConeAngle: light.outerConeAngle,
      });
    default:
      throw new Error(`Unexpected light type: ${light.type}`);
  }
}

interface BuildContext {
  document: GltfDocument;
  nodeEntities: Map<number, Entity[]>;
}

function buildNode(
  nodeIndex: number,
  ctx: BuildContext,
  parentTransform: any,
  sceneEntities: Entity[],
): Entity[] {
  const cached = ctx.nodeEntities.get(nodeIndex);
  if (cached) return cached;

  const node = ctx.document.nodes[nodeIndex]!;
  const entityComponents: Record<string, any> = {
    transform: components.transform({
      ...node.transform,
      parent: parentTransform,
    }),
  };

  if (node.camera) entityComponents.camera = components.camera(node.camera);
  if (node.light) {
    entityComponents[`${node.light.type}Light`] = buildLightComponent(
      node.light,
    );
  }

  const nodeEntity = createEntity(entityComponents);
  nodeEntity.name = node.name || `node_${nodeIndex}`;
  sceneEntities.push(nodeEntity);

  const skinComponent: Record<string, any> | null = node.skin
    ? components.skin({})
    : null;

  let resultEntities = [nodeEntity];

  if (node.primitives) {
    const primitiveComponents = node.primitives.map(
      ({ geometry, material, morph }) => {
        const entityProps: Record<string, any> = {
          geometry: components.geometry(mapGeometry(geometry)),
          material: components.material(mapMaterial(material)),
        };
        if (morph) {
          entityProps.morph = components.morph({
            sources: mapKeys(morph.sources, mapAttributeName),
            targets: mapKeys(morph.targets, mapAttributeName),
            weights: morph.weights,
          });
        }
        return entityProps;
      },
    );

    if (primitiveComponents.length === 1) {
      Object.assign(nodeEntity, primitiveComponents[0]);
      if (skinComponent) nodeEntity.skin = skinComponent;
    } else {
      const subEntities = primitiveComponents.map((props, j) => {
        const subEntity = createEntity(props);
        subEntity.name = `node_${nodeIndex}_${j}`;
        subEntity.transform = components.transform({
          parent: nodeEntity.transform,
        });
        if (skinComponent) subEntity.skin = skinComponent;
        sceneEntities.push(subEntity);
        return subEntity;
      });
      resultEntities = [nodeEntity, ...subEntities];
    }
  }

  ctx.nodeEntities.set(nodeIndex, resultEntities);

  for (const childIndex of node.childrenIndices) {
    buildNode(childIndex, ctx, nodeEntity.transform, sceneEntities);
  }

  return resultEntities;
}

/**
 * Resolves every node.skin's joint node indices into entities + fresh joint
 * matrices.
 */
function resolveSkins(ctx: BuildContext): void {
  ctx.document.nodes.forEach((node: ResolvedGltfNode, nodeIndex: number) => {
    if (!node.skin) return;

    const entities = ctx.nodeEntities.get(nodeIndex);
    const skinComponent: any = entities?.find((e) => e.skin)?.skin;
    if (!skinComponent) return;

    const joints = node.skin.jointNodeIndices.map(
      (jointNodeIndex) => ctx.nodeEntities.get(jointNodeIndex)?.[0]!,
    );
    skinComponent.inverseBindMatrices = node.skin.inverseBindMatrices;
    skinComponent.joints = joints;
    skinComponent.jointMatrices = joints.map(() => mat4.create());
  });
}

function buildAnimations(
  document: GltfDocument,
  nodeEntities: Map<number, Entity[]>,
) {
  return document.animations.map((animation) =>
    components.animation({
      name: animation.name,
      duration: animation.duration,
      loop: true,
      channels: animation.channels.map((channel) => ({
        input: channel.input,
        output: channel.output,
        interpolation: channel.interpolation,
        target: nodeEntities.get(channel.targetNodeIndex)?.[0],
        path: channel.path,
      })),
    }),
  );
}

export interface GltfScene {
  name?: string | undefined;
  root: Entity;
  entities: Entity[];
}

/**
 * Converts a generic GltfDocument (see loaders/glTF/document.ts) into
 * pex-renderer scenes: entity trees built from components, one per glTF scene.
 * This is the only file in loaders/glTF/ that imports pex-renderer's
 * entity/components/systems.
 */
function buildGltfScenes(document: GltfDocument): GltfScene[] {
  const buildCtx: BuildContext = { document, nodeEntities: new Map() };

  const scenes = document.scenes.map((scene): GltfScene => {
    const root = createEntity({ transform: components.transform({}) });
    root.name = scene.name || "scene";

    const entities: Entity[] = [root];
    for (const rootNodeIndex of scene.rootNodeIndices) {
      buildNode(rootNodeIndex, buildCtx, root.transform, entities);
    }

    if (scene.reflectionProbe) {
      const reflectionProbeEntity = createEntity({
        transform: components.transform(
          scene.reflectionProbe.rotation
            ? { rotation: scene.reflectionProbe.rotation }
            : {},
        ),
        reflectionProbe: components.reflectionProbe({
          data: scene.reflectionProbe,
        }),
      });
      reflectionProbeEntity.name = "EXT_lights_image_based";
      entities.push(reflectionProbeEntity);
    }

    return { name: scene.name, root, entities };
  });

  resolveSkins(buildCtx);

  if (document.animations.length) {
    const animations = buildAnimations(document, buildCtx.nodeEntities);
    const rootWithAnimations = scenes[0]?.root;
    if (rootWithAnimations) {
      rootWithAnimations.animations = animations;
      rootWithAnimations.animation = animations[0]!;
    }
  }

  // Assuming all entities have a transform and loaded geometry has bounds
  // (animation input and vertex position accessors must, per spec).
  const transformSystem = systems.transform();
  for (const scene of scenes) {
    transformSystem.sort(scene.entities);
    transformSystem.update(scene.entities);
  }
  transformSystem.dispose();

  return scenes;
}

export default buildGltfScenes;
