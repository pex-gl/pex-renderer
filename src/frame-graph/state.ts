import { NAMESPACE } from "../utils.js";

import type {
  ColorAttachmentDeclaration,
  CompiledResource,
  DepthStencilAttachmentDeclaration,
  PassDeclaration,
  PhysicalResource,
  ResourceHandle,
  TextureDescriptor,
} from "./types.js";

/**
 * One attachment write. Kept per (resource, layer, level) so load/store ops are
 * derived per chain: six cube faces of a shadow map are six chains.
 */
export interface WriteSite {
  resource: number;
  layer: number;
  level: number;
  resolveTarget?: number;
}

/** Declaration-phase bookkeeping behind a resource. */
export interface ResourceEntry
  extends Pick<
    CompiledResource,
    "index" | "name" | "kind" | "descriptor" | "usage"
  > {
  handle: ResourceHandle;
  /** Set for imported resources; the graph never allocates or recycles these. */
  imported?: PhysicalResource;
  /** Observed outside the graph, so its last write must be stored and kept. */
  exported: boolean;
  /** Holds a dedicated texture across frames; never pooled. */
  persistent?: boolean;
  /** Declaration index of the last pass to write it, -1 if never written. */
  lastWriter: number;
  /** Declaration indices reading the current version, for write-after-read edges. */
  currentReaders: number[];
  /** Number of read edges; drives culling. */
  refCount: number;
}

/** A declared pass with its defaults resolved. */
export interface PassEntry
  extends Required<
      Pick<PassDeclaration, "name" | "type" | "neverCull" | "execute">
    >,
    Pick<PassDeclaration, "uniforms" | "renderView"> {
  index: number;
  color: ColorAttachmentDeclaration[];
  depth?: DepthStencilAttachmentDeclaration;
  reads: number[];
  writes: WriteSite[];
  /** Declaration indices this pass must run after. */
  dependencies: Set<number>;
  /** Number of live resources this pass writes; drives culling. */
  refCount: number;
  culled: boolean;
}

/**
 * Where the graph is in the declare → compile → execute cycle; every phase guard
 * reads it.
 *
 * `executing` covers a pass's `execute` callback only, not the whole of
 * {@link FrameGraph.execute}, so resolving a handle between passes still throws.
 */
export type GraphPhase =
  | "idle"
  | "declaring"
  | "declared"
  | "compiled"
  | "executing";

export interface GraphState {
  resources: ResourceEntry[];
  passes: PassEntry[];
  /** Names in declaration order, for duplicate detection and overrides. */
  passNames: Set<string>;
  /** Persistent names declared this frame; two sharing one would share a texture. */
  persistentNames: Set<string>;
  phase: GraphPhase;
}

export const createGraphState = (): GraphState => ({
  resources: [],
  passes: [],
  passNames: new Set(),
  persistentNames: new Set(),
  phase: "idle",
});

export const resetGraphState = (state: GraphState): void => {
  state.resources.length = 0;
  state.passes.length = 0;
  state.passNames.clear();
  state.persistentNames.clear();
  state.phase = "idle";
};

/** Guards a phase-restricted call. */
export const requirePhase = (
  state: GraphState,
  expected: GraphPhase,
  what: string,
  hint?: string,
): void => {
  if (state.phase === expected) return;

  throw new Error(
    `${NAMESPACE}: ${what} while the frame graph is "${state.phase}" — only valid while "${expected}".${hint ? ` ${hint}` : ""}`,
  );
};

export const isTextureDescriptor = (
  descriptor: ResourceEntry["descriptor"],
): descriptor is TextureDescriptor => "width" in descriptor;
