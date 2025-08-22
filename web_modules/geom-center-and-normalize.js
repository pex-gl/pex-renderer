import { s as set, a as sub$1, b as scale$1, c as add$1, d as create } from './_chunks/vec3-iMfOIZBS.js';
import { s as sub, a as scale, b as add } from './_chunks/avec3-D3IP9wAY.js';
import { f as fromPoints, c as center, s as size, a as create$1 } from './_chunks/aabb-CipEXYbk.js';

const TEMP_VEC3 = create();
function centerAndNormalize(positions, { center: center$1 = true, normalize = true, normalizedSize = 1 } = {}) {
    const isFlatArray = !positions[0]?.length;
    const positionsCount = positions.length / (isFlatArray ? 3 : 1);
    const bbox = fromPoints(create$1(), positions);
    const bboxCenter = center(bbox);
    if (normalize) {
        const size$1 = size(bbox);
        normalizedSize = normalizedSize / (Math.max(...size$1) || 1);
    }
    for(let i = 0; i < positionsCount; i++){
        if (isFlatArray) {
            sub(positions, i, bboxCenter, 0);
            if (normalize) {
                scale(positions, i, normalizedSize);
                if (!center$1) add(positions, i, bboxCenter, 0);
            }
        } else {
            set(TEMP_VEC3, positions[i]);
            sub$1(TEMP_VEC3, bboxCenter);
            if (normalize) {
                scale$1(TEMP_VEC3, normalizedSize);
                if (!center$1) add$1(TEMP_VEC3, bboxCenter);
            }
            set(positions[i], TEMP_VEC3);
        }
    }
    return positions;
}

export { centerAndNormalize as default };
