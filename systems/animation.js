import { vec3, vec4, quat } from "pex-math";
import { TEMP_QUAT, TEMP_VEC3 } from "../utils.js";

function updateAnimation(animation, deltaTime) {
  if (!animation.prevTime) {
    animation.time = 0;
    animation.prevTime = Date.now();
    animation.playing = true;
  }

  if (animation.playing) {
    const animationLength =
      animation.duration ||
      animation.channels[0].input[animation.channels[0].input.length - 1];
    const now = Date.now();
    deltaTime ||= (now - animation.prevTime) / 1000;

    animation.prevTime = now;
    animation.time += deltaTime;
    if (animation.time > animationLength) {
      if (animation.loop) {
        animation.time %= animationLength;
      } else {
        animation.time = 0;
        animation.playing = false;
      }
    }

    animation.needsUpdate = true;
  }

  if (!animation.needsUpdate) return;
  animation.needsUpdate = false;

  for (let i = 0; i < animation.channels.length; i++) {
    const channel = animation.channels[i];
    const inputData = channel.input;

    let prevIndex;
    let nextIndex;

    for (let j = 0; j < inputData.length; j++) {
      nextIndex = j;
      if (inputData[j] >= animation.time) break;
      prevIndex = nextIndex;
    }

    const isRotation = channel.path === "rotation";
    const outputData = channel.output;
    const prevInput = inputData[prevIndex];
    const nextInput = inputData[nextIndex];
    const scale = nextInput - prevInput || 1;

    const t = (animation.time - prevInput) / scale;

    if (prevIndex !== undefined) {
      switch (channel.interpolation) {
        case "STEP":
          if (isRotation) {
            quat.set(TEMP_QUAT, outputData[prevIndex]);
          } else {
            vec3.set(TEMP_VEC3, outputData[prevIndex]);
          }
          break;
        case "CUBICSPLINE": {
          const vec = isRotation ? vec4 : vec3;
          const tt = t * t;
          const ttt = tt * t;

          // Each input value corresponds to three output values of the same type: in-tangent, data point, and out-tangent.
          // p0
          const prevPosition = vec.copy(outputData[prevIndex * 3 + 1]);

          // p1
          const nextPos = vec.copy(outputData[nextIndex * 3 + 1]);

          // m0 = (tk+1 - tk)bk
          const prevOutTangent = prevIndex
            ? vec.scale(vec.copy(outputData[prevIndex * 3 + 2]), scale)
            : vec.create();

          // m1 = (tk+1 - tk)ak+1
          const nextInTangent =
            nextIndex !== inputData.length - 1
              ? vec.scale(vec.copy(outputData[prevIndex * 3]), scale)
              : vec.create();

          // p(t) = (2t³ - 3t² + 1)p0 + (t³ - 2t² + t)m0 + (-2t³ + 3t²)p1 + (t³ - t²)m1
          const p0 = vec.scale(prevPosition, 2 * ttt - 3 * tt + 1);
          const m0 = vec.scale(prevOutTangent, ttt - 2 * tt + t);
          const p1 = vec.scale(nextPos, -2 * ttt + 3 * tt);
          const m1 = vec.scale(nextInTangent, ttt - tt);

          if (isRotation) {
            quat.set(
              TEMP_QUAT,
              quat.normalize([
                p0[0] + m0[0] + p1[0] + m1[0],
                p0[1] + m0[1] + p1[1] + m1[1],
                p0[2] + m0[2] + p1[2] + m1[2],
                p0[3] + m0[3] + p1[3] + m1[3],
              ]),
            );
          } else {
            vec3.set(TEMP_VEC3, vec3.add(vec3.add(vec3.add(p0, m0), p1), m1));
          }

          break;
        }
        default:
          // LINEAR
          if (isRotation) {
            quat.slerp(
              quat.set(TEMP_QUAT, outputData[prevIndex]),
              outputData[nextIndex],
              t,
            );
          } else {
            vec3.lerp(
              vec3.set(TEMP_VEC3, outputData[prevIndex]),
              outputData[nextIndex],
              t,
            );
          }
      }

      if (isRotation) {
        quat.set(channel.target.transform.rotation, TEMP_QUAT);
        channel.target.transform.dirty = true;
      } else if (channel.path === "translation") {
        vec3.set(channel.target.transform.position, TEMP_VEC3);
        channel.target.transform.dirty = true;
      } else if (channel.path === "scale") {
        vec3.set(channel.target.transform.scale, TEMP_VEC3);
        channel.target.transform.dirty = true;
      } else if (channel.path === "weights") {
        channel.target.morph.weights = outputData[nextIndex].slice();
      }
    }
  }
}

export default () => ({
  type: "animation-system",
  updateAnimation,
  update(entities, { deltaTime }) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (entity.animations) {
        for (let j = 0; j < entity.animations.length; j++) {
          updateAnimation(entity.animations[j], deltaTime);
        }
      } else if (entity.animation) {
        updateAnimation(entity.animation, deltaTime);
      }
    }
  },
});
