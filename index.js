/** @module pex-renderer */

export {
  /**
   * Create a world object to store entities and systems
   * @function
   * @returns {import("./types.js").World}
   */
  default as world,
} from "./world.js";
export {
  /**
   * Create an entity from an object of plain data components
   * @function
   * @param {object} [components={}]
   * @returns {import("./types.js").Entity}
   */
  default as entity,
} from "./entity.js";
export {
  /**
   * Create a render engine eg. a collection of systems for default rendering
   * @function
   * @returns {import("./types.js").RenderEngine}
   */ default as renderEngine,
} from "./render-engine.js";

/**
 * All components as a function returning a component with default values.
 * @type {module:components}
 * @name components
 * @static
 */
export * as components from "./components/index.js";
/**
 * All systems as a function returning a system with a type property and an update function.
 * @type {module:systems}
 * @name systems
 * @static
 */
export * as systems from "./systems/index.js";
export * as loaders from "./loaders/index.js";

export {
  /**
   * Create a render graph for rendering passes
   * @function
   * @param {import("pex-context/types/index.js")} ctx
   * @returns {import("./types.js").RenderGraph}
   */
  default as renderGraph,
} from "./render-graph.js";
export {
  /**
   * Create a resource cache for pex-context caching.
   * @function
   * @param {import("pex-context/types/index.js")} ctx
   * @returns {import("./types.js").ResourceCache}
   */ default as resourceCache,
} from "./resource-cache.js";

export * as utils from "./utils.js";
