import { textureByteSize } from "pex-gpu/internals";

import { NAMESPACE } from "../utils.js";
import { isTextureDescriptor } from "./state.js";

import { ResourcePool } from "./pool.js";

import type { GpuTexture } from "../types.js";
import type {
  GraphState,
  PassEntry,
  ResourceEntry,
  WriteSite,
} from "./state.js";
import type {
  CompiledColorAttachment,
  CompiledPass,
  CompiledPlan,
  CulledPass,
  CompiledResource,
  PhysicalResource,
  ResourceHandle,
} from "./types.js";

/** Memoryless attachments, Chrome 146+. Undefined where unsupported. */
const TRANSIENT_ATTACHMENT: GPUTextureUsageFlags | undefined = (
  GPUTextureUsage as unknown as Record<string, GPUTextureUsageFlags>
).TRANSIENT_ATTACHMENT;

/** What compilation works out about one resource. */
interface ResourceCompilation {
  entry: ResourceEntry;
  /** Merged pass indices bounding every use. -1 when never used. */
  firstUse: number;
  lastUse: number;
  bytes: number;
  transient: boolean;
  /** The entry's own flags, plus TRANSIENT_ATTACHMENT when transient. */
  usage: ResourceEntry["usage"];
  physical?: PhysicalResource;
}

/** Attachments are tracked per layer and mip: cube faces are independent chains. */
const siteKey = (site: Pick<WriteSite, "resource" | "layer" | "level">) =>
  `${site.resource}:${site.layer}:${site.level}`;

const attachmentsMatch = (a: PassEntry, b: PassEntry): boolean => {
  if (a.color.length !== b.color.length) return false;
  for (let i = 0; i < a.color.length; i++) {
    const left = a.color[i]!;
    const right = b.color[i]!;
    if (
      left.texture.index !== right.texture.index ||
      (left.layer ?? 0) !== (right.layer ?? 0) ||
      (left.level ?? 0) !== (right.level ?? 0) ||
      left.resolveTarget?.index !== right.resolveTarget?.index
    ) {
      return false;
    }
  }
  if (!a.depth !== !b.depth) return false;
  if (
    a.depth &&
    b.depth &&
    (a.depth.texture.index !== b.depth.texture.index ||
      (a.depth.layer ?? 0) !== (b.depth.layer ?? 0))
  ) {
    return false;
  }
  return true;
};

/**
 * Same attachments and no data flowing between them: one render pass. WebGPU
 * has no subpasses, so merging is the only way to avoid a tile store/reload.
 */
const canMerge = (previous: PassEntry, next: PassEntry): boolean => {
  if (previous.type !== "render" || next.type !== "render") return false;
  // A clear is a real operation on the attachment; folding it away would drop it.
  if (next.color.some((attachment) => attachment.clearValue !== undefined)) {
    return false;
  }
  if (next.depth?.depthClearValue !== undefined) return false;
  if (!attachmentsMatch(previous, next)) return false;
  // Non-attachment data flow (a storage write consumed by the next pass) needs
  // the passes kept apart so WebGPU inserts a barrier between them.
  const previousWrites = new Set(previous.writes.map((write) => write.resource));
  return !next.reads.some((resource) => previousWrites.has(resource));
};

export interface CompileOptions {
  debug?: boolean;
  /** Mark single-pass attachments memoryless. See `FrameGraph.transientAttachments`. */
  transientAttachments?: boolean;
}

/**
 * Turn the declared graph into an execution plan: cull, merge, derive load/store
 * ops and usage flags, then hand out physical resources by lifetime.
 *
 * Declaration order is preserved: setup is sequential, so every dependency
 * already points backwards and no topological sort is needed.
 */
