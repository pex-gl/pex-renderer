/** @module pipeline */

import blit from "./blit.js";
import reversibleToneMap from "./reversibleToneMap.js";
import depthPass from "./depth-pass.js";
import depthPrePass from "./depth-pre-pass.js";
import standard from "./standard.js";
import basic from "./basic.js";
import line from "./line.js";
import overlay from "./overlay.js";
import helper from "./helper.js";
import error from "./error.js";

/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { blit };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { reversibleToneMap };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { depthPass };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { depthPrePass };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { standard };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { basic };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { line };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { overlay };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { helper };
/**
 * (defines, options) => wgslString, containing both @vertex and @fragment entry points.
 * @member {Function}
 * @static
 */
export { error };
