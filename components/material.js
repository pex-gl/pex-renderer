import Signal from "signals";
import { mat3, mat2x3 } from "pex-math";

let MaterialID = 0;

const tempMat2x3 = mat2x3.create();

const MATERIAL_MAPS = [
  "baseColorMap",
  "emissiveColorMap",
  "matallicMap",
  "roughnessMap",
  "metallicRoughnessMap",
  "normalMap",
  "clearCoatNormalMap",
  "occlusionMap",
  "diffuseMap",
  "specularGlossinessMap",
  "sheenColorMap",
  "clearCoatMap",
  "clearCoatRoughnessMap",
];

const PIPELINE_PROPS = [
  "depthTest",
  "depthWrite",
  "depthFunc",
  "blend",
  "blendSrcRGBFactor",
  "blendSrcAlphaFactor",
  "blendDstRGBFactor",
  "blendDstAlphaFactor",
  "cullFace",
  "cullFaceMode",
];

class Material {
  constructor(opts) {
    this.type = "Material";
    this.id = `Material_${MaterialID++}`;
    this.enabled = true;
    this.changed = new Signal();

    this._uniforms = {};

    const ctx = opts.ctx;

    this.baseColor = [1, 1, 1, 1];
    this.baseColorMap = null;

    this.useSpecularGlossinessWorkflow =
      opts.useSpecularGlossinessWorkflow || false;
    this.unlit = opts.unlit || false;
    if (opts.useSpecularGlossinessWorkflow) {
      // Specular Glossiness workflow
      this.diffuse = [1, 1, 1, 1];
      this.diffuseMap = null;
      this.specular = [1, 1, 1];
      this.glossiness = 1;
      this.specularGlossinessMap = null;
    } else if (!this.unlit) {
      // Metallic Roughness workflow
      this.metallic = 1;
      this.matallicMap = null;
      this.roughness = 1;
      this.roughnessMap = null;
      this.metallicRoughnessMap = null;
    }

    this.normalMap = null;
    this.normalScale = 1;

    this.displacementMap = null;
    this.displacement = 0;

    this.emissiveColor = null;
    this.emissiveIntensity = 1;
    this.emissiveColorMap = null;

    this.occlusionMap = null;

    this.reflectance = 0.5;
    this.clearCoat = null;
    this.clearCoatMap = null;
    this.clearCoatRoughness = null;
    this.clearCoatRoughnessMap = null;
    this.clearCoatNormalMap = null;
    this.clearCoatNormalMapScale = 1; //TODO: what's clearCoatNormalMapScale

    this.sheenColor = null;
    this.sheenColorMap = null;
    this.sheenRoughness = null;

    this.alphaMap = null;
    this.alphaTest = undefined;

    // pipeline props
    this.depthTest = true;
    this.depthWrite = true;
    this.depthFunc = ctx.DepthFunc.LessEqual;
    this.blend = false;
    this.blendSrcRGBFactor = ctx.BlendFactor.One;
    this.blendSrcAlphaFactor = ctx.BlendFactor.One;
    this.blendDstRGBFactor = ctx.BlendFactor.One;
    this.blendDstAlphaFactor = ctx.BlendFactor.One;
    this.cullFace = true;
    this.cullFaceMode = ctx.Face.Back;

    this.pointSize = 1;

    this.castShadows = false;
    this.receiveShadows = false;

    this.needsPipelineUpdate = false;

    this.set(opts);
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);

    const optsKeys = Object.keys(opts);

    const mapKeys = optsKeys.filter((opt) => MATERIAL_MAPS.includes(opt));
    if (mapKeys.length) {
      for (let i = 0; i < mapKeys.length; i++) {
        const map = this[mapKeys[i]];
        if (map && map.texture) {
          mat2x3.identity(tempMat2x3);
          mat2x3.translate(tempMat2x3, map.offset || [0, 0]);
          mat2x3.rotate(tempMat2x3, -map.rotation || 0);
          mat2x3.scale(tempMat2x3, map.scale || [1, 1]);

          map.texCoordTransformMatrix = mat3.fromMat2x3(
            map.texCoordTransformMatrix
              ? mat3.identity(map.texCoordTransformMatrix)
              : mat3.create(),
            tempMat2x3
          );
        }
      }
    }

    for (let pipelineProp of PIPELINE_PROPS) {
      if (opts[pipelineProp] !== undefined) {
        this.needsPipelineUpdate = true;
      }
    }

    optsKeys.forEach((prop) => this.changed.dispatch(prop));
  }
}

export default (opts = {}) => {
  //return new Material(opts);
  return {
    baseColor: [1, 1, 1, 1],
    metallic: 1,
    roughness: 1,
    depthTest: true,
    depthWrite: true,
    ...opts,
  };
};
