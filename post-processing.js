import Signal from "signals";
import random from "pex-random";
import { vec3, mat4, utils } from "pex-math";
import { postProcessing as SHADERS } from "pex-shaderlib";

const ssaoKernelData = new Float32Array(64 * 4);
for (let i = 0; i < 64; i++) {
  var sample = [
    random.float() * 2 - 1,
    random.float() * 2 - 1,
    random.float(),
    1,
  ];
  vec3.normalize(sample);
  let scale = random.float();
  scale = utils.lerp(0.1, 1.0, scale * scale);
  vec3.scale(sample, scale);
  ssaoKernelData[i * 4 + 0] = sample[0];
  ssaoKernelData[i * 4 + 1] = sample[1];
  ssaoKernelData[i * 4 + 2] = sample[2];
  ssaoKernelData[i * 4 + 3] = sample[3];
}

const ssaoNoiseData = new Float32Array(128 * 128 * 4);
for (let i = 0; i < 128 * 128; i++) {
  // let noiseSample = [
  //   random.float() * 2 - 1,
  //   random.float() * 2 - 1,
  //   0,
  //   1
  // ]
  ssaoNoiseData[i * 4 + 0] = sample[0];
  ssaoNoiseData[i * 4 + 1] = sample[1];
  ssaoNoiseData[i * 4 + 2] = sample[2];
  ssaoNoiseData[i * 4 + 3] = sample[3];
}

class PostProcessing {
  constructor(opts) {
    const gl = opts.ctx.gl;
    this.type = "PostProcessing";
    this.enabled = true;
    this.changed = new Signal();
    this.entity = null;

    this.rgbm = false;
    this.depthPrepass = true;
    this.backgroundColor = [0, 0, 0, 1];
    this.viewMatrix = mat4.create();
    this.viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];

    this.fxaa = false;

    this.fog = false;
    this.fogColor = [0.5, 0.5, 0.5];
    this.fogStart = 5;
    this.fogDensity = 0.15;
    this.inscatteringCoeffs = [0.3, 0.3, 0.3];

    this.ssao = false;
    this.ssaoIntensity = 5;
    this.ssaoRadius = 12;
    this.ssaoBias = 0.01;
    this.ssaoBlurRadius = 2;
    this.ssaoBlurSharpness = 10;

    this.dof = false;
    this.dofDebug = false;
    this.dofFocusDistance = 5;
    this.dofAperture = 1;

    this.bloom = false;
    this.bloomRadius = 1;
    this.bloomThreshold = 1;
    this.bloomIntensity = 0.1;

    this.sunPosition = [1, 1, 1];
    this.sunColor = [0.98, 0.98, 0.7];
    this.sunDispertion = 0.2;
    this.sunIntensity = 0.1;

    this._textures = [];

