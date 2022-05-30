import { quat, vec3, vec4, utils } from "pex-math";
import Signal from "signals";

let currentOutputVec3 = vec3.create();
let currentOutputQuat = quat.create();

// Assumptions:
// - all channels have the same time length
// - animation channels can reference other entities
// - currently all animations track time by themselves
class Animation {
  constructor(opts) {
    this.type = "Animation";
    this.entity = null;
    this.enabled = true;
    this.playing = false;
    this.loop = false;
    this.time = 0; // seconds
    this.prevTime = Date.now(); // ms
    this.channels = opts.channels || [];
    this.changed = new Signal();
    this.needsUpdate = true;
    this.set(opts);
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));

    if (opts.autoplay || opts.playing) {
      this.playing = true;
      // reset timer to avoid jumps
      this.time = 0;
      this.prevTime = Date.now();
    }

    this.needsUpdate = true;
  }

  update() {
    if (!this.enabled) return;

    if (this.playing) {
      const animationLength =
        this.channels[0].input[this.channels[0].input.length - 1];
      const now = Date.now();
      const deltaTime = (now - this.prevTime) / 1000;

      this.prevTime = now;
      this.time += deltaTime;

      if (this.time > animationLength) {
        if (this.loop) {
          this.time %= animationLength;
        } else {
          this.time = 0;
          this.set({ playing: false });
        }
      }

      this.needsUpdate = true;
    }

    if (!this.needsUpdate) return;

    this.needsUpdate = false;

    this.channels.forEach((channel) => {
      const inputData = channel.input;

      let prevIndex;
      let nextIndex;

      for (let j = 0; j < inputData.length; j++) {
        nextIndex = j;
        if (inputData[j] >= this.time) {
          break;
        }
        prevIndex = nextIndex;
      }

      const isRotation = channel.path === "rotation";
      const outputData = channel.output;
      const prevInput = inputData[prevIndex];
      const nextInput = inputData[nextIndex];
      const scale = nextInput - prevInput;

      const t = (this.time - prevInput) / scale;

      if (prevIndex !== undefined) {
        switch (channel.interpolation) {
          case "STEP":
            if (isRotation) {
              quat.set(currentOutputQuat, outputData[prevIndex]);
            } else {
              vec3.set(currentOutputVec3, outputData[prevIndex]);
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
                currentOutputQuat,
                quat.normalize([
                  p0[0] + m0[0] + p1[0] + m1[0],
                  p0[1] + m0[1] + p1[1] + m1[1],
                  p0[2] + m0[2] + p1[2] + m1[2],
                  p0[3] + m0[3] + p1[3] + m1[3],
                ])
              );
            } else {
              vec3.set(
                currentOutputVec3,
                vec3.add(vec3.add(vec3.add(p0, m0), p1), m1)
              );
            }

            break;
          }
          default:
            // LINEAR
            if (isRotation) {
              quat.slerp(
                quat.set(currentOutputQuat, outputData[prevIndex]),
                outputData[nextIndex],
                t
              );
            } else {
              vec3.set(
                currentOutputVec3,
                outputData[nextIndex].map((output, index) =>
                  utils.lerp(outputData[prevIndex][index], output, t)
                )
              );
            }
        }

        if (isRotation) {
          channel.target.transform.set({
            rotation: quat.copy(currentOutputQuat),
          });
        } else if (channel.path === "translation") {
          channel.target.transform.set({
            position: vec3.copy(currentOutputVec3),
          });
        } else if (channel.path === "scale") {
          channel.target.transform.set({
            scale: vec3.copy(currentOutputVec3),
          });
        } else if (channel.path === "weights") {
          channel.target.getComponent("Morph").set({
            weights: outputData[nextIndex].slice(),
          });
        }
      }
    });
  }
}

export default function createMorph(opts) {
  return new Animation(opts);
}