export default function compile(
  state: GraphState,
  // Only the allocation surface, so a stub pool needs nothing else.
  pool: Pick<
    ResourcePool,
    | "acquireTexture"
    | "acquirePersistentTexture"
    | "acquireBuffer"
    | "releaseTexture"
  >,
  options: CompileOptions = {},
): CompiledPlan {
  const { passes, resources } = state;

  // ─── Cull ──────────────────────────────────────────────────────────────────
  const writersByResource: number[][] = resources.map(() => []);
  for (const pass of passes) {
    const written = new Set<number>();
    for (const write of pass.writes) written.add(write.resource);
    pass.refCount = written.size;
    for (const resource of written) writersByResource[resource]!.push(pass.index);
  }

  const stack: number[] = [];
  for (const resource of resources) {
    if (resource.refCount === 0) stack.push(resource.index);
  }
  while (stack.length) {
    const resource = resources[stack.pop()!]!;
    for (const writerIndex of writersByResource[resource.index]!) {
      const writer = passes[writerIndex]!;
      if (writer.neverCull) continue;
      if (--writer.refCount === 0) {
        for (const read of writer.reads) {
          const readResource = resources[read]!;
          if (--readResource.refCount === 0) stack.push(read);
        }
      }
    }
  }

  const live: PassEntry[] = [];
  const culledPasses: CulledPass[] = [];
  for (const pass of passes) {
    pass.culled = pass.refCount === 0 && !pass.neverCull;
    if (pass.culled) {
      culledPasses.push({
        name: pass.name,
        writes: [
          ...new Set(
            pass.writes.map(
              (write) => resources[write.resource]?.name ?? `resource${write.resource}`,
            ),
          ),
        ],
      });
    } else {
      live.push(pass);
    }
  }

  // ─── Merge adjacent passes ─────────────────────────────────────────────────
  const groups: PassEntry[][] = [];
  for (const pass of live) {
    const previousGroup = groups.at(-1);
    if (previousGroup && canMerge(previousGroup.at(-1)!, pass)) {
      previousGroup.push(pass);
    } else {
      groups.push([pass]);
    }
  }

  // ─── Per-resource records ──────────────────────────────────────────────────
  const records: ResourceCompilation[] = resources.map((entry) => ({
    entry,
    firstUse: -1,
    lastUse: -1,
    bytes: isTextureDescriptor(entry.descriptor)
      ? textureByteSize({
          ...entry.descriptor,
          mipLevelCount: ResourcePool.resolveMipLevelCount(entry.descriptor),
        })
      : 0,
    transient: false,
    // A resource read outside the graph has no pass to declare that read in,
    // and the only way to read a texture out there is to sample it — so the
    // usage has to come from the export itself. Covers persistent resources
    // too: `createTexture({ persistent: true })` exports by definition.
    usage:
      entry.usage |
      (entry.exported && entry.kind === "texture"
        ? GPUTextureUsage.TEXTURE_BINDING
        : 0),
    ...(entry.imported && { physical: entry.imported }),
  }));

  // ─── Lifetimes over the merged timeline ────────────────────────────────────
  const touch = (resource: number, group: number) => {
    const record = records[resource]!;
    if (record.firstUse === -1) record.firstUse = group;
    record.lastUse = group;
  };
  for (let group = 0; group < groups.length; group++) {
    for (const pass of groups[group]!) {
      for (const read of pass.reads) touch(read, group);
      for (const write of pass.writes) touch(write.resource, group);
    }
  }

  // ─── Load/store ops ────────────────────────────────────────────────────────
  // A group's attachments are the first sub-pass's (merging requires identity),
  // so ops are derived per group, not per declaration.
  const writtenBefore = new Set<string>();
  const groupAttachments: Pick<CompiledPass, "color" | "depth">[] = [];

  for (let group = 0; group < groups.length; group++) {
    const head = groups[group]![0]!;
    const color: CompiledColorAttachment[] = [];

    const buildAttachment = (
      texture: ResourceHandle,
      layer: number,
      level: number,
      cleared: boolean,
      resolveTarget?: ResourceHandle,
    ): Omit<CompiledColorAttachment, "clearValue"> => {
      const record = records[texture.index]!;
      const { entry } = record;
      const key = siteKey({ resource: texture.index, layer, level });
      // First touch has no contents worth loading: clearing is cheaper than a
      // tile reload.
      const loadOp: GPULoadOp = cleared
        ? "clear"
        : writtenBefore.has(key) || entry.imported
          ? "load"
          : "clear";

      // Stored only if something after this group can observe it.
      let storeOp: GPUStoreOp = "discard";
      if (entry.exported || entry.imported || record.lastUse > group) {
        storeOp = "store";
      }

      writtenBefore.add(key);

      return {
        handle: entry.handle,
        ...(layer !== 0 && { layer }),
        ...(level !== 0 && { level }),
        ...(resolveTarget && {
          resolveTarget: records[resolveTarget.index]!.entry.handle,
        }),
        loadOp,
        storeOp,
      };
    };

    for (const attachment of head.color) {
      color.push({
        ...buildAttachment(
          attachment.texture,
          attachment.layer ?? 0,
          attachment.level ?? 0,
          attachment.clearValue !== undefined,
          attachment.resolveTarget,
        ),
        ...(attachment.clearValue !== undefined && {
          clearValue: attachment.clearValue,
        }),
      });
    }

    const depth = head.depth
      ? {
          ...buildAttachment(
            head.depth.texture,
            head.depth.layer ?? 0,
            0,
            head.depth.depthClearValue !== undefined,
          ),
          ...(head.depth.depthClearValue !== undefined && {
            depthClearValue: head.depth.depthClearValue,
          }),
          ...(head.depth.stencilClearValue !== undefined && {
            stencilClearValue: head.depth.stencilClearValue,
          }),
        }
      : undefined;

    groupAttachments.push({ color, ...(depth && { depth }) });
  }

  // ─── Usage flags, transient attachments, allocation ────────────────────────
  const compiledResources: CompiledResource[] = [];
  let liveBytes = 0;
  let peakBytes = 0;
  let naiveBytes = 0;

  // Which resources come from the pool at each group, and go back after it.
  const acquireAt: ResourceCompilation[][] = groups.map(() => []);
  const releaseAfter: ResourceCompilation[][] = groups.map(() => []);
  for (const record of records) {
    if (record.firstUse === -1) continue;
    acquireAt[record.firstUse]!.push(record);
    releaseAfter[record.lastUse]!.push(record);
  }

  // Transient: whole life in one render pass, never sampled, copied or
  // exported.
  if (TRANSIENT_ATTACHMENT !== undefined && options.transientAttachments) {
    for (const record of records) {
      const { entry } = record;
      record.transient =
        record.firstUse !== -1 &&
        !entry.imported &&
        !entry.exported &&
        entry.usage === GPUTextureUsage.RENDER_ATTACHMENT &&
        record.firstUse === record.lastUse;

      if (record.transient) record.usage |= TRANSIENT_ATTACHMENT;
    }
  }

  for (let group = 0; group < groups.length; group++) {
    for (const record of acquireAt[group]!) {
      const { entry } = record;
      if (entry.imported) continue;

      const { descriptor } = entry;
      if (!isTextureDescriptor(descriptor)) {
        record.physical = pool.acquireBuffer(descriptor);
        continue;
      }

      record.physical = entry.persistent
        ? pool.acquirePersistentTexture(entry.name, descriptor, record.usage)
        : pool.acquireTexture(descriptor, record.usage);
      liveBytes += record.bytes;
      if (liveBytes > peakBytes) peakBytes = liveBytes;
    }

    for (const record of releaseAfter[group]!) {
      const { entry } = record;
      if (entry.imported || entry.kind === "buffer") continue;
      // Read after the graph finishes, so returning it now would let a later
      // pass overwrite what the caller is about to read.
      if (entry.exported || entry.persistent) continue;
      pool.releaseTexture(record.physical as GpuTexture);
      liveBytes -= record.bytes;
    }
  }

  // Released only now: contents survive until something re-acquires and draws
  // into them, which cannot happen before the next frame's execute.
  for (const record of records) {
    const { entry } = record;
    if (
      !entry.exported ||
      entry.persistent ||
      entry.imported ||
      entry.kind === "buffer" ||
      !record.physical
    ) {
      continue;
    }
    pool.releaseTexture(record.physical as GpuTexture);
    liveBytes -= record.bytes;
  }

  for (const record of records) {
    const { entry } = record;
    const used = record.firstUse !== -1;
    if (used && !entry.imported) naiveBytes += record.bytes;

    compiledResources.push({
      index: entry.index,
      name: entry.name,
      kind: entry.kind,
      imported: !!entry.imported,
      descriptor: entry.descriptor,
      usage: record.usage,
      transient: record.transient,
      persistent: !!entry.persistent,
      culled: !used,
      firstUse: record.firstUse,
      lastUse: record.lastUse,
      bytes: record.bytes,
      ...(record.physical && { physicalId: record.physical.id }),
    });
  }

  // ─── Assemble ──────────────────────────────────────────────────────────────
  const compiledPasses: CompiledPass[] = groups.map((group, index) => {
    const head = group[0]!;
    const attachments = groupAttachments[index]!;
    const reads = new Set<number>();
    const writes = new Set<number>();
    for (const pass of group) {
      for (const read of pass.reads) reads.add(read);
      for (const write of pass.writes) writes.add(write.resource);
    }

    const first = head.color[0] ?? head.depth;
    const target = first
      ? records[first.texture.index]!.entry.descriptor
      : undefined;
    const viewport: CompiledPass["viewport"] =
      target && isTextureDescriptor(target)
        ? [0, 0, target.width, target.height]
        : [0, 0, 0, 0];

    return {
      name: head.name,
      label: group.map((pass) => pass.name).join(" + "),
      type: head.type,
      color: attachments.color,
      ...(attachments.depth && { depth: attachments.depth }),
      subPasses: group.map((pass) => ({
        name: pass.name,
        execute: pass.execute,
        declarationIndex: pass.index,
      })),
      reads: [...reads],
      writes: [...writes],
      ...(head.renderView && { renderView: head.renderView }),
      viewport,
    };
  });

  if (options.debug && culledPasses.length) {
    console.debug(
      NAMESPACE,
      "frame-graph",
      `culled ${culledPasses.length} pass(es):`,
      culledPasses
        .map(({ name, writes }) => `${name} (nothing reads ${writes.join(", ")})`)
        .join("; "),
    );
  }

  return {
    passes: compiledPasses,
    resources: compiledResources,
    physical: records.map((record) => record.physical),
    culledPasses,
    stats: {
      declaredPasses: passes.length,
      culledPasses: culledPasses.length,
      mergedPasses: live.length - groups.length,
      peakBytes,
      naiveBytes,
    },
  };
}