    this.set(opts);
  }

  init(entity) {
    this.entity = entity;

    const camera = this.entity && this.entity.getComponent("Camera");

    if (camera) {
      this.set({
        viewport: camera.viewport,
        viewMatrix: camera.viewMatrix,
      });
    }

    if (this.enabled && this.ctx.capabilities.maxColorAttachments < 2) {
      this.enabled = false;
      console.log(
        `pex-renderer disabling postprocess as MAX_COLOR_ATTACHMENTS=${this.ctx.capabilities.maxColorAttachments}`
      );
      console.log("pex-renderer ctx", this.ctx.capabilities);
    }

    if (this.enabled && !this._fsqMesh) {
      this.initPostproces();
    }
  }

  set(opts) {
    Object.assign(this, opts);

    // Update textures
    if (opts.viewport) {
      this._textures.forEach((texture) => {
        const expectedWidth = Math.floor(
          opts.viewport[2] * (texture.sizeScale || 1)
        );
        const expectedHeight = Math.floor(
          opts.viewport[3] * (texture.sizeScale || 1)
        );
        if (
          texture.width !== expectedWidth ||
          texture.height !== expectedHeight
        ) {
          this.ctx.update(texture, {
            width: Math.max(expectedWidth, 1),
            height: Math.max(expectedHeight, 1),
          });
        }
      });
    }

    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));
  }

  initPostproces() {
    const ctx = this.ctx;
    const fsqPositions = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const fsqFaces = [
      [0, 1, 2],
      [0, 2, 3],
    ];

    const W = this.viewport[2];
    const H = this.viewport[3];

    this._fsqMesh = {
      attributes: {
        aPosition: ctx.vertexBuffer(fsqPositions),
      },
      indices: ctx.indexBuffer(fsqFaces),
    };

    // Init resizable textures
    this._frameColorTex = ctx.texture2D({
      name: "frameColorTex",
      width: W,
      height: H,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });
    this._frameEmissiveTex = ctx.texture2D({
      name: "frameColorTex",
      width: W,
      height: H,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });
    this._frameNormalTex = ctx.texture2D({
      name: "frameNormalTex",
      width: W,
      height: H,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: ctx.Encoding.Linear,
    });
    this._frameDepthTex = ctx.texture2D({
      name: "frameDepthTex",
      width: W,
      height: H,
      pixelFormat: ctx.PixelFormat.DEPTH_COMPONENT24,
      encoding: ctx.Encoding.Linear,
    });
    this._frameAOTex = ctx.texture2D({
      name: "frameAOTex",
      width: W,
      height: H,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: ctx.Encoding.Linear,
    });
    this._frameAOBlurTex = ctx.texture2D({
      name: "frameAOBlurTex",
      width: W,
      height: H,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: ctx.Encoding.Linear,
    });
    this._frameDofBlurTex = ctx.texture2D({
      name: "frameDofBlurTex",
      width: W,
      height: H,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });
    this._frameBloomTex = ctx.texture2D({
      name: "frameBloomHTex",
      width: W,
      height: H,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });
    this._frameDownSampleTextures = Array.from({ length: 9 }, (v, k) => k).map(
      (i) => {
        const sampleSize = 2 ** (i + 1);

        const tex = ctx.texture2D({
          width: Math.max(Math.floor(W / sampleSize), 1),
          height: Math.max(Math.floor(H / sampleSize), 1),
          pixelFormat: ctx.PixelFormat.RGBA16F,
          encoding: ctx.Encoding.Linear,
          min: ctx.Filter.Linear,
          mag: ctx.Filter.Linear,
        });
        tex.sizeScale = 1 / sampleSize;

        return tex;
      }
    );

    this._textures = [
      this._frameColorTex,
      this._frameEmissiveTex,
      this._frameNormalTex,
      this._frameDepthTex,
      this._frameAOTex,
      this._frameAOBlurTex,
      this._frameDofBlurTex,
      this._frameBloomTex,
      ...this._frameDownSampleTextures,
    ];

    // Init fixed sizes textures
    ctx.gl.getExtension("OES_texture_float ");
    this._ssaoKernelMap = ctx.texture2D({
      width: 8,
      height: 8,
      data: ssaoKernelData,
      pixelFormat: ctx.PixelFormat.RGBA32F,
      encoding: ctx.Encoding.Linear,
      wrap: ctx.Wrap.Repeat,
    });
    this._ssaoNoiseMap = ctx.texture2D({
      width: 128,
      height: 128,
      data: ssaoNoiseData,
      pixelFormat: ctx.PixelFormat.RGBA32F,
      encoding: ctx.Encoding.Linear,
      wrap: ctx.Wrap.Repeat,
      mag: ctx.Filter.Linear,
      min: ctx.Filter.Linear,
    });

    // Init commands
    this._drawFrameNormalsFboCommand = {
      name: "PostProcessing.drawFrameNormals",
      pass: ctx.pass({
        name: "PostProcessing.drawFrameNormals",
        color: [this._frameNormalTex],
        depth: this._frameDepthTex,
        clearColor: [0, 0, 0, 0],
        clearDepth: 1,
      }),
    };

    this._drawFrameFboCommand = {
      name: "PostProcessing.drawFrame",
      pass: ctx.pass({
        name: "PostProcessing.drawFrame",
        color: [this._frameColorTex, this._frameEmissiveTex],
        depth: this._frameDepthTex,
        clearColor: this.backgroundColor,
      }),
    };

    this._ssaoCmd = {
      name: "PostProcessing.ssao",
      pass: ctx.pass({
        name: "PostProcessing.ssao",
        color: [this._frameAOTex],
        clearColor: [0, 0, 0, 1],
        // clearDepth: 1
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.postProcessing.vert,
        frag: SHADERS.sao.frag,
      }),
      attributes: this._fsqMesh.attributes,
      indices: this._fsqMesh.indices,
      uniforms: {
        uDepthMap: this._frameDepthTex,
        uNormalMap: this._frameNormalTex,
        uNoiseMap: this._ssaoNoiseMap,
      },
    };

    this._bilateralBlurHCmd = {
      name: "PostProcessing.bilateralBlurH",
      pass: ctx.pass({
        name: "PostProcessing.bilateralBlurH",
        color: [this._frameAOBlurTex],
        clearColor: [1, 1, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.postProcessing.vert,
        frag: SHADERS.bilateralBlur.frag,
      }),
      attributes: this._fsqMesh.attributes,
      indices: this._fsqMesh.indices,
      uniforms: {
        depthMap: this._frameDepthTex,
        image: this._frameAOTex,
        // direction: [State.bilateralBlurRadius, 0], // TODO:
        direction: [0.5, 0],
      },
    };

    this._bilateralBlurVCmd = {
      name: "PostProcessing.bilateralBlurV",
      pass: ctx.pass({
        name: "PostProcessing.bilateralBlurV",
        color: [this._frameAOTex],
        clearColor: [1, 1, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.postProcessing.vert,
        frag: SHADERS.bilateralBlur.frag,
      }),
      attributes: this._fsqMesh.attributes,
      indices: this._fsqMesh.indices,
      uniforms: {
        depthMap: this._frameDepthTex,
        image: this._frameAOBlurTex,
        // direction: [0, State.bilateralBlurRadius], // TODO:
        direction: [0, 0.5],
      },
    };

    this._dofCmd = {
      name: "PostProcessing.dof",
      pass: ctx.pass({
        name: "PostProcessing.dof",
        color: [this._frameDofBlurTex],
        clearColor: [1, 1, 1, 1],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.postProcessing.vert,
        frag: SHADERS.dof.frag,
      }),
      attributes: this._fsqMesh.attributes,
      indices: this._fsqMesh.indices,
      uniforms: {
        depthMap: this._frameDepthTex,
        image: this._frameColorTex,
      },
    };

    this._thresholdCmd = {
      name: "PostProcessing.threshold",
      pass: ctx.pass({
        name: "PostProcessing.threshold",
        color: [this._frameBloomTex],
        clearColor: [1, 1, 1, 1],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.postProcessing.vert,
        frag: SHADERS.threshold.frag,
      }),
      attributes: this._fsqMesh.attributes,
      indices: this._fsqMesh.indices,
      uniforms: {
        image: this._frameColorTex,
        emissiveTex: this._frameEmissiveTex,
        // TODO: this should be called screenSize as it's used to calculate uv
        imageSize: [this._frameBloomTex.width, this._frameBloomTex.height],
      },
    };

    this._downSampleCmds = this._frameDownSampleTextures.map((texture, i) => {
      const srcTexture =
        i === 0 ? this._frameBloomTex : this._frameDownSampleTextures[i - 1];

      return {
        name: `PostProcessing.downSample[${i}]`,
        pass: ctx.pass({
          name: `PostProcessing.downSample[${i}]`,
          color: [texture],
        }),
        pipeline: ctx.pipeline({
          vert: SHADERS.postProcessing.vert,
          frag: SHADERS.downSample.frag,
        }),
        attributes: this._fsqMesh.attributes,
        indices: this._fsqMesh.indices,
        uniforms: {
          image: srcTexture,
          imageSize: [srcTexture.width, srcTexture.height],
          intensity: this.bloomRadius,
        },
      };
    });

    this._bloomCmds = this._frameDownSampleTextures
      .slice(1)
      .map((texture, i) => ({
        name: `PostProcessing.bloom[${i}]`,

        pass: ctx.pass({
          name: `PostProcessing.bloom[${i}]`,
          color: [this._frameBloomTex],
        }),

        pipeline: ctx.pipeline({
          vert: SHADERS.postProcessing.vert,
          frag: SHADERS.bloom.frag,
          blend: true,
        }),

        attributes: this._fsqMesh.attributes,
        indices: this._fsqMesh.indices,

        uniforms: {
          image: texture,
          imageSize: [texture.width, texture.height],
        },
      }));

    // this._overlayProgram = ctx.program({ vert: SHADERS.postProcessing.vert, frag: SHADERS.postProcessing.frag }) // TODO
    this._blitCmd = {
      name: "PostProcessing.blit",
      pipeline: ctx.pipeline({
        vert: SHADERS.postProcessing.vert,
        frag: SHADERS.postProcessing.frag,
      }),
      attributes: this._fsqMesh.attributes,
      indices: this._fsqMesh.indices,
      uniforms: {
        uOverlay: this._frameColorTex,
        uOverlayEncoding: this._frameColorTex.encoding,
        uViewMatrix: this.viewMatrix,
        depthMap: this._frameDepthTex,
        depthMapSize: [W, H],
        uBloomMap: this._frameBloomTex,
        uEmissiveMap: this._frameEmissiveTex,
      },
    };
  }
}

export default function createPostProcessing(opts) {
  return new PostProcessing(opts);
}
