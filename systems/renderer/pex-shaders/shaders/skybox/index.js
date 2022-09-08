import skyboxVert from "./skybox.vert.js";
import skyboxFrag from "./skybox.frag.js";
import skyEnvMapVert from "./sky-env-map.vert.js";
import skyEnvMapFrag from "./sky-env-map.frag.js";

export default {
  skybox: { vert: skyboxVert, frag: skyboxFrag },
  skyEnvMap: { vert: skyEnvMapVert, frag: skyEnvMapFrag },
};
