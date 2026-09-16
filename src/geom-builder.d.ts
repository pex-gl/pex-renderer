// Upstream ships types but its package.json "exports" is a bare string, so
// resolution never reaches them — and they describe only the fixed members.
declare module "geom-builder" {
  export interface GeomBuilder {
    /** Positions added so far. */
    count: number;
    /** Component count per attribute, as passed to the factory. */
    attributes: Record<string, number>;
    reset(): void;
    /** One adder per attribute: `positions` gets `addPosition`. */
    [adder: `add${string}`]: (value: ArrayLike<number>) => void;
    /** One array per attribute, named after it. */
    [attribute: string]: unknown;
  }

  /** Component count per attribute, plus an optional initial `size`. */
  export default function createGeomBuilder(
    attributes: Record<string, number>,
  ): GeomBuilder;
}
