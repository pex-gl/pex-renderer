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

export {
  /** Create a render graph for rendering passes */
  default as renderGraph,
} from "./render-graph.js";
export {
  /** Create a resource cache for pex-context caching. */ default as resourceCache,
} from "./resource-cache.js";

export * as utils from "./utils.js";
