import { createBuffer, createTexture } from "pex-gpu";
import { fullMipLevelCount, textureByteSize } from "pex-gpu/internals";

import type { GpuBuffer, GpuContext, GpuTexture } from "../types.js";
import type { BufferDescriptor, TextureDescriptor } from "./types.js";

export interface PooledTexture {
  texture: GpuTexture;
  bytes: number;
  idleFrames: number;
}

export interface PoolStats {
  /** Bytes held by resources currently handed out. */
  liveBytes: number;
  /** Bytes held by resources sitting in free lists. */
  idleBytes: number;
  /** Highest `liveBytes` seen since creation. */
  peakBytes: number;
  textureCount: number;
  bucketCount: number;
}

/**
 * Physical resource allocator behind the graph's virtual resources. Acquire and
 * release follow compiled lifetimes rather than call order, so a target freed
 * at pass 3 can serve a different resource at pass 4.
 */
export class ResourcePool {
  /**
   * Frames a pooled resource may sit unused before it is disposed. High enough
   * that toggling an effect or resizing doesn't pay for reallocation.
   */
  static IDLE_FRAMES_BEFORE_EVICTION = 30;

  /**
   * Every parameter that must match for two textures to be substitutable,
   * `usage` included: a sampled target needs TEXTURE_BINDING, and a
   * render-attachment-only texture would fail validation at bind time.
   */
  static textureKey(
    descriptor: TextureDescriptor,
    usage: GPUTextureUsageFlags,
    mipLevelCount: number,
  ): string {
    return `${descriptor.format ?? "rgba8unorm"}|${descriptor.width}x${
      descriptor.height
    }x${descriptor.depth ?? 1}|s${descriptor.sampleCount ?? 1}|m${mipLevelCount}|${
      descriptor.viewDimension ?? "2d"
    }|u${usage}`;
  }

  /** What makes two requests the same upload. */
  static bufferKey(descriptor: BufferDescriptor): string {
    const size =
      descriptor.size ??
      (ArrayBuffer.isView(descriptor.data) ? descriptor.data.byteLength : 0);
    return `${descriptor.usage}|${descriptor.label ?? ""}|${size}`;
  }

  /** Levels a descriptor asks for. Static: compile budgets memory with it. */
  static resolveMipLevelCount(descriptor: TextureDescriptor): number {
    return (
      descriptor.mipLevelCount ??
      (descriptor.mipmap
        ? fullMipLevelCount(descriptor.width, descriptor.height)
        : 1)
    );
  }

  ctx: GpuContext;
  /** Free lists of interchangeable textures, keyed by shape and usage. */
  buckets = new Map<string, PooledTexture[]>();
  /** Which bucket a handed-out texture came from, so release is O(1). */
  checkedOut = new Map<GpuTexture, { key: string; bytes: number }>();
  /**
   * Content-addressed rather than pooled: graph uploads are immutable and tiny
   * next to render targets.
   */
  bufferCache = new Map<string, GpuBuffer>();
  /** Keyed by resource name: persistent textures are never substitutable. */
  persistent = new Map<
    string,
    { texture: GpuTexture; key: string; bytes: number; usage: GPUTextureUsageFlags }
  >();

  liveBytes = 0;
  peakBytes = 0;
  /** Never reclaimed, so tracked apart from the pooled total. */
  persistentBytes = 0;

  constructor(ctx: GpuContext) {
    this.ctx = ctx;
  }

  /** The only method that creates a texture; the rest hand out existing ones. */
  allocate(
    { persistent, mipmap, ...descriptor }: TextureDescriptor,
    usage: GPUTextureUsageFlags,
    mipLevelCount: number,
  ): GpuTexture {
    return createTexture(this.ctx, {
      label: "frame-graph texture",
      ...descriptor,
      format: descriptor.format ?? "rgba8unorm",
      // No initial data, so the chain is allocated rather than generated.
      ...(mipLevelCount > 1 && { mipLevelCount }),
      usage,
    });
  }

