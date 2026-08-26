import { createTimestampQuery } from "pex-gpu";

import { NAMESPACE } from "../utils.js";

import type { TimestampQuery } from "pex-gpu";
import type { GpuContext } from "../types.js";

/** One pass' measured GPU time, in milliseconds. */
export interface PassTiming {
  name: string;
  ms: number;
  /**
   * False when the pass wrote no usable timestamps. A query slot the GPU never
   * filled reads as whatever was there, so a frame that died mid-pass yields
   * wild values — reporting those as a measurement is worse than reporting
   * nothing, since they are indistinguishable from a real result.
   */
  valid: boolean;
}

/** Longer than any plausible pass; beyond this the slot was never written. */
const MAX_PLAUSIBLE_MS = 10_000;

/**
 * A query set plus the reads still outstanding against it. Disposing destroys
 * the readback buffer, which rejects any `mapAsync` already in flight, so a set
 * is only released once its last read has settled.
 */
interface QuerySlot {
  query: TimestampQuery;
  capacity: number;
  reads: number;
  retired: boolean;
}

/**
 * Slots are allocated in blocks so the pass count moving by one — an effect
 * toggling, MSAA adding its resolve — doesn't reallocate the query set.
 */
const CAPACITY_BLOCK = 32;

/**
 * Per-pass GPU timing, from WebGPU timestamp queries.
 *
 * Answers the only question a frame time can't: which pass spent it. Recording
 * time and `onSubmittedWorkDone` both measure the whole queue, so a frame that
 * costs 50ms says nothing about where.
 *
 * Two slots per pass, written by the GPU at the pass boundaries, so the numbers
 * are device timestamps rather than anything the CPU observed. Results lag a
 * frame or two: the readback is asynchronous and skipped while a previous one
 * is mapping, which is why `latest` is a snapshot rather than this frame's
 * result.
 */
export class PassProfiler {
  ctx: GpuContext;
  slot: QuerySlot | undefined;
  /** Pass names in plan order, rebuilt each frame as descriptors are built. */
  names: string[] = [];
  /** Most recent completed read, in plan order. */
  latest: PassTiming[] = [];
  /** Set once the feature turns out to be missing, so it reports once. */
  unavailable = false;

  constructor(ctx: GpuContext) {
    this.ctx = ctx;
  }

  /** Release a slot once nothing is reading from it. */
  #releaseIfIdle(slot: QuerySlot): void {
    if (slot.retired && slot.reads === 0) slot.query.dispose();
  }

  /**
   * Size the query set for this frame's passes. Returns false when timing is
   * unavailable, which leaves every `writesFor` empty and costs nothing.
   */
  begin(passCount: number): boolean {
    if (this.unavailable) return false;

    if (!this.ctx.device.features.has("timestamp-query")) {
      this.unavailable = true;
      console.error(
        NAMESPACE,
        "frame-graph",
        'per-pass profiling needs the "timestamp-query" feature. Create the context with requiredFeatures: ["timestamp-query"].',
      );
      return false;
    }

    const needed = passCount * 2;
    if (!this.slot || needed > this.slot.capacity) {
      if (this.slot) {
        // Retired rather than disposed: a read started last frame is still
        // mapping its buffer, and destroying it now rejects that read.
        this.slot.retired = true;
        this.#releaseIfIdle(this.slot);
      }
      const capacity = Math.ceil(needed / CAPACITY_BLOCK) * CAPACITY_BLOCK;
      this.slot = {
        query: createTimestampQuery(this.ctx, capacity),
        capacity,
        reads: 0,
        retired: false,
      };
    }
    this.names = [];
    return true;
  }

  /** Timestamp writes for the pass at `index`, recording its name in order. */
  writesFor(
    index: number,
    name: string,
  ): GPURenderPassTimestampWrites | undefined {
    const { slot } = this;
    if (!slot || index * 2 + 1 >= slot.capacity) return undefined;

    this.names[index] = name;
    return {
      querySet: slot.query.querySet,
      beginningOfPassWriteIndex: index * 2,
      endOfPassWriteIndex: index * 2 + 1,
    };
  }

  /**
   * Encode the resolve and start a read. Must run after the passes are encoded
   * and before the frame's submit; the read is deliberately not awaited, since
   * awaiting it would stall the very submit it depends on.
   */
  end(encoder: GPUCommandEncoder): void {
    const { slot } = this;
    if (!slot) return;

    slot.query.resolve(encoder);

    // Captured per frame: `names` is replaced (not cleared) by begin(), so the
    // read below stays matched to the frame whose resolve it belongs to.
    const names = this.names;
    slot.reads++;
    void (async () => {
      try {
        const timestamps = await slot.query.read();
        if (!timestamps) return;

        const timings: PassTiming[] = [];
        for (let index = 0; index < names.length; index++) {
          const name = names[index];
          if (name === undefined) continue;
          // Subtract as BigInt nanoseconds, before the values lose precision
          // as Numbers.
          const ms =
            Number(timestamps[index * 2 + 1]! - timestamps[index * 2]!) / 1e6;
          const valid = Number.isFinite(ms) && ms >= 0 && ms < MAX_PLAUSIBLE_MS;
          timings.push({ name, ms, valid });
        }
        this.latest = timings;
      } catch {
        // A retired set can still be destroyed out from under an in-flight
        // read on device loss; a dropped frame of timings is not worth
        // reporting.
      } finally {
        slot.reads--;
        this.#releaseIfIdle(slot);
      }
    })();
  }

  /**
   * Slowest first. Unmeasured passes sort to the top rather than being hidden:
   * a pass that failed to report is usually the one being looked for.
   *
   * Chrome quantises timestamp query results, so anything under ~0.1ms is
   * granularity rather than signal.
   */
  report(): string {
    let total = 0;
    let unmeasured = 0;
    for (const { ms, valid } of this.latest) {
      if (valid) total += ms;
      else unmeasured++;
    }

    const rows = [...this.latest]
      .sort((left, right) => {
        if (left.valid !== right.valid) return left.valid ? 1 : -1;
        return right.ms - left.ms;
      })
      .map(({ name, ms, valid }) =>
        valid
          ? `  ${ms.toFixed(3).padStart(11)}ms  ${name}`
          : `  ${"unmeasured".padStart(13)}  ${name}`,
      );

    const header =
      `GPU ${total.toFixed(3)}ms total` +
      (unmeasured ? ` (${unmeasured} pass(es) unmeasured)` : "");
    return [header, ...rows].join("\n");
  }

  dispose(): void {
    if (!this.slot) return;
    this.slot.retired = true;
    this.#releaseIfIdle(this.slot);
    this.slot = undefined;
  }
}
