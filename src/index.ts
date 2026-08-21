export {
  /** Create a world object to store entities and systems */
  default as world,
} from "./world.js";
export {
  /** Create an entity from an object of plain data components */
  default as entity,
} from "./entity.js";
export {
  /** Create a render engine eg. a collection of systems for default rendering */ default as renderEngine,
} from "./render-engine.js";

/** All components as a function returning a component with default values. */
export * as components from "./components/index.js";
/**
 * All systems as a function returning a system with a type property and an
 * update function.
 */
export * as systems from "./systems/index.js";
export * as loaders from "./loaders/index.js";
/** All pipeline shader generators, namespaced per source file. */
export * as shaders from "./shaders/index.js";

/**
 * The frame graph — declare passes and virtual resources, compile, execute —
 * and its types.
 */
export * from "./frame-graph/index.js";

/**
 * The register of named images a view has produced so far, published by the
 * render pipeline and handed to every `frameGraph.stage()` callback: what a
 * pass injected into the frame reads from and publishes to.
 */
export {
  RenderTextures,
  type TextureRequirements,
} from "./systems/render-pipeline/render-textures.js";

export * as utils from "./utils.js";
