import skyboxVert from "./skybox.vert.js";
import skyboxFrag from "./skybox.frag.js";
import skyEnvMapFrag from "./sky-env-map.frag.js";

export default {
  skybox: { vert: skyboxVert, frag: skyboxFrag },
  skyEnvMap: { frag: skyEnvMapFrag },
};
