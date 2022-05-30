import Signal from "signals";
import { mat4 } from "pex-math";

class SpotLight {
  constructor(opts) {
    this.type = "SpotLight";
    this.enabled = true;
    this.changed = new Signal();
    this.target = [0, 0, 0];
    this.color = [1, 1, 1, 1];
    this.intensity = 1;
    this.angle = Math.PI / 4;
    this.innerAngle = 0;
    this.range = 10;
    this.castShadows = false;
    this.bias = 0.1;

    const ctx = opts.ctx;
    this._ctx = ctx;

    this._near = 2;
    this._far = 40;
    this._viewMatrix = mat4.create();
    this._projectionMatrix = mat4.create();

    this.set(opts);
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);

    if (opts.color !== undefined || opts.intensity !== undefined) {
      this.color[3] = this.intensity;
    }

    if (
      opts.castShadows &&
      !this._ctx.capabilities.isWebGL2 &&
      !this._ctx.capabilities.depthTexture
    ) {
      console.warn(
        "SpotLight.castShadows is not supported. WEBGL_depth_texture missing."
      );
      this.castShadows = false;
    }

    if (this.castShadows) {
      if (!this._colorMap) this.allocateResources();
    } else {
      if (this._colorMap) this.disposeResources();
    }

    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));
  }

  allocateResources() {
    const ctx = this._ctx;

    this._colorMap = ctx.texture2D({
      name: "spotLightColorMap",
      width: 1024,
      height: 1024,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: ctx.Encoding.Linear,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    });

    this._shadowMap = ctx.texture2D({
      name: "spotLightShadowMap",
      width: 1024,
      height: 1024,
      pixelFormat: ctx.PixelFormat.DEPTH_COMPONENT16,
      encoding: ctx.Encoding.Linear,
    });

    this._shadowMapDrawCommand = {
      name: "SpotLight.shadowMap",
      pass: ctx.pass({
        name: "SpotLight.shadowMap",
        color: [this._colorMap],
        depth: this._shadowMap,
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
      }),
      viewport: [0, 0, 1024, 1024], // TODO: viewport bug
      // colorMask: [0, 0, 0, 0] // TODO
    };
  }

  disposeResources() {
    const ctx = this._ctx;

    ctx.dispose(this._colorMap);
    this._colorMap = null;

    ctx.dispose(this._shadowMap);
    this._shadowMap = null;

    ctx.dispose(this._shadowMapDrawCommand.pipeline);
    this._shadowMapDrawCommand = null;
  }
}

export default (opts) => {
  return new SpotLight(opts);
};
