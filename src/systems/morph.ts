import type {
  Entity,
  MorphAttribute,
  MorphComponentOptions,
} from "../types.js";

function updateMorph(morph: MorphComponentOptions) {
  const current = (morph.current ??= {});
  const weights = morph.weights ?? [];

  Object.keys(morph.sources).forEach((key) => {
    // Flat data and per-vertex vectors blend the same way, element by element,
    // and `map` keeps a typed array typed — which is what the geometry system
    // uploads. TypeScript cannot call `map` across that union, so the blend is
    // written once against the vector shape.
    const sourceAttributes = morph.sources[key] as (number | number[])[];
    const targetAttributes = morph.targets[key] as (number | number[])[][];

    current[key] = sourceAttributes.map((source, i) => {
      if (typeof source === "number") {
        let attribute = source;
        for (let j = 0; j < targetAttributes.length; j++) {
          attribute += (targetAttributes[j]![i] as number) * weights[j]!;
        }
        return attribute;
      }

      const attribute: [number, number, number] = [
        source[0]!,
        source[1]!,
        source[2]!,
      ];
      for (let j = 0; j < targetAttributes.length; j++) {
        const target = targetAttributes[j]![i] as number[];
        const weight = weights[j]!;
        attribute[0] += target[0]! * weight;
        attribute[1] += target[1]! * weight;
        attribute[2] += target[2]! * weight;
      }
      return attribute;
    }) as MorphAttribute;
  });
}

/** Morph system */
export default () => ({
  type: "morph-system",
  updateMorph,
  update(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      if (!entity.morph) continue;

      updateMorph(entity.morph);

      const current = entity.morph.current!;
      // Morphed attributes go back onto the geometry component under the keys
      // the morph component uses, which the component type cannot express
      // without an index signature over every named attribute.
      const geometry = entity.geometry as unknown as Record<
        string,
        MorphAttribute & { dirty?: boolean }
      >;
      Object.keys(current).forEach((key) => {
        geometry[key] = current[key]!;
        // Bounds will be recomputed in geometry system update if "positions"/"offsets" are dirty
        geometry[key]!.dirty = true;
      });
    }
  },
});
