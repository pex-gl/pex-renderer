/** @module pex-io */ const ok = async (response)=>response.ok ? response : Promise.reject(new Error(`GET ${response.url} ${response.status} (${response.statusText})`));
/**
 * Load an item and parse the Response as text.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} [fetchOptions]
 * @returns {Promise<string>}
 */ const loadText = async (url, fetchOptions)=>await (await ok(await fetch(url, fetchOptions))).text();
/**
 * Load an item and parse the Response as json.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} [fetchOptions]
 * @returns {Promise<JSON>}
 */ const loadJson = async (url, fetchOptions)=>await (await ok(await fetch(url, fetchOptions))).json();
/**
 * Load an item and parse the Response as arrayBuffer.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} [fetchOptions]
 * @returns {Promise<ArrayBuffer>}
 */ const loadArrayBuffer = async (url, fetchOptions)=>await (await ok(await fetch(url, fetchOptions))).arrayBuffer();
/**
 * Load an item and parse the Response as bytes.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} [fetchOptions]
 * @returns {Promise<Uint8Array>}
 */ const loadBytes = async (url, fetchOptions)=>await (await ok(await fetch(url, fetchOptions))).bytes();
/**
 * Load an item and parse the Response as blob.
 * @function
 * @param {RequestInfo} url
 * @param {RequestInit} [fetchOptions]
 * @returns {Promise<Blob>}
 */ const loadBlob = async (url, fetchOptions)=>await (await ok(await fetch(url, fetchOptions))).blob();
/**
 * Create and load a HTML Image. If fetchOptions are specified, load and parse the Response as blob to set the "src" property.
 * @function
 * @param {string | import("./types.js").ImageOptions} urlOrImageProperties
 * @param {RequestInit} [fetchOptions]
 * @returns {Promise<HTMLImageElement>}
 */ const loadImage = async (urlOrImageProperties, fetchOptions)=>{
    const img = new Image();
    let src = urlOrImageProperties;
    if (urlOrImageProperties.url) {
        const { url, ...rest } = urlOrImageProperties;
        src = url;
        try {
            Object.assign(img, rest);
        } catch (error) {
            return Promise.reject(new Error(error));
        }
    }
    if (fetchOptions) {
        src = URL.createObjectURL(await loadBlob(src, fetchOptions));
    }
    return await new Promise((resolve, reject)=>{
        img.addEventListener("load", function load() {
            img.removeEventListener("load", load);
            if (fetchOptions) URL.revokeObjectURL(src);
            resolve(img);
        });
        img.addEventListener("error", function error() {
            img.removeEventListener("error", error);
            if (fetchOptions) URL.revokeObjectURL(src);
            reject(img);
        });
        img.src = src;
    });
};
/**
 * Create and load a HTML Video. If fetchOptions are specified, load and parse the Response as blob to set the "src" property.
 * @function
 * @param {string | import("./types.js").VideoOptions} urlOrVideoProperties
 * @param {RequestInit} [fetchOptions]
 * @returns {Promise<HTMLVideoElement>}
 */ const loadVideo = async (urlOrVideoProperties, fetchOptions)=>{
    const video = document.createElement("video");
    let src = urlOrVideoProperties;
    if (urlOrVideoProperties.url) {
        const { url, ...rest } = urlOrVideoProperties;
        src = url;
        try {
            Object.assign(video, rest);
        } catch (error) {
            return Promise.reject(new Error(error));
        }
    }
    if (fetchOptions) {
        src = URL.createObjectURL(await loadBlob(src, fetchOptions));
    }
    return await new Promise((resolve, reject)=>{
        video.addEventListener("canplaythrough", function canplaythrough() {
            video.removeEventListener("canplaythrough", canplaythrough);
            if (fetchOptions) URL.revokeObjectURL(src);
            resolve(video);
        });
        video.addEventListener("error", function error() {
            video.removeEventListener("error", error);
            if (fetchOptions) URL.revokeObjectURL(src);
            reject(video);
        });
        video.src = src;
    });
};
/**
 * @private
 */ const LOADERS_MAP = {
    text: loadText,
    json: loadJson,
    image: loadImage,
    video: loadVideo,
    blob: loadBlob,
    arrayBuffer: loadArrayBuffer,
    bytes: loadBytes
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
 *   video: { image: "assets/video.mp4" },
 *   blob: { blob: "assets/blob" },
 *   hdrImg: { arrayBuffer: "assets/tex.hdr", options: { mode: "no-cors" } },
 *   bytes: { bytes: "assets/tex.hdr" },
 * };
 *
 * const res = await io.load(resources);
 * res.hello; // => string
 * res.data; // => Object
 * res.img; // => HTMLImageElement
 * res.video; // => HTMLVideoElement
 * res.blob; // => Blob
 * res.hdrImg; // => ArrayBuffer
 * res.bytes; // => Uint8Array
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

export { load, loadArrayBuffer, loadBlob, loadBytes, loadImage, loadJson, loadText, loadVideo };
