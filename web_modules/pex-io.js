/** @module pex-io */ const ok = async (response)=>response.ok ? response : Promise.reject(new Error(`GET ${response.url} ${response.status} (${response.statusText})`));
/**
 * Load an item and parse the Response as text.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} options
 * @returns {Promise<string>}
 */ const loadText = async (url, options = {})=>await (await ok(await fetch(url, options))).text();
/**
 * Load an item and parse the Response as json.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} options
 * @returns {Promise<JSON>}
 */ const loadJson = async (url, options = {})=>await (await ok(await fetch(url, options))).json();
/**
 * Load an item and parse the Response as arrayBuffer.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} options
 * @returns {Promise<ArrayBuffer>}
 */ const loadArrayBuffer = async (url, options = {})=>await (await ok(await fetch(url, options))).arrayBuffer();
/**
 * Load an item and parse the Response as blob.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} options
 * @returns {Promise<Blob>}
 */ const loadBlob = async (url, options = {})=>await (await ok(await fetch(url, options))).blob();
/**
 * Load an item, parse the Response as blob and create a HTML Image.
 * @function
 * @param {string | import("./types.js").ImageOptions} urlOrOpts
 * @param {RequestInit} options
 * @returns {Promise<HTMLImageElement>}
 */ const loadImage = async (urlOrOpts, options = {})=>{
    const img = new Image();
    let src = urlOrOpts;
    if (urlOrOpts.url) {
        const { url, ...rest } = urlOrOpts;
        src = url;
        try {
            Object.assign(img, rest);
        } catch (error) {
            return Promise.reject(new Error(error));
        }
    }
    const data = await loadBlob(src, options);
    return await new Promise((resolve, reject)=>{
        img.addEventListener("load", function load() {
            img.removeEventListener("load", load);
            resolve(img);
        });
        img.addEventListener("error", function error() {
            img.removeEventListener("error", error);
            reject(img);
        });
        img.src = URL.createObjectURL(data);
    });
};
/**
 * @private
 */ const LOADERS_MAP = {
    text: loadText,
    json: loadJson,
    image: loadImage,
    blob: loadBlob,
    arrayBuffer: loadArrayBuffer
};
const LOADERS_MAP_KEYS = Object.keys(LOADERS_MAP);
/**
 * Loads resources from a named map.
 * @function
 * @param {Object.<string, import("./types.js").Resource>} resources
 * @returns {Promise<Object.<string, import("./types.js").LoadedResource>>}
 * @example
 * const resources = {
 *   hello: { text: "assets/hello.txt" },
 *   data: { json: "assets/data.json" },
 *   img: { image: "assets/tex.jpg" },
 *   blob: { blob: "assets/blob" },
 *   hdrImg: { arrayBuffer: "assets/tex.hdr", options: { mode: "no-cors" } },
 * };
 *
 * const res = await io.load(resources);
 * res.hello; // => string
 * res.data; // => Object
 * res.img; // => HTMLImageElement
 * res.blob; // => Blob
 * res.hdrImg; // => ArrayBuffer
 */ const load = (resources)=>{
    const names = Object.keys(resources);
    return Promise.allSettled(names.map(async (name)=>{
        const res = resources[name];
        const loader = LOADERS_MAP_KEYS.find((loader)=>res[loader]);
        if (loader) return await LOADERS_MAP[loader](res[loader], res.options);
        return Promise.reject(new Error(`io.load: unknown resource type "${Object.keys(res)}".
Resource needs one of ${LOADERS_MAP_KEYS.join("|")} set to an url.`));
    })).then((values)=>Object.fromEntries(Array.from(values.map((v)=>v.value || v.reason), (v, i)=>[
                names[i],
                v
            ])));
};

export { load, loadArrayBuffer, loadBlob, loadImage, loadJson, loadText };
