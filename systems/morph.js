import { aabb } from "pex-geom";

function updateMorph(morph) {
  Object.keys(morph.sources).forEach((key) => {
    const sourceAttributes = morph.sources[key];
    const targetAttributes = morph.targets[key];

    morph.current[key] = sourceAttributes.map((source, i) => {
      let attribute = source.length ? [0, 0, 0] : 0;

      targetAttributes.forEach((target, j) => {
        const weight = morph.weights[j];
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

export default () => ({
  type: "morph-system",
  updateMorph,
  update(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.morph) continue;

      updateMorph(entity.morph);

      Object.keys(entity.morph.current).forEach((key) => {
        entity.geometry[key] = entity.morph.current[key];
        entity.geometry[key].dirty = true;
      });

      // TODO: should that be in geometry system as geometry.bounds.dirty or aabbDirty?
      entity.geometry.bounds = aabb.fromPoints(
        entity.geometry.bounds || aabb.create(),
        entity.morph.current.positions || entity.morph.current.offsets
      );
    }
  },
});