  acquireTexture(
    descriptor: TextureDescriptor,
    usage: GPUTextureUsageFlags,
  ): GpuTexture {
    const mipLevelCount = ResourcePool.resolveMipLevelCount(descriptor);
    const key = ResourcePool.textureKey(descriptor, usage, mipLevelCount);

    let pooled = this.buckets.get(key)?.pop();
    if (!pooled) {
      const texture = this.allocate(descriptor, usage, mipLevelCount);
      pooled = { texture, bytes: textureByteSize(texture), idleFrames: 0 };
    }

    pooled.idleFrames = 0;
    // Labels play no part in substitutability, so a recycled texture still
    // carries the first allocator's. Restamp it, or captures name the wrong
    // resource.
    if (descriptor.label) pooled.texture.texture.label = descriptor.label;
    this.checkedOut.set(pooled.texture, { key, bytes: pooled.bytes });
    this.liveBytes += pooled.bytes;
    if (this.liveBytes > this.peakBytes) this.peakBytes = this.liveBytes;

    return pooled.texture;
  }

  /**
   * Dedicated texture for `name`, kept across frames and never recycled.
   * Reallocated only if the shape it was created with changes, or if a frame
   * needs it for something the existing one was not created to do.
   *
   * Usage accumulates across frames rather than being taken from the frame in
   * hand, because that is the difference between a persistent resource and a
   * pooled one: its contents have to survive, so it cannot be reallocated
   * merely because this frame uses it differently. A ping-pong pair is exactly
   * that case — each half alternates between being written and only being read
   * — and taking one frame's usage would discard both halves every frame,
   * leaving the reader nothing but a freshly zeroed texture.
   */
  acquirePersistentTexture(
    name: string,
    descriptor: TextureDescriptor,
    usage: GPUTextureUsageFlags,
  ): GpuTexture {
    const mipLevelCount = ResourcePool.resolveMipLevelCount(descriptor);
    const existing = this.persistent.get(name);
    const combined = (existing?.usage ?? 0) | usage;
    const key = ResourcePool.textureKey(descriptor, combined, mipLevelCount);

    if (existing) {
      if (existing.key === key) return existing.texture;
      // Shape changed (a resize, a different shadow map size), or the usage
      // grew: nothing else can claim the old one.
      existing.texture.dispose();
      this.persistentBytes -= existing.bytes;
    }

    const texture = this.allocate(descriptor, combined, mipLevelCount);
    const bytes = textureByteSize(texture);
    this.persistentBytes += bytes;
    this.persistent.set(name, { texture, key, bytes, usage: combined });
    return texture;
  }

  releaseTexture(texture: GpuTexture): void {
    const entry = this.checkedOut.get(texture);
    if (!entry) return;

    this.checkedOut.delete(texture);
    this.liveBytes -= entry.bytes;

    this.buckets
      .getOrInsertComputed(entry.key, () => [])
      .push({ texture, bytes: entry.bytes, idleFrames: 0 });
  }

  acquireBuffer(descriptor: BufferDescriptor): GpuBuffer {
    return this.bufferCache.getOrInsertComputed(
      ResourcePool.bufferKey(descriptor),
      () =>
        createBuffer(this.ctx, {
          label: "frame-graph buffer",
          ...descriptor,
        }),
    );
  }

  endFrame(): void {
    for (const [key, bucket] of this.buckets) {
      for (let i = bucket.length - 1; i >= 0; i--) {
        const pooled = bucket[i]!;
        if (++pooled.idleFrames > ResourcePool.IDLE_FRAMES_BEFORE_EVICTION) {
          pooled.texture.dispose();
          bucket.splice(i, 1);
        }
      }
      if (!bucket.length) this.buckets.delete(key);
    }
  }

  stats(): PoolStats {
    let idleBytes = 0;
    let textureCount = this.checkedOut.size + this.persistent.size;
    for (const bucket of this.buckets.values()) {
      textureCount += bucket.length;
      for (const pooled of bucket) idleBytes += pooled.bytes;
    }
    return {
      liveBytes: this.liveBytes + this.persistentBytes,
      idleBytes,
      peakBytes: this.peakBytes,
      textureCount,
      bucketCount: this.buckets.size,
    };
  }

  dispose(): void {
    for (const bucket of this.buckets.values()) {
      for (const pooled of bucket) pooled.texture.dispose();
    }
    for (const texture of this.checkedOut.keys()) texture.dispose();
    for (const { texture } of this.persistent.values()) texture.dispose();
    for (const buffer of this.bufferCache.values()) buffer.dispose();

    this.buckets.clear();
    this.checkedOut.clear();
    this.persistent.clear();
    this.bufferCache.clear();
    this.liveBytes = 0;
    this.persistentBytes = 0;
  }
}
