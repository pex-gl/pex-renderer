import loadGltfDocument from "./document.js";
import buildGltfScenes from "./pex-renderer.js";

export { default as loadGltfDocument } from "./document.js";
export type { GltfDocument, LoadGltfDocumentOptions } from "./document.js";
export type { GltfScene } from "./pex-renderer.js";

import type { LoadGltfDocumentOptions } from "./document.js";
import type { GltfScene } from "./pex-renderer.js";

/**
 * Loads a glTF/GLB file and converts it into pex-renderer entities, one
 * {@link GltfScene} per glTF scene. For a generic, non-ECS representation
 * (e.g. to drive a different renderer on top of pex-gpu), use
 * {@link loadGltfDocument} directly instead.
 */
async function loadGltf(
  urlOrData: string | ArrayBuffer | object,
  options: LoadGltfDocumentOptions,
): Promise<GltfScene[]> {
  const document = await loadGltfDocument(urlOrData, options);
  return buildGltfScenes(document);
}

export default loadGltf;
