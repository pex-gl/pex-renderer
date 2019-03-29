const quat = require("pex-math/quat");
const vec3 = require("pex-math/vec3");
const vec4 = require("pex-math/vec4");
const Signal = require("signals");

// Assumptions:
// - all channels have the same time length
// - animation channels can reference other entities
// - currently all animations track time by themselves
function Animation(opts) {
  this.type = "Animation";
  this.entity = null;
  this.enabled = true;
  this.playing = false;
  this.loop = false;
  this.time = 0; // seconds
  this.prevTime = Date.now(); // ms
  this.channels = opts.channels || [];
  this.changed = new Signal();
  this.set(opts);
}

Animation.prototype.init = function(entity) {
  this.entity = entity;
};

Animation.prototype.set = function(opts) {
  Object.assign(this, opts);
  Object.keys(opts).forEach(prop => this.changed.dispatch(prop));

  if (opts.autoplay || opts.playing) {
    this.playing = true;
    // reset timer to avoid jumps
    this.time = 0;
    this.prevTime = Date.now();
  }
};

Animation.prototype.update = function() {
  if (!this.playing || !this.enabled) return;

  // assuming same length for all
  const animationLength = this.channels[0].input[
    this.channels[0].input.length - 1
  ];

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

  this.channels.forEach(channel => {
    const inputData = channel.input;
    const outputData = channel.output;
    const target = channel.target;
    const path = channel.path;
    const interpolationType = channel.interpolation;

    let prevInput = null;
    let nextInput = null;
    let prevOutput = null;
    let nextOutput = null;

    let prevIndex;
    let nextIndex;

    for (var i = 0; i < inputData.length; i++) {
      nextIndex = i;
      if (inputData[i] >= this.time) {
        break;
      }
      prevIndex = nextIndex;
    }

    if (prevIndex !== undefined) {
      prevInput = inputData[prevIndex];
      nextInput = inputData[nextIndex];
      prevOutput = outputData[prevIndex];
      nextOutput = outputData[nextIndex];

      const interpolationValue =
        (this.time - prevInput) / (nextInput - prevInput);

      let currentOutput = null;

      switch (interpolationType) {
        case "STEP":
          currentOutput = outputData[prevIndex];
          break;
        case "CUBICSPLINE":
          //intangent = index
          //position = index+1
          //outtangent = index+2

          let prevInTangent,
            prevOutTangent,
            prevPosition,
            nextInTangent,
            nextOutTangent,
            nextPos;

          if (path === "rotation") {
            //prevInTangent = vec4.create();
            prevOutTangent = vec4.create();
            prevPosition = vec4.create();
            nextInTangent = vec4.create();
            //nextOutTangent = vec4.create();
            nextPos = vec4.create();
          } else {
            //prevInTangent = vec3.create();
            prevOutTangent = vec3.create();
            prevPosition = vec3.create();
            nextInTangent = vec3.create();
            //nextOutTangent = vec3.create();
            nextPos = vec3.create();
          }

          if (prevIndex) {
            //prevInTangent = outputData[prevIndex*3].slice()
            prevOutTangent = outputData[prevIndex * 3 + 2].slice();
          }
          //p0
          prevPosition = outputData[prevIndex * 3 + 1].slice();

          if (nextIndex < inputData.length - 1) {
            //m1
            nextInTangent = outputData[nextIndex * 3].slice();
            //nextOutTangent = outputData[(nextIndex*3) +2].slice()
          }
          //p1
          nextPos = outputData[nextIndex * 3 + 1].slice();

          //interpolationValue is t

          //p(t) =
          //  (2t^3 - 3t^2 + 1)p0 + //p0Calc
          //  (t^3 - 2t^2 + t)m0 +  //m0Calc
          //  (-2t^3 + 3t^2)p1 +  //p1Calc
          //  (t^3 - t^2)m1 //m1Calc

          let t = interpolationValue;
          let tt = t * t;
          let ttt = tt * t;

          if (path === "rotation") {
            //currentOutput = tempOutputTest;
            currentOutput = [1, 1, 1, 1];

            let p0Calc = [
              (prevPosition[0] *= 2 * ttt - 3 * tt + 1),
              (prevPosition[1] *= 2 * ttt - 3 * tt + 1),
              (prevPosition[2] *= 2 * ttt - 3 * tt + 1),
              (prevPosition[3] *= 2 * ttt - 3 * tt + 1)
            ];

            let m0Calc = [
              (prevOutTangent[0] *= ttt - 2 * tt + t),
              (prevOutTangent[1] *= ttt - 2 * tt + t),
              (prevOutTangent[2] *= ttt - 2 * tt + t),
              (prevOutTangent[3] *= ttt - 2 * tt + t)
            ];
            let p1Calc = [
              (nextPos[0] *= -2 * ttt + 3 * tt),
              (nextPos[1] *= -2 * ttt + 3 * tt),
              (nextPos[2] *= -2 * ttt + 3 * tt),
              (nextPos[3] *= -2 * ttt + 3 * tt)
            ];
            let m1Calc = [
              (nextInTangent[0] *= ttt - tt),
              (nextInTangent[1] *= ttt - tt),
              (nextInTangent[2] *= ttt - tt),
              (nextInTangent[3] *= ttt - tt)
            ];

            let tempOutputTest = [
              p0Calc[0] + m0Calc[0] + p1Calc[0] + m1Calc[0],
              p0Calc[1] + m0Calc[1] + p1Calc[1] + m1Calc[1],
              p0Calc[2] + m0Calc[2] + p1Calc[2] + m1Calc[2],
              p0Calc[3] + m0Calc[3] + p1Calc[3] + m1Calc[3]
            ];
            currentOutput = quat.normalize(tempOutputTest);
          } else {
            let p0Calc = vec3.scale(prevPosition, 2 * ttt - 3 * tt + 1);
            let m0Calc = vec3.scale(prevOutTangent, ttt - 2 * tt + t);
            let p1Calc = vec3.scale(nextPos, -2 * ttt + 3 * tt);
            let m1Calc = vec3.scale(nextInTangent, ttt - tt);

            let tempOutputTest = vec3.add(
              vec3.add(vec3.add(p0Calc, m0Calc), p1Calc),
              m1Calc
            );
            currentOutput = tempOutputTest;
          }

          break;
        default:
          // default to LINEAR
          // TODO: stop creating new arrays every frame
          if (path === "rotation") {
            currentOutput = quat.copy(prevOutput);
            quat.slerp(currentOutput, nextOutput, interpolationValue);
          } else {
            currentOutput = [];
            for (var k = 0; k < nextOutput.length; k++) {
              currentOutput[k] =
                prevOutput[k] +
                interpolationValue * (nextOutput[k] - prevOutput[k]);
            }
          }
      }

      if (path === "translation") {
        target.transform.set({
          position: currentOutput
        });
      } else if (path === "rotation") {
        target.transform.set({
          rotation: currentOutput
        });
      } else if (path === "scale") {
        target.transform.set({
          scale: currentOutput
        });
      } else if (path === "weights") {
        target.getComponent("Morph").set({
          weights: nextOutput
        });
      }
    }
  });
};

module.exports = function createMorph(opts) {
  return new Animation(opts);
};
