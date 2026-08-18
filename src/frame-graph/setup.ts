/**
 * Declaration helpers: record resources and the edges between them into a
 * {@link GraphState}. {@link FrameGraph} holds the API that calls them.
 *
 * Handles identify a resource, not a version of it — reads bind to the latest
 * write declared before them. Versioning lives in the edges recorded here.
 */

import { NAMESPACE } from "../utils.js";
import { isResourceHandle } from "./types.js";

import type { GraphState, PassEntry, ResourceEntry } from "./state.js";
import type {
  ColorAttachmentDeclaration,
  PassUniforms,
  PhysicalResource,
  ResourceHandle,
} from "./types.js";

const createHandle = (index: number, name: string): ResourceHandle =>
  Object.freeze({ __frameGraphResource: true as const, index, name });

export const addResource = (
  state: GraphState,
  name: string,
  kind: ResourceEntry["kind"],
  descriptor: ResourceEntry["descriptor"],
  imported?: PhysicalResource,
): ResourceHandle => {
  const index = state.resources.length;
  const handle = createHandle(index, name);
  const entry: ResourceEntry = {
    index,
    name,
    kind,
    descriptor,
    handle,
    exported: false,
    usage: 0,
    lastWriter: -1,
    currentReaders: [],
    refCount: 0,
  };
  if (imported) {
    entry.imported = imported;
    // Someone else's resource, so always observable: nothing writing it culls.
    entry.exported = true;
    entry.refCount = 1;
  }
  state.resources.push(entry);
  return handle;
};

/** Handle-valued entries in a uniform bag are read edges. */
export const collectUniformReads = (
  uniforms: PassUniforms | undefined,
  into: ResourceHandle[],
): void => {
  if (!uniforms) return;
  for (const value of Object.values(uniforms)) {
    if (isResourceHandle(value)) into.push(value);
  }
};

export const readResource = (
  state: GraphState,
  pass: PassEntry,
  handle: ResourceHandle,
  usage: GPUTextureUsageFlags | GPUBufferUsageFlags,
): void => {
  const resource = state.resources[handle.index];
  if (!resource) throw new Error(`${NAMESPACE}: unknown resource handle`);

  if (pass.reads.includes(handle.index)) return;

  resource.usage |= usage;
  resource.refCount++;
  resource.currentReaders.push(pass.index);
  pass.reads.push(handle.index);

  if (resource.lastWriter >= 0) pass.dependencies.add(resource.lastWriter);
};

export const writeResource = (
  state: GraphState,
  pass: PassEntry,
  handle: ResourceHandle,
  usage: GPUTextureUsageFlags | GPUBufferUsageFlags,
  site: Pick<ColorAttachmentDeclaration, "layer" | "level" | "resolveTarget">,
): void => {
  const resource = state.resources[handle.index];
  if (!resource) throw new Error(`${NAMESPACE}: unknown resource handle`);

  if (pass.reads.includes(handle.index)) {
    throw new Error(
      `${NAMESPACE}: pass "${pass.name}" both reads and writes "${resource.name}". WebGPU forbids sampling a texture that is an attachment of the same pass; use a separate target.`,
    );
  }

  resource.usage |= usage;

  // Write-after-read and write-after-write: run after everyone who observed
  // the previous contents.
  for (const reader of resource.currentReaders) pass.dependencies.add(reader);
  if (resource.lastWriter >= 0) pass.dependencies.add(resource.lastWriter);

  resource.lastWriter = pass.index;
  resource.currentReaders = [];

  pass.writes.push({
    resource: handle.index,
    layer: site.layer ?? 0,
    level: site.level ?? 0,
    ...(site.resolveTarget && { resolveTarget: site.resolveTarget.index }),
  });
};
