//TODO: MARCIN: why this is not in ResourceCache? The usecase is slightly different and would require requesting and releasing immediately, or never blocking. Could it be solved with different Usage type?
class ProgramCache {
  values = [];

  get(flags, vert, frag) {
    for (let i = 0; i < this.values.length; i++) {
      const value = this.values[i];
      if (value.frag === frag && value.vert === vert) {
        if (value.flags.length === flags.length) {
          let sameFlags = true;
          for (let j = 0; j < flags.length; j++) {
            if (value.flags[j] !== flags[j]) {
              sameFlags = false;
              break;
            }
          }
          if (sameFlags) return value.program;
        }
      }
    }
  }

  set(flags, vert, frag, program) {
    this.values.push({ flags, vert, frag, program });
  }
}

export default ProgramCache;
