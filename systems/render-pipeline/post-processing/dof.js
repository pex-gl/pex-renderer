import { postProcessing as postprocessingShaders } from "pex-shaders";

const dof = ({ resourceCache, descriptors }) => {
  const dofPass = {
    name: "main",
    // prettier-ignore
    flagDefinitions: [
      [["camera", "near"], "", { uniform: "uNear" }],
      [["camera", "far"], "", { uniform: "uFar" }],
      [["camera", "exposure"], "", { uniform: "uExposure" }],

      [["postProcessing", "dof"], "USE_DOF"],
      [["postProcessing", "dof", "type"], "USE_DOF_GUSTAFSSON", { compare: "gustafsson", requires: "USE_DOF" }],
      [["postProcessing", "dof", "type"], "USE_DOF_UPITIS", { compare: "upitis", requires: "USE_DOF" }],
      [["postProcessing", "dof", "focusDistance"], "", { uniform: "uFocusDistance", requires: "USE_DOF" }],
      [["postProcessing", "dof", "focusScale"], "", { uniform: "uFocusScale", requires: "USE_DOF" }],
      [["postProcessing", "dof", "samples"], "NUM_SAMPLES", { type: "value", requires: "USE_DOF" }],
      [["postProcessing", "dof", "chromaticAberration"], "", { uniform: "uChromaticAberration", requires: "USE_DOF" }],
      [["postProcessing", "dof", "luminanceThreshold"], "", { uniform: "uLuminanceThreshold", requires: "USE_DOF" }],
      [["postProcessing", "dof", "luminanceGain"], "", { uniform: "uLuminanceGain", requires: "USE_DOF" }],
      [["postProcessing", "dof", "shape"], "USE_SHAPE_PENTAGON", { compare: "pentagon", requires: "USE_DOF_UPITIS" }],

      [["postProcessing", "dof", "physical"], "USE_PHYSICAL", { requires: "USE_DOF" }],
      [["camera", "focalLength"], "", { uniform: "uFocalLength", requires: "USE_PHYSICAL" }],
      [["camera", "fStop"], "", { uniform: "uFStop", requires: "USE_PHYSICAL" }],

      [["postProcessing", "dof", "focusOnScreenPoint"], "USE_FOCUS_ON_SCREEN_POINT"],
      [["postProcessing", "dof", "screenPoint"], "", { uniform: "uScreenPoint", requires: "USE_FOCUS_ON_SCREEN_POINT" }],
      [["postProcessing", "dof", "debug"], "USE_DEBUG", { requires: "USE_DOF" }],
    ],
    frag: postprocessingShaders.dof.frag,
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        width: viewport[2],
        height: viewport[3],
      }),
    // TODO: can i draw direct to mainColor?
    // source = target = inputColor
  };

  return [dofPass];
};

export default dof;
