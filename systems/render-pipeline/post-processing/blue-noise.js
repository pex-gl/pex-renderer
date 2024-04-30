// https://github.com/gkjohnson/threejs-sandbox/tree/master/blue-noise-generation
function fillWithOnes(array, count) {
  array.fill(0);

  for (let i = 0; i < count; i++) {
    array[i] = 1;
  }
}

function shuffleArray(array, random = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const replaceIndex = ~~((random() - 1e-6) * i);
    const tmp = array[i];
    array[i] = array[replaceIndex];
    array[replaceIndex] = tmp;
  }
}

class BlueNoiseSamples {
  constructor(size) {
    this.count = 0;
    this.size = -1;
    this.sigma = -1;
    this.radius = -1;
    this.lookupTable = null;
    this.score = null;
    this.binaryPattern = null;

    this.resize(size);
    this.setSigma(1.5);
  }

  findVoid() {
    const { score, binaryPattern } = this;

    let currValue = Infinity;
    let currIndex = -1;
    for (let i = 0, l = binaryPattern.length; i < l; i++) {
      if (binaryPattern[i] !== 0) {
        continue;
      }

      const pScore = score[i];
      if (pScore < currValue) {
        currValue = pScore;
        currIndex = i;
      }
    }

    return currIndex;
  }

  findCluster() {
    const { score, binaryPattern } = this;

    let currValue = -Infinity;
    let currIndex = -1;
    for (let i = 0, l = binaryPattern.length; i < l; i++) {
      if (binaryPattern[i] !== 1) {
        continue;
      }

      const pScore = score[i];
      if (pScore > currValue) {
        currValue = pScore;
        currIndex = i;
      }
    }

    return currIndex;
  }

  setSigma(sigma) {
    if (sigma === this.sigma) {
      return;
    }

    // generate a radius in which the score will be updated under the
    // assumption that e^-10 is insignificant enough to be the border at
    // which we drop off.
    const radius = ~~(Math.sqrt(10 * 2 * sigma ** 2) + 1);
    const lookupWidth = 2 * radius + 1;
    const lookupTable = new Float32Array(lookupWidth * lookupWidth);
    const sigma2 = sigma * sigma;
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const index = (radius + y) * lookupWidth + x + radius;
        const dist2 = x * x + y * y;
        lookupTable[index] = Math.E ** (-dist2 / (2 * sigma2));
      }
    }

    this.lookupTable = lookupTable;
    this.sigma = sigma;
    this.radius = radius;
  }

  resize(size) {
    if (this.size !== size) {
      this.size = size;
      this.score = new Float32Array(size * size);
      this.binaryPattern = new Uint8Array(size * size);
    }
  }

  invert() {
    const { binaryPattern, score, size } = this;

    score.fill(0);

    for (let i = 0, l = binaryPattern.length; i < l; i++) {
      if (binaryPattern[i] === 0) {
        const y = ~~(i / size);
        const x = i - y * size;
        this.updateScore(x, y, 1);
        binaryPattern[i] = 1;
      } else {
        binaryPattern[i] = 0;
      }
    }
  }

  updateScore(x, y, multiplier) {
    // TODO: Is there a way to keep track of the highest and lowest scores here to avoid have to search over
    // everything in the buffer?
    const { size, score, lookupTable } = this;

    // const sigma2 = sigma * sigma;
    // const radius = Math.floor( size / 2 );
    const radius = this.radius;
    const lookupWidth = 2 * radius + 1;
    for (let px = -radius; px <= radius; px++) {
      for (let py = -radius; py <= radius; py++) {
        // const dist2 = px * px + py * py;
        // const value = Math.E ** ( - dist2 / ( 2 * sigma2 ) );

        const lookupIndex = (radius + py) * lookupWidth + px + radius;
        const value = lookupTable[lookupIndex];

        let sx = x + px;
        sx = sx < 0 ? size + sx : sx % size;

        let sy = y + py;
        sy = sy < 0 ? size + sy : sy % size;

        const sindex = sy * size + sx;
        score[sindex] += multiplier * value;
      }
    }
  }

  addPointIndex(index) {
    this.binaryPattern[index] = 1;

    const size = this.size;
    const y = ~~(index / size);
    const x = index - y * size;
    this.updateScore(x, y, 1);
    this.count++;
  }

  removePointIndex(index) {
    this.binaryPattern[index] = 0;

    const size = this.size;
    const y = ~~(index / size);
    const x = index - y * size;
    this.updateScore(x, y, -1);
    this.count--;
  }

  copy(source) {
    this.resize(source.size);
    this.score.set(source.score);
    this.binaryPattern.set(source.binaryPattern);
    this.setSigma(source.sigma);
    this.count = source.count;
  }
}

