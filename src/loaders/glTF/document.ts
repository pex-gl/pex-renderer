import { loadJson, loadArrayBuffer } from "pex-io";

import { loadData, isBase64, decodeBase64 } from "./io.js";
import { SUPPORTED_EXTENSIONS, isSafari } from "./common.js";
import { getFileExtension, getDirname, isObject } from "../../utils.js";
import { resolveImages } from "./texture.js";
import { resolveNodeTransform, type ResolvedNodeTransform } from "./node.js";
import { resolveCamera } from "./camera.js";
import { resolveLight } from "./light.js";
import { resolveSkin } from "./skin.js";
import { resolveAnimation, type ResolvedAnimationChannel } from "./animation.js";
import { resolveMesh } from "./mesh.js";
import { resolveMeshGpuInstancing } from "./extensions/EXT_mesh_gpu_instancing.js";
import { resolveLightsImageBased } from "./extensions/EXT_lights_image_based.js";

import type { GpuContext, ReflectionProbePrebakedData } from "../../types.js";

export interface ResolvedGltfNode {
  name: string;
  transform: ResolvedNodeTransform;
  childrenIndices: number[];
  cameraIndex?: number;
  camera?: Record<string, any>;
  lightIndex?: number;
  light?: Record<string, any>;
  meshIndex?: number;
  primitives?: Awaited<ReturnType<typeof resolveMesh>>;
  skinIndex?: number;
  skin?: { jointNodeIndices: number[]; inverseBindMatrices: Float32Array[] };
}

export interface ResolvedGltfScene {
  name?: string;
  rootNodeIndices: number[];
  reflectionProbe: ReflectionProbePrebakedData | null;
}

export interface GltfDocument {
  ctx: GpuContext;
  asset: any;
  defaultSceneIndex: number;
  scenes: ResolvedGltfScene[];
  nodes: ResolvedGltfNode[];
  animations: { name: string; duration: number; channels: ResolvedAnimationChannel[] }[];
}

export interface LoadGltfDocumentOptions {
  ctx: GpuContext;
  basePath?: string;
  includeCameras?: boolean;
  includeLights?: boolean;
  includeAnimations?: boolean;
  dracoOptions?: Record<string, any>;
  supportImageBitmap?: boolean;
}

const DEFAULT_OPTIONS = {
  includeCameras: false,
  includeLights: false,
  includeAnimations: true,
  dracoOptions: {},
  supportImageBitmap: !isSafari,
};

/**
 * Loads and fully resolves a glTF/GLB file into a generic, glTF-spec-shaped
 * document: GPU textures/buffers are created via pex-gpu, but node/mesh/
 * material data uses glTF vocabulary throughout (attribute semantics like
 * "POSITION", material fields like "baseColorFactor") — no pex-renderer
 * entity or component types appear anywhere here. See
 * loaders/glTF/pex-renderer.ts for the ECS mapping.
 */
async function loadGltfDocument(
  urlOrData: string | ArrayBuffer | object,
  options: LoadGltfDocumentOptions,
): Promise<GltfDocument> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { ctx } = opts;

  let data: ArrayBuffer | object;
  let basePath = opts.basePath;

  if (urlOrData instanceof ArrayBuffer || isObject(urlOrData)) {
    data = urlOrData as ArrayBuffer | object;
  } else {
    const url = urlOrData as string;
    const extension = getFileExtension(url);
    basePath ??= getDirname(url);
    data = extension === "glb" ? await loadArrayBuffer(url) : await loadJson(url);
  }

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/glTF.schema.json
  const { json, bin } = loadData(data);

  // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#specifying-extensions
  const requiredExtensions = (json.extensionsRequired ?? []).filter(
    (extension: string) => !SUPPORTED_EXTENSIONS.has(extension),
  );
  if (requiredExtensions.length) {
    console.error("glTF loader: missing required extensions", requiredExtensions);
  }
  const unsupportedExtensions = (json.extensionsUsed ?? []).filter(
    (extension: string) => !SUPPORTED_EXTENSIONS.has(extension),
  );
  if (unsupportedExtensions.length) {
    console.warn("glTF loader: unsupported extensions", unsupportedExtensions);
  }

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/asset.schema.json
  const version = Number.parseInt(json.asset.version, 10);
  if (!version || version < 2) {
    console.warn(`glTF loader: invalid or unsupported version: ${json.asset.version}`);
  }

  // Buffers: https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/buffer.schema.json
  await Promise.all(
    (json.buffers ?? []).map(async (buffer: any) => {
      buffer._data = bin
        ? bin
        : isBase64(buffer.uri)
          ? decodeBase64(buffer.uri)
          : await loadArrayBuffer([basePath, buffer.uri].join("/"));
    }),
  );

  // Buffer views: https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/bufferView.schema.json
  for (const bufferView of json.bufferViews ?? []) {
    const bufferData = json.buffers[bufferView.buffer]._data;
    bufferView.byteOffset ??= 0;
    bufferView._data = bufferData.slice(
      bufferView.byteOffset,
      bufferView.byteOffset + bufferView.byteLength,
    );
  }

  await resolveImages(json, {
    basePath,
    supportImageBitmap: opts.supportImageBitmap,
  });

  const samplerCache = new Map<number, GPUSampler>();

  // Nodes are resolved once globally (not per scene): scene membership is
  // just a set of root indices into this shared array, walked by the ECS
  // wrapper — fixes the previous loader's "every scene re-walks every node"
  // bug (glTF-Sample-Assets' MultipleScenes test) as a side effect.
  const nodes: ResolvedGltfNode[] = await Promise.all(
    (json.nodes ?? []).map(async (node: any): Promise<ResolvedGltfNode> => {
      const resolved: ResolvedGltfNode = {
        name: node.name,
        transform: resolveNodeTransform(node),
        childrenIndices: node.children ?? [],
      };

      if (opts.includeCameras && Number.isInteger(node.camera)) {
        resolved.cameraIndex = node.camera;
        resolved.camera = resolveCamera(json.cameras[node.camera], ctx);
      }

      // https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_lights_punctual
      const lightIndex = node.extensions?.KHR_lights_punctual?.light;
      if (opts.includeLights && Number.isInteger(lightIndex)) {
        resolved.lightIndex = lightIndex;
        resolved.light = resolveLight(json.extensions.KHR_lights_punctual.lights[lightIndex]);
      }

      if (Number.isInteger(node.skin)) {
        resolved.skinIndex = node.skin;
        resolved.skin = resolveSkin(json.skins[node.skin], json);
      }

      if (Number.isInteger(node.mesh)) {
        resolved.meshIndex = node.mesh;
        const instancedAttributes = resolveMeshGpuInstancing(node, json, ctx);
        resolved.primitives = await resolveMesh(
          json.meshes[node.mesh],
          instancedAttributes,
          json,
          ctx,
          samplerCache,
          { dracoOptions: opts.dracoOptions },
        );
      }

      return resolved;
    }),
  );

  const animations = opts.includeAnimations
    ? (json.animations ?? []).map((animation: any, index: number) =>
        resolveAnimation(animation, json, index),
      )
    : [];

  const scenes: ResolvedGltfScene[] = (json.scenes ?? [{ nodes: [] }]).map(
    (scene: any) => ({
      name: scene.name,
      rootNodeIndices: scene.nodes ?? [],
      reflectionProbe: resolveLightsImageBased(scene, json),
    }),
  );

  return {
    ctx,
    asset: json.asset,
    defaultSceneIndex: json.scene ?? 0,
    scenes,
    nodes,
    animations,
  };
}

export default loadGltfDocument;
