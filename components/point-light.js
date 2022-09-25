import Signal from "signals";
import { mat4 } from "pex-math";

class PointLight {
  constructor(opts) {
    this.type = "PointLight";
    this.enabled = true;
    this.changed = new Signal();
    this.color = [1, 1, 1, 1];
    this.intensity = 1;
    this.range = 10;
    this.castShadows = false;

    const ctx = opts.ctx;
    this._ctx = ctx;

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
        "PointLight.castShadows is not supported. WEBGL_depth_texture missing."
      );
      this.castShadows = false;
    }
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));

    if (this.castShadows) {
      if (!this._shadowCubemap) this.allocateResources();
    } else {
      if (this._shadowCubemap) this.disposeResources();
    }
  }

  allocateResources() {
    const ctx = this._ctx;

    const CUBEMAP_SIZE = 512;
    this._shadowCubemap = ctx.textureCube({
      width: CUBEMAP_SIZE,
      height: CUBEMAP_SIZE,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });
    this._shadowMap = ctx.texture2D({
      name: "pointLightShadowMap",
      width: CUBEMAP_SIZE,
      height: CUBEMAP_SIZE,
      pixelFormat: ctx.PixelFormat.DEPTH_COMPONENT16,
      encoding: ctx.Encoding.Linear,
    });

    this._sides = [
      { eye: [0, 0, 0], target: [1, 0, 0], up: [0, -1, 0] },
      { eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0] },
      { eye: [0, 0, 0], target: [0, 1, 0], up: [0, 0, 1] },
      { eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1] },
      { eye: [0, 0, 0], target: [0, 0, 1], up: [0, -1, 0] },
      { eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0] },
    ].map((side, i) => {
      side.projectionMatrix = mat4.perspective(
        mat4.create(),
        Math.PI / 2,
        1,
        0.1,
        100
      ); // TODO: change this to radians
      side.viewMatrix = mat4.lookAt(
        mat4.create(),
        side.eye,
        side.target,
        side.up
      );
      side.drawPassCmd = {
        name: "PointLight.sidePass",
        pass: ctx.pass({
          name: "PointLight.sidePass",
          depth: this._shadowMap,
          color: [
            {
              texture: this._shadowCubemap,
              target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            },
          ],
          clearColor: [0, 0, 0, 1],
          clearDepth: 1,
        }),
      };
      return side;
    });
  }

  disposeResources() {
    const ctx = this._ctx;

    ctx.dispose(this._shadowCubemap);
    this._shadowCubemap = null;

    ctx.dispose(this._shadowMap);
    this._shadowMap = null;

    this._sides.forEach(({ drawPassCmd }) => {
      ctx.dispose(drawPassCmd.pass);
    });
    this._sides = null;
  }
}

export default (opts) => {
  return {
    range: 10,
    ...opts,
  };
  //return new PointLight(opts);
};
