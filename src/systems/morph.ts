import type { Entity, MorphComponentOptions } from "../types.js";

function updateMorph(morph: MorphComponentOptions) {
  const current = (morph.current ??= {});
  const weights = morph.weights ?? [];

  Object.keys(morph.sources).forEach((key) => {
    const sourceAttributes = morph.sources[key];
    const targetAttributes = morph.targets[key];

    current[key] = sourceAttributes.map((source: any, i: number) => {
      let attribute: any = source.length ? [0, 0, 0] : 0;

      targetAttributes.forEach((target: any, j: number) => {
        const weight = weights[j]!;
        const targetAttribute = target[i];

        if (source.length) {
          attribute[0] += targetAttribute[0] * weight;
          attribute[1] += targetAttribute[1] * weight;
          attribute[2] += targetAttribute[2] * weight;
        } else {
          attribute += targetAttribute * weight;
        }
      });
      if (source.length) {
        attribute[0] += source[0];
        attribute[1] += source[1];
        attribute[2] += source[2];
      } else {
        attribute += source;
      }
      return attribute;
    });
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
      Object.keys(current).forEach((key) => {
        const geometry: any = entity.geometry;
        geometry[key] = current[key];
        // Bounds will be recomputed in geometry system update if "positions"/"offsets" are dirty
        geometry[key].dirty = true;
      });
    }
  },
});