class BlueNoiseGenerator {
  constructor() {
    this.random = Math.random;
    this.sigma = 1.5;
    this.size = 64;
    this.majorityPointsRatio = 0.1;

    this.samples = new BlueNoiseSamples(1);
    this.savedSamples = new BlueNoiseSamples(1);
  }

  generate() {
    // http://cv.ulichney.com/papers/1993-void-cluster.pdf

    const { samples, savedSamples, sigma, majorityPointsRatio, size } = this;

    samples.resize(size);
    samples.setSigma(sigma);

    // 1. Randomly place the minority points.
    const pointCount = Math.floor(size * size * majorityPointsRatio);
    const initialSamples = samples.binaryPattern;

    console.time("Array Initialization");
    fillWithOnes(initialSamples, pointCount);
    shuffleArray(initialSamples, this.random);
    console.timeEnd("Array Initialization");

    console.time("Score Initialization");
    for (let i = 0, l = initialSamples.length; i < l; i++) {
      if (initialSamples[i] === 1) {
        samples.addPointIndex(i);
      }
    }
    console.timeEnd("Score Initialization");

    // 2. Remove minority point that is in densest cluster and place it in the largest void.
    console.time("Point Rearrangement");
    while (true) {
      const clusterIndex = samples.findCluster();
      samples.removePointIndex(clusterIndex);

      const voidIndex = samples.findVoid();
      if (clusterIndex === voidIndex) {
        samples.addPointIndex(clusterIndex);
        break;
      }

      samples.addPointIndex(voidIndex);
    }
    console.timeEnd("Point Rearrangement");

    // 3. PHASE I: Assign a rank to each progressively less dense cluster point and put it
    // in the dither array.
    const ditherArray = new Uint32Array(size * size);
    savedSamples.copy(samples);

    console.time("Dither Array Phase 1");
    let rank;
    rank = samples.count - 1;
    while (rank >= 0) {
      const clusterIndex = samples.findCluster();
      samples.removePointIndex(clusterIndex);

      ditherArray[clusterIndex] = rank;
      rank--;
    }
    console.timeEnd("Dither Array Phase 1");

    // 4. PHASE II: Do the same thing for the largest voids up to half of the total pixels using
    // the initial binary pattern.
    console.time("Dither Array Phase 2");
    const totalSize = size * size;
    rank = savedSamples.count;
    while (rank < totalSize / 2) {
      const voidIndex = savedSamples.findVoid();
      savedSamples.addPointIndex(voidIndex);
      ditherArray[voidIndex] = rank;
      rank++;
    }
    console.timeEnd("Dither Array Phase 2");

    // 5. PHASE III: Invert the pattern and finish out by assigning a rank to the remaining
    // and iteratively removing them.
    console.time("Samples Invert");
    savedSamples.invert();
    console.timeEnd("Samples Invert");

    console.time("Dither Array Phase 3");
    while (rank < totalSize) {
      const clusterIndex = savedSamples.findCluster();
      savedSamples.removePointIndex(clusterIndex);
      ditherArray[clusterIndex] = rank;
      rank++;
    }
    console.timeEnd("Dither Array Phase 3");

    return { data: ditherArray, maxValue: totalSize };
  }
}

export { BlueNoiseSamples, BlueNoiseGenerator };
