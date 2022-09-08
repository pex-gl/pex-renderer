import blitToOctMapAtlasFrag from "./blit-to-oct-map-atlas.frag.js";
import convolveOctMapAtlasToOctMapFrag from "./convolve-oct-map-atlas-to-oct-map.frag.js";
import cubemapToOctmapFrag from "./cubemap-to-octmap.frag.js";
import downsampleFromOctMapAtlasFrag from "./downsample-from-oct-map-atlas.frag.js";
import fullscreenQuadVert from "./fullscreen-quad.vert.js";
import prefilterFromOctMapAtlasFrag from "./prefilter-from-oct-map-atlas.frag.js";

export default {
  blitToOctMapAtlas: { frag: blitToOctMapAtlasFrag },
  convolveOctMapAtlasToOctMap: { frag: convolveOctMapAtlasToOctMapFrag },
  cubemapToOctMap: { frag: cubemapToOctmapFrag },
  downsampleFromOctMapAtlas: { frag: downsampleFromOctMapAtlasFrag },
  fullscreenQuad: { vert: fullscreenQuadVert },
  prefilterFromOctMapAtlas: { frag: prefilterFromOctMapAtlasFrag },
};
