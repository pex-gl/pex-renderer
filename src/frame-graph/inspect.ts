import { isTextureDescriptor } from "./state.js";

import type { GraphState } from "./state.js";
import type { PoolStats, ResourcePool } from "./pool.js";
import type {
  CompiledColorAttachment,
  CompiledPass,
  CompiledPlan,
  CompiledResource,
  CulledPass,
  InspectableRegister,
  RegisterPublication,
  TextureDescriptor,
} from "./types.js";

/** An attachment with its resource resolved to a name. */
export interface InspectedAttachment
  extends Pick<CompiledColorAttachment, "loadOp" | "storeOp"> {
  name: string;
  physicalId?: number;
}

export interface InspectedPass extends Pick<CompiledPass, "name"> {
  /** Names folded into this render pass by merging, in execution order. */
  subPasses: string[];
  index: number;
  reads: string[];
  writes: string[];
  colorAttachments: InspectedAttachment[];
  depthAttachment?: InspectedAttachment;
}

/** A compiled resource flattened for display; shape fields are texture-only. */
export interface InspectedResource
  extends Pick<
      CompiledResource,
      | "name"
      | "kind"
      | "imported"
      | "transient"
      | "persistent"
      | "culled"
      | "firstUse"
      | "lastUse"
      | "bytes"
      | "physicalId"
    >,
    Partial<Pick<TextureDescriptor, "format" | "width" | "height">> {}

/** One view's register, as publications plus what each name settled on. */
export interface InspectedRegister {
  /** Blackboard key it was published under, eg. "renderTextures.3". */
  key: string;
  publications: (RegisterPublication & {
    /**
     * Compiled pass index this publication follows, or -1 when it precedes
     * every surviving pass. Declaration indices don't survive culling and
     * merging, so they are mapped rather than reported raw.
     */
    afterPass: number;
  })[];
  /** Resource name each register name ended the frame holding. */
  current: Record<string, string>;
}

export interface GraphInspection {
  passes: InspectedPass[];
  culledPasses: CulledPass[];
  resources: InspectedResource[];
  /**
   * Named resources modules published to each other this frame. Answers "which
   * texture is `color` here", which the pass list alone cannot: the name is a
   * register entry, not a pass output.
   */
  registers: InspectedRegister[];
  memory: {
    /** Peak simultaneous transient bytes, with recycling. */
    peakBytes: number;
    /** What the same frame would cost without it. */
    naiveBytes: number;
    savedBytes: number;
    pool: PoolStats;
  };
  stats: CompiledPlan["stats"];
}

/**
 * Plain-data view of the compiled frame, for debug overlays and graph viewers.
 * Not a renderer: consumers decide how to draw it.
 */
export default function inspect(
  state: GraphState,
  plan: CompiledPlan | undefined,
  pool: Pick<ResourcePool, "stats">,
  blackboard: ReadonlyMap<string, unknown> = new Map(),
): GraphInspection {
  const empty: GraphInspection = {
    passes: [],
    culledPasses: [],
    resources: [],
    registers: [],
    memory: {
      peakBytes: 0,
      naiveBytes: 0,
      savedBytes: 0,
      pool: pool.stats(),
    },
    stats: {
      declaredPasses: 0,
      culledPasses: 0,
      mergedPasses: 0,
      peakBytes: 0,
      naiveBytes: 0,
    },
  };
  if (!plan) return empty;

  const resourceName = (index: number) =>
    plan.resources[index]?.name ?? `resource${index}`;
  const physicalId = (index: number) => plan.resources[index]?.physicalId;

  const inspectAttachment = (
    attachment: Pick<CompiledColorAttachment, "handle" | "loadOp" | "storeOp">,
  ): InspectedAttachment => {
    const id = physicalId(attachment.handle.index);
    return {
      name: attachment.handle.name,
      loadOp: attachment.loadOp,
      storeOp: attachment.storeOp,
      ...(id !== undefined && { physicalId: id }),
    };
  };

  const passes: InspectedPass[] = plan.passes.map((pass, index) => ({
    name: pass.name,
    subPasses: pass.subPasses.map((subPass) => subPass.name),
    index,
    reads: pass.reads.map(resourceName),
    writes: pass.writes.map(resourceName),
    colorAttachments: pass.color.map(inspectAttachment),
    ...(pass.depth && { depthAttachment: inspectAttachment(pass.depth) }),
  }));

  const resources: InspectedResource[] = plan.resources.map((resource) => {
    const descriptor = isTextureDescriptor(resource.descriptor)
      ? resource.descriptor
      : undefined;
    return {
      name: resource.name,
      kind: resource.kind,
      imported: resource.imported,
      transient: resource.transient,
      persistent: resource.persistent,
      culled: resource.culled,
      firstUse: resource.firstUse,
      lastUse: resource.lastUse,
      bytes: resource.bytes,
      ...(resource.physicalId !== undefined && {
        physicalId: resource.physicalId,
      }),
      ...(descriptor?.format && { format: descriptor.format }),
      ...(descriptor && {
        width: descriptor.width,
        height: descriptor.height,
        depth: descriptor.depth,
      }),
    };
  });

  // Declaration index -> compiled pass index. A declaration folded into a
  // merged pass reports that pass; a culled one has none, so the last surviving
  // declaration before it stands in.
  const compiledIndexByDeclaration = new Array<number>(
    state.passes.length,
  ).fill(-1);
  plan.passes.forEach((pass, index) => {
    for (const subPass of pass.subPasses) {
      compiledIndexByDeclaration[subPass.declarationIndex] = index;
    }
  });
  let latest = -1;
  for (let i = 0; i < compiledIndexByDeclaration.length; i++) {
    if (compiledIndexByDeclaration[i] === -1) compiledIndexByDeclaration[i] = latest;
    else latest = compiledIndexByDeclaration[i]!;
  }

  const registers: InspectedRegister[] = [];
  for (const [key, value] of blackboard) {
    const register = value as Partial<InspectableRegister> | undefined;
    if (typeof register?.inspectRegister !== "function") continue;

    const publications = register.inspectRegister().map((publication) => ({
      ...publication,
      afterPass:
        compiledIndexByDeclaration[publication.declaredAfter - 1] ?? -1,
    }));
    const current: Record<string, string> = {};
    for (const { name, resource } of publications) current[name] = resource;
    registers.push({ key, publications, current });
  }

  return {
    passes,
    culledPasses: plan.culledPasses,
    resources,
    registers,
    memory: {
      peakBytes: plan.stats.peakBytes,
      naiveBytes: plan.stats.naiveBytes,
      savedBytes: plan.stats.naiveBytes - plan.stats.peakBytes,
      pool: pool.stats(),
    },
    stats: plan.stats,
  };
}

/** Resource lifetimes as rows on the pass timeline: shows where the peak sits. */
export function memoryTimeline(inspection: GraphInspection): {
  passCount: number;
  rows: Pick<
    InspectedResource,
    "name" | "firstUse" | "lastUse" | "bytes" | "physicalId"
  >[];
} {
  return {
    passCount: inspection.passes.length,
    rows: inspection.resources
      .filter((resource) => !resource.culled && !resource.imported)
      .sort((a, b) => a.firstUse - b.firstUse || b.bytes - a.bytes)
      .map((resource) => ({
        name: resource.name,
        firstUse: resource.firstUse,
        lastUse: resource.lastUse,
        bytes: resource.bytes,
        ...(resource.physicalId !== undefined && {
          physicalId: resource.physicalId,
        }),
      })),
  };
}
