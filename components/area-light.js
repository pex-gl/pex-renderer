// import Signal from "signals";
import * as AreaLightsData from "./area-light-data.js";

class AreaLight {
  constructor(opts) {
    this.type = "AreaLight";
    this.enabled = true;
    // this.changed = new Signal();
    this.color = [1, 1, 1, 1];
    this.intensity = 1;
    this.castShadows = false;

    this.set(opts);

    const ctx = opts.ctx;

    // TODO: area light textures
    if (!AreaLight.areaLightTexturesRefs) {
      AreaLight.ltc_mat_texture = ctx.texture2D({
        data: AreaLightsData.mat,
        width: 64,
        height: 64,
        pixelFormat: ctx.PixelFormat.RGBA32F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
      });
      AreaLight.ltc_mag_texture = ctx.texture2D({
        data: AreaLightsData.mag,
        width: 64,
        height: 64,
        pixelFormat: ctx.PixelFormat.R32F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
      });
    }
    AreaLight.areaLightTexturesRefs =
      (AreaLight.areaLightTexturesRefs || 0) + 1;
    this.ltc_mat_texture = AreaLight.ltc_mat_texture;
    this.ltc_mag_texture = AreaLight.ltc_mag_texture;
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));

    if (opts.color !== undefined || opts.intensity !== undefined) {
      this.color[3] = this.intensity;
    }
  }

  dispose() {
    if (--AreaLight.areaLightTexturesRefs === 0) {
      this.ctx.dispose(AreaLight.ltc_mat_texture);
      AreaLight.ltc_mat_texture = null;
      this.ctx.dispose(AreaLight.ltc_mag_texture);
      AreaLight.ltc_mag_texture = null;
    }
  }
}

export default (opts) => {
  return {
    ...opts,
  };
};
