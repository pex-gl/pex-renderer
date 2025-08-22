import { loadArrayBuffer } from './pex-io.js';
import { B as Buffer, g as getDefaultExportFromCjs } from './_chunks/polyfills-Ci6ALveU.js';
import { c as clamp } from './_chunks/utils-B1Ghr_dy.js';
import { b as blit } from './_chunks/index-IVey3wE5.js';

class WorkerPool {
    constructor(workerLimit = 4, workerConfig = {}){
        this.workerLimit = workerLimit;
        this.workerConfig = workerConfig;
        this.workerPool = [];
        this.workerNextTaskID = 0;
        this.taskCache = new WeakMap();
    }
    async getWorker(transcoderPending, taskCost) {
        const [workerSourceURL, wasmBinary] = await transcoderPending;
        this.workerNextTaskID++;
        const taskId = this.workerNextTaskID;
        if (this.workerPool.length < this.workerLimit) {
            const worker = new Worker(workerSourceURL);
            worker._callbacks = {};
            worker._taskCosts = {};
            worker._taskLoad = 0;
            worker.postMessage({
                type: "init",
                config: {
                    ...this.workerConfig,
                    wasmBinary
                }
            });
            worker.onmessage = ({ data })=>{
                const message = data;
                switch(message.type){
                    case "decode":
                        worker._callbacks[message.id].resolve(message);
                        break;
                    case "error":
                        worker._callbacks[message.id].reject(message);
                        break;
                    default:
                        // eslint-disable-next-line no-console
                        console.error(message);
                }
            };
            this.workerPool.push(worker);
        } else {
            this.workerPool.sort((a, b)=>a._taskLoad > b._taskLoad ? -1 : 1);
        }
        const worker = this.workerPool[this.workerPool.length - 1];
        worker._taskCosts[taskId] = taskCost;
        worker._taskLoad += taskCost;
        return {
            worker,
            taskId
        };
    }
    hasTask(taskKey, buffer) {
        if (this.taskCache.has(buffer)) {
            const { key, promise } = this.taskCache.get(buffer);
            if (key === taskKey) return promise;
        }
        return false;
    }
    releaseTask(worker, taskID) {
        worker._taskLoad -= worker._taskCosts[taskID];
        delete worker._callbacks[taskID];
        delete worker._taskCosts[taskID];
    }
    dispose() {
        for(let i = 0; i < this.workerPool.length; ++i){
            this.workerPool[i].terminate();
        }
        this.workerPool = [];
    }
}

let workerPool$1;
// Decoder API
let transcoderPending$1;
const getWorkerStringUrl$1 = (transcoder, worker)=>{
    const str = `
${transcoder}
${worker}
DracoWorker()
`;
    return URL.createObjectURL(new Blob([
        str
    ]));
};
// TODO: draco_decoder.js only
const getTranscoder$1 = async (transcoderPath)=>transcoderPending$1 || Promise.all([
        getWorkerStringUrl$1(await (await fetch(`${transcoderPath}draco_wasm_wrapper.js`)).text(), await (await (await fetch(`${transcoderPath}draco-worker.js`)).text()).replace("module.exports = DracoWorker", "")),
        await (await fetch(`${transcoderPath}draco_decoder.wasm`)).arrayBuffer()
    ]);
function loadGeometry(buffer, taskConfig) {
    const taskKey = JSON.stringify(taskConfig);
    const cachedTask = workerPool$1.hasTask(taskKey, buffer);
    if (cachedTask) return cachedTask;
    let worker;
    let taskId;
    const geometryPending = workerPool$1.getWorker(transcoderPending$1, buffer.byteLength).then((workerData)=>{
        ({ worker, taskId } = workerData);
        return new Promise((resolve, reject)=>{
            worker._callbacks[taskId] = {
                resolve,
                reject
            };
            worker.postMessage({
                type: "decode",
                id: taskId,
                taskConfig,
                buffer
            }, [
                buffer
            ]);
        });
    }).then(({ geometry })=>geometry);
    // Remove task from the task list.
    geometryPending.catch(()=>true).then(()=>{
        if (worker && taskId) {
            workerPool$1.releaseTask(worker, taskId);
        }
    });
    // Cache the task result.
    workerPool$1.taskCache.set(buffer, {
        key: taskKey,
        promise: geometryPending
    });
    return geometryPending;
}
/**
 * @typedef DracoOptions
 * @property {string} [transcoderPath='assets/decoders/draco/']
 * @property {object} [transcodeConfig={}]
 * @property {number} [workerLimit=4]
 * @property {object} [workerConfig={}]
 */ /**
 * Load a draco file or array buffer as a texture
 * @alias module:pex-loaders.loadDraco
 * @param {string | ArrayBuffer} data
 * @param {DracoOptions} [options]
 * @returns {Promise<object>}
 */ async function loadDraco(data, { transcoderPath = "assets/decoders/draco/", transcodeConfig = {
    attributeIDs: {
        positions: "POSITION",
        normals: "NORMAL",
        texCoords: "TEX_COORD",
        colors: "COLOR"
    },
    attributeTypes: {
        positions: "Float32Array",
        normals: "Float32Array",
        texCoords: "Float32Array",
        colors: "Float32Array"
    },
    useUniqueIDs: false
}, workerLimit, workerConfig } = {}) {
    if (!workerPool$1) workerPool$1 = new WorkerPool(workerLimit, workerConfig);
    transcoderPending$1 = getTranscoder$1(transcoderPath);
    return await loadGeometry(data instanceof ArrayBuffer ? data : await loadArrayBuffer(data), transcodeConfig);
}

///////////////////////////////////////////////////
// KTX2 Header.
///////////////////////////////////////////////////
const KHR_SUPERCOMPRESSION_NONE = 0;
const KHR_SUPERCOMPRESSION_ZSTD = 2;
///////////////////////////////////////////////////
// Data Format Descriptor (DFD).
///////////////////////////////////////////////////
const KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT = 0;
const KHR_DF_VENDORID_KHRONOS = 0;
const KHR_DF_VERSION = 2;
const KHR_DF_MODEL_UNSPECIFIED = 0;
const KHR_DF_MODEL_UASTC = 166;
const KHR_DF_FLAG_ALPHA_STRAIGHT = 0;
const KHR_DF_FLAG_ALPHA_PREMULTIPLIED = 1;
const KHR_DF_TRANSFER_SRGB = 2;
const KHR_DF_PRIMARIES_BT709 = 1;
const KHR_DF_SAMPLE_DATATYPE_SIGNED = 0x40;
///////////////////////////////////////////////////
// VK FORMAT.
///////////////////////////////////////////////////
const VK_FORMAT_UNDEFINED = 0;
/**
 * Represents an unpacked KTX 2.0 texture container. Data for individual mip levels are stored in
 * the `.levels` array, typically compressed in Basis Universal formats. Additional properties
 * provide metadata required to process, transcode, and upload these textures.
 */ class KTX2Container {
    constructor(){
        /**
     * Specifies the image format using Vulkan VkFormat enum values. When using Basis Universal
     * texture formats, `vkFormat` must be VK_FORMAT_UNDEFINED.
     */ this.vkFormat = VK_FORMAT_UNDEFINED;
        /**
     * Size of the data type in bytes used to upload the data to a graphics API. When `vkFormat` is
     * VK_FORMAT_UNDEFINED, `typeSize` must be 1.
     */ this.typeSize = 1;
        /** Width of the texture image for level 0, in pixels. */ this.pixelWidth = 0;
        /** Height of the texture image for level 0, in pixels. */ this.pixelHeight = 0;
        /** Depth of the texture image for level 0, in pixels (3D textures only). */ this.pixelDepth = 0;
        /** Number of array elements (array textures only). */ this.layerCount = 0;
        /**
     * Number of cubemap faces. For cubemaps and cubemap arrays, `faceCount` must be 6. For all
     * other textures, `faceCount` must be 1. Cubemap faces are stored in +X, -X, +Y, -Y, +Z, -Z
     * order.
     */ this.faceCount = 1;
        /** Indicates which supercompression scheme has been applied to mip level images, if any. */ this.supercompressionScheme = KHR_SUPERCOMPRESSION_NONE;
        /** Mip levels, ordered largest (original) to smallest (~1px). */ this.levels = [];
        /** Data Format Descriptor. */ this.dataFormatDescriptor = [
            {
                vendorId: KHR_DF_VENDORID_KHRONOS,
                descriptorType: KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT,
                descriptorBlockSize: 0,
                versionNumber: KHR_DF_VERSION,
                colorModel: KHR_DF_MODEL_UNSPECIFIED,
                colorPrimaries: KHR_DF_PRIMARIES_BT709,
                transferFunction: KHR_DF_TRANSFER_SRGB,
                flags: KHR_DF_FLAG_ALPHA_STRAIGHT,
                texelBlockDimension: [
                    0,
                    0,
                    0,
                    0
                ],
                bytesPlane: [
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0
                ],
                samples: []
            }
        ];
        /** Key/Value Data. */ this.keyValue = {};
        /** Supercompression Global Data. */ this.globalData = null;
    }
}
class BufferReader {
    constructor(data, byteOffset, byteLength, littleEndian){
        this._dataView = void 0;
        this._littleEndian = void 0;
        this._offset = void 0;
        this._dataView = new DataView(data.buffer, data.byteOffset + byteOffset, byteLength);
        this._littleEndian = littleEndian;
        this._offset = 0;
    }
    _nextUint8() {
        const value = this._dataView.getUint8(this._offset);
        this._offset += 1;
        return value;
    }
    _nextUint16() {
        const value = this._dataView.getUint16(this._offset, this._littleEndian);
        this._offset += 2;
        return value;
    }
    _nextUint32() {
        const value = this._dataView.getUint32(this._offset, this._littleEndian);
        this._offset += 4;
        return value;
    }
    _nextUint64() {
        const left = this._dataView.getUint32(this._offset, this._littleEndian);
        const right = this._dataView.getUint32(this._offset + 4, this._littleEndian);
        // TODO(cleanup): Just test this...
        // const value = this._littleEndian ? left + (2 ** 32 * right) : (2 ** 32 * left) + right;
        const value = left + 2 ** 32 * right;
        this._offset += 8;
        return value;
    }
    _nextInt32() {
        const value = this._dataView.getInt32(this._offset, this._littleEndian);
        this._offset += 4;
        return value;
    }
    _nextUint8Array(len) {
        const value = new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + this._offset, len);
        this._offset += len;
        return value;
    }
    _skip(bytes) {
        this._offset += bytes;
        return this;
    }
    _scan(maxByteLength, term = 0x00) {
        const byteOffset = this._offset;
        let byteLength = 0;
        while(this._dataView.getUint8(this._offset) !== term && byteLength < maxByteLength){
            byteLength++;
            this._offset++;
        }
        if (byteLength < maxByteLength) this._offset++;
        return new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + byteOffset, byteLength);
    }
}
///////////////////////////////////////////////////
// KTX2 Header.
///////////////////////////////////////////////////
const KTX2_ID = [
    // '´', 'K', 'T', 'X', '2', '0', 'ª', '\r', '\n', '\x1A', '\n'
    0xab,
    0x4b,
    0x54,
    0x58,
    0x20,
    0x32,
    0x30,
    0xbb,
    0x0d,
    0x0a,
    0x1a,
    0x0a
];
/** Decodes an ArrayBuffer to text. */ function decodeText(buffer) {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(buffer);
    }
    return Buffer.from(buffer).toString('utf8');
}
/**
 * Parses a KTX 2.0 file, returning an unpacked {@link KTX2Container} instance with all associated
 * data. The container's mip levels and other binary data are pointers into the original file, not
 * copies, so the original file should not be overwritten after reading.
 *
 * @param data Bytes of KTX 2.0 file, as Uint8Array or Buffer.
 */ function read(data) {
    ///////////////////////////////////////////////////
    // KTX 2.0 Identifier.
    ///////////////////////////////////////////////////
    const id = new Uint8Array(data.buffer, data.byteOffset, KTX2_ID.length);
    if (id[0] !== KTX2_ID[0] || // '´'
    id[1] !== KTX2_ID[1] || // 'K'
    id[2] !== KTX2_ID[2] || // 'T'
    id[3] !== KTX2_ID[3] || // 'X'
    id[4] !== KTX2_ID[4] || // ' '
    id[5] !== KTX2_ID[5] || // '2'
    id[6] !== KTX2_ID[6] || // '0'
    id[7] !== KTX2_ID[7] || // 'ª'
    id[8] !== KTX2_ID[8] || // '\r'
    id[9] !== KTX2_ID[9] || // '\n'
    id[10] !== KTX2_ID[10] || // '\x1A'
    id[11] !== KTX2_ID[11] // '\n'
    ) {
        throw new Error('Missing KTX 2.0 identifier.');
    }
    const container = new KTX2Container();
    ///////////////////////////////////////////////////
    // Header.
    ///////////////////////////////////////////////////
    const headerByteLength = 17 * Uint32Array.BYTES_PER_ELEMENT;
    const headerReader = new BufferReader(data, KTX2_ID.length, headerByteLength, true);
    container.vkFormat = headerReader._nextUint32();
    container.typeSize = headerReader._nextUint32();
    container.pixelWidth = headerReader._nextUint32();
    container.pixelHeight = headerReader._nextUint32();
    container.pixelDepth = headerReader._nextUint32();
    container.layerCount = headerReader._nextUint32();
    container.faceCount = headerReader._nextUint32();
    const levelCount = headerReader._nextUint32();
    container.supercompressionScheme = headerReader._nextUint32();
    const dfdByteOffset = headerReader._nextUint32();
    const dfdByteLength = headerReader._nextUint32();
    const kvdByteOffset = headerReader._nextUint32();
    const kvdByteLength = headerReader._nextUint32();
    const sgdByteOffset = headerReader._nextUint64();
    const sgdByteLength = headerReader._nextUint64();
    ///////////////////////////////////////////////////
    // Level Index.
    ///////////////////////////////////////////////////
    const levelByteLength = levelCount * 3 * 8;
    const levelReader = new BufferReader(data, KTX2_ID.length + headerByteLength, levelByteLength, true);
    for(let i = 0; i < levelCount; i++){
        container.levels.push({
            levelData: new Uint8Array(data.buffer, data.byteOffset + levelReader._nextUint64(), levelReader._nextUint64()),
            uncompressedByteLength: levelReader._nextUint64()
        });
    }
    ///////////////////////////////////////////////////
    // Data Format Descriptor (DFD).
    ///////////////////////////////////////////////////
    const dfdReader = new BufferReader(data, dfdByteOffset, dfdByteLength, true);
    const dfd = {
        vendorId: dfdReader._skip(4 /* totalSize */ )._nextUint16(),
        descriptorType: dfdReader._nextUint16(),
        versionNumber: dfdReader._nextUint16(),
        descriptorBlockSize: dfdReader._nextUint16(),
        colorModel: dfdReader._nextUint8(),
        colorPrimaries: dfdReader._nextUint8(),
        transferFunction: dfdReader._nextUint8(),
        flags: dfdReader._nextUint8(),
        texelBlockDimension: [
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8()
        ],
        bytesPlane: [
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8(),
            dfdReader._nextUint8()
        ],
        samples: []
    };
    const sampleStart = 6;
    const sampleWords = 4;
    const numSamples = (dfd.descriptorBlockSize / 4 - sampleStart) / sampleWords;
    for(let i = 0; i < numSamples; i++){
        const sample = {
            bitOffset: dfdReader._nextUint16(),
            bitLength: dfdReader._nextUint8(),
            channelType: dfdReader._nextUint8(),
            samplePosition: [
                dfdReader._nextUint8(),
                dfdReader._nextUint8(),
                dfdReader._nextUint8(),
                dfdReader._nextUint8()
            ],
            sampleLower: -Infinity,
            sampleUpper: Infinity
        };
        if (sample.channelType & KHR_DF_SAMPLE_DATATYPE_SIGNED) {
            sample.sampleLower = dfdReader._nextInt32();
            sample.sampleUpper = dfdReader._nextInt32();
        } else {
            sample.sampleLower = dfdReader._nextUint32();
            sample.sampleUpper = dfdReader._nextUint32();
        }
        dfd.samples[i] = sample;
    }
    container.dataFormatDescriptor.length = 0;
    container.dataFormatDescriptor.push(dfd);
    ///////////////////////////////////////////////////
    // Key/Value Data (KVD).
    ///////////////////////////////////////////////////
    const kvdReader = new BufferReader(data, kvdByteOffset, kvdByteLength, true);
    while(kvdReader._offset < kvdByteLength){
        const keyValueByteLength = kvdReader._nextUint32();
        const keyData = kvdReader._scan(keyValueByteLength);
        const key = decodeText(keyData);
        container.keyValue[key] = kvdReader._nextUint8Array(keyValueByteLength - keyData.byteLength - 1);
        if (key.match(/^ktx/i)) {
            const text = decodeText(container.keyValue[key]);
            container.keyValue[key] = text.substring(0, text.lastIndexOf('\x00'));
        }
        const kvPadding = keyValueByteLength % 4 ? 4 - keyValueByteLength % 4 : 0; // align(4)
        // 4-byte alignment.
        kvdReader._skip(kvPadding);
    }
    ///////////////////////////////////////////////////
    // Supercompression Global Data (SGD).
    ///////////////////////////////////////////////////
    if (sgdByteLength <= 0) return container;
    const sgdReader = new BufferReader(data, sgdByteOffset, sgdByteLength, true);
    const endpointCount = sgdReader._nextUint16();
    const selectorCount = sgdReader._nextUint16();
    const endpointsByteLength = sgdReader._nextUint32();
    const selectorsByteLength = sgdReader._nextUint32();
    const tablesByteLength = sgdReader._nextUint32();
    const extendedByteLength = sgdReader._nextUint32();
    const imageDescs = [];
    for(let i = 0; i < levelCount; i++){
        imageDescs.push({
            imageFlags: sgdReader._nextUint32(),
            rgbSliceByteOffset: sgdReader._nextUint32(),
            rgbSliceByteLength: sgdReader._nextUint32(),
            alphaSliceByteOffset: sgdReader._nextUint32(),
            alphaSliceByteLength: sgdReader._nextUint32()
        });
    }
    const endpointsByteOffset = sgdByteOffset + sgdReader._offset;
    const selectorsByteOffset = endpointsByteOffset + endpointsByteLength;
    const tablesByteOffset = selectorsByteOffset + selectorsByteLength;
    const extendedByteOffset = tablesByteOffset + tablesByteLength;
    const endpointsData = new Uint8Array(data.buffer, data.byteOffset + endpointsByteOffset, endpointsByteLength);
    const selectorsData = new Uint8Array(data.buffer, data.byteOffset + selectorsByteOffset, selectorsByteLength);
    const tablesData = new Uint8Array(data.buffer, data.byteOffset + tablesByteOffset, tablesByteLength);
    const extendedData = new Uint8Array(data.buffer, data.byteOffset + extendedByteOffset, extendedByteLength);
    container.globalData = {
        endpointCount,
        selectorCount,
        imageDescs,
        endpointsData,
        selectorsData,
        tablesData,
        extendedData
    };
    return container;
}

let init;
let instance;
let heap;
const IMPORT_OBJECT = {
    env: {
        emscripten_notify_memory_growth: function(index) {
            heap = new Uint8Array(instance.exports.memory.buffer);
        }
    }
};
/**
 * ZSTD (Zstandard) decoder.
 */ class ZSTDDecoder {
    init() {
        if (init) return init;
        if (typeof fetch !== 'undefined') {
            // Web.
            init = fetch('data:application/wasm;base64,' + wasm).then((response)=>response.arrayBuffer()).then((arrayBuffer)=>WebAssembly.instantiate(arrayBuffer, IMPORT_OBJECT)).then(this._init);
        } else {
            // Node.js.
            init = WebAssembly.instantiate(Buffer.from(wasm, 'base64'), IMPORT_OBJECT).then(this._init);
        }
        return init;
    }
    _init(result) {
        instance = result.instance;
        IMPORT_OBJECT.env.emscripten_notify_memory_growth(0); // initialize heap.
    }
    decode(array, uncompressedSize = 0) {
        if (!instance) throw new Error(`ZSTDDecoder: Await .init() before decoding.`);
        // Write compressed data into WASM memory.
        const compressedSize = array.byteLength;
        const compressedPtr = instance.exports.malloc(compressedSize);
        heap.set(array, compressedPtr);
        // Decompress into WASM memory.
        uncompressedSize = uncompressedSize || Number(instance.exports.ZSTD_findDecompressedSize(compressedPtr, compressedSize));
        const uncompressedPtr = instance.exports.malloc(uncompressedSize);
        const actualSize = instance.exports.ZSTD_decompress(uncompressedPtr, uncompressedSize, compressedPtr, compressedSize);
        // Read decompressed data and free WASM memory.
        const dec = heap.slice(uncompressedPtr, uncompressedPtr + actualSize);
        instance.exports.free(compressedPtr);
        instance.exports.free(uncompressedPtr);
        return dec;
    }
}
/**
 * BSD License
 *
 * For Zstandard software
 *
 * Copyright (c) 2016-present, Yann Collet, Facebook, Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 *  * Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 *  * Neither the name Facebook nor the names of its contributors may be used to
 *    endorse or promote products derived from this software without specific
 *    prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */ // wasm:begin
const wasm = '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IAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAACy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAIajYCACADCy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAFajYCACADCx8AIAAgASACKAIEEAg2AgAgARAEGiAAIAJBCGo2AgQLCAAgAGdBH3MLugUBDX8jAEEQayIKJAACfyAEQQNNBEAgCkEANgIMIApBDGogAyAEEAsaIAAgASACIApBDGpBBBAVIgBBbCAAEAMbIAAgACAESxsMAQsgAEEAIAEoAgBBAXRBAmoQECENQVQgAygAACIGQQ9xIgBBCksNABogAiAAQQVqNgIAIAMgBGoiAkF8aiEMIAJBeWohDiACQXtqIRAgAEEGaiELQQQh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ASIDNgLE4AEgACgCvOABIQQgACABNgK84AEgACABIAJqNgK44AEgACABIAQgA2tqNgLA4AELpgEBAX8gACAAKALs4QEQFjYCyOABIABCADcD+OABIABCADcDuOABIABBwOABakIANwMAIABBqNAAaiIBQYyAgOAANgIAIABBADYCmOIBIABCADcDiOEBIABCAzcDgOEBIABBrNABakHgEikCADcCACAAQbTQAWpB6BIoAgA2AgAgACABNgIMIAAgAEGYIGo2AgggACAAQaAwajYCBCAAIABBEGo2AgALYQEBf0G4fyEDAkAgAUEDSQ0AIAIgABAhIgFBA3YiADYCCCACIAFBAXE2AgQgAiABQQF2QQNxIgM2AgACQCADQX9qIgFBAksNAAJAIAFBAWsOAgEAAgtBbA8LIAAhAwsgAwsMACAAIAEgAkEAEC4LiAQCA38CfiADEBYhBCAAQQBBKBAQIQAgBCACSwRAIAQPCyABRQRAQX8PCwJAAkAgA0EBRg0AIAEoAAAiBkGo6r5pRg0AQXYhAyAGQXBxQdDUtMIBRw0BQQghAyACQQhJDQEgAEEAQSgQECEAIAEoAAQhASAAQQE2AhQgACABrTcDAEEADwsgASACIAMQLyIDIAJLDQAgACADNgIYQXIhAyABIARqIgVBf2otAAAiAkEIcQ0AIAJBIHEiBkUEQEFwIQMgBS0AACIFQacBSw0BIAVBB3GtQgEgBUEDdkEKaq2GIgdCA4h+IAd8IQggBEEBaiEECyACQQZ2IQMgAkECdiEFAkAgAkEDcUF/aiICQQJLBEBBACECDAELAkACQAJAIAJBAWsOAgECAAsgASAEai0AACECIARBAWohBAwCCyABIARqLwAAIQIgBEECaiEEDAELIAEgBGooAAAhAiAEQQRqIQQLIAVBAXEhBQJ+AkACQAJAIANBf2oiA0ECTQRAIANBAWsOAgIDAQtCfyAGRQ0DGiABIARqMQAADAMLIAEgBGovAACtQoACfAwCCyABIARqKAAArQwBCyABIARqKQAACyEHIAAgBTYCICAAIAI2AhwgACAHNwMAQQAhAyAAQQA2AhQgACAHIAggBhsiBzcDCCAAIAdCgIAIIAdCgIAIVBs+AhALIAMLWwEBf0G4fyEDIAIQFiICIAFNBH8gACACakF/ai0AACIAQQNxQQJ0QaAeaigC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C0Egak8NAQsgByAHKQNoNwMQIAcgBykDYDcDCCAEIA0gB0EIaiAHQdwAaiAPIA4gESAQEB4hCwwBCyACIARqIQggBCAKEAcgAkERTwRAIARBEGohAgNAIAIgCkEQaiIKEAcgAkEQaiICIAhJDQALCyAIIAlrIQIgByATNgJcIAkgCCAOa0sEQCAJIAggEWtLBEBBbCELDAILIBAgAiAOayICaiIKIANqIBBNBEAgCCAKIAMQDxoMAgsgCCAKQQAgAmsQDyEIIAcgAiADaiIDNgJkIAggAmshCCAOIQILIAlBEE8EQCADIAhqIQMDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALDAELAkAgCUEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgCUECdCIDQcAeaigCAGoiAhAXIAIgA0HgHmooAgBrIQIgBygCZCEDDAELIAggAhAMCyADQQlJDQAgAyAIaiEDIAhBCGoiCCACQQhqIgJrQQ9MBEADQCAIIAIQDCACQQhqIQIgCEEIaiIIIANJDQAMAgALAAsDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALCyAHQRhqEAQaIAsgDCALEAMiAhshDCAEIAQgC2ogAhshBCAFQX9qIgUNAAsgDBADDQFBbCEMIAdBGGoQBEECSQ0BQQAhCANAIAhBA0cEQCAAIAhBAnQiAmpBrNABaiACIAdqKAJENgIAIAhBAWohCAwBCwsgBygCXCEIC0G6fyEMIA8gCGsiACANIARrSw0AIAQEfyAEIAggABALIABqBUEACyABayEMCyAHQfAAaiQAIAwLkRcCFn8FfiMAQdABayIHJAAgByAAKALw4QEiCDYCvAEgASACaiESIAggACgCgOIBaiETAkACQCAFRQRAIAEhAwwBCyAAKALE4AEhESAAKALA4AEhFSAAKAK84AEhDyAAQQE2AozhAUEAIQgDQCAIQQNHBEAgByAIQQJ0IgJqIAAgAmpBrNABaigCADYCVCAIQQFqIQgMAQsLIAcgETYCZCAHIA82AmAgByABIA9rNgJoQWwhECAHQShqIAMgBBAGEAMNASAFQQQgBUEESBshFyAHQTxqIAdBKGogACgCABATIAdBxABqIAdBKGogACgCCBATIAdBzABqIAdB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IAdB0AFqJAAgEAslACAAQgA3AgAgAEEAOwEIIABBADoACyAAIAE2AgwgACACOgAKC7QFAQN/IwBBMGsiBCQAIABB/wFqIgVBfWohBgJAIAMvAQIEQCAEQRhqIAEgAhAGIgIQAw0BIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahASOgAAIAMgBEEIaiAEQRhqEBI6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0FIAEgBEEQaiAEQRhqEBI6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBSABIARBCGogBEEYahASOgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEjoAACABIAJqIABrIQIMAwsgAyAEQRBqIARBGGoQEjoAAiADIARBCGogBEEYahASOgADIANBBGohAwwAAAsACyAEQRhqIAEgAhAGIgIQAw0AIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahAROgAAIAMgBEEIaiAEQRhqEBE6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0EIAEgBEEQaiAEQRhqEBE6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBCABIARBCGogBEEYahAROgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEToAACABIAJqIABrIQIMAgsgAyAEQRBqIARBGGoQEToAAiADIARBCGogBEEYahAROgADIANBBGohAwwAAAsACyAEQTBqJAAgAgtpAQF/An8CQAJAIAJBB00NACABKAAAQbfIwuF+Rw0AIAAgASgABDYCmOIBQWIgAEEQaiABIAIQPiIDEAMNAhogAEKBgICAEDcDiOEBIAAgASADaiACIANrECoMAQsgACABIAIQKgtBAAsLrQMBBn8jAEGAAWsiAyQAQWIhCAJAIAJBCUkNACAAQZjQAGogAUEIaiIEIAJBeGogAEGY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wOABCwutAgIEfwF+IwBBQGoiBCQAAkACQCACQQhJDQAgASgAAEFwcUHQ1LTCAUcNACABIAIQIiEBIABCADcDCCAAQQA2AgQgACABNgIADAELIARBGGogASACEC0iAxADBEAgACADEBoMAQsgAwRAIABBuH8QGgwBCyACIAQoAjAiA2shAiABIANqIQMDQAJAIAAgAyACIARBCGoQLCIFEAMEfyAFBSACIAVBA2oiBU8NAUG4fwsQGgwCCyAGQQFqIQYgAiAFayECIAMgBWohAyAEKAIMRQ0ACyAEKAI4BEAgAkEDTQRAIABBuH8QGgwCCyADQQRqIQMLIAQoAighAiAEKQMYIQcgAEEANgIEIAAgAyABazYCACAAIAIgBmytIAcgB0J/URs3AwgLIARBQGskAAslAQF/IwBBEGsiAiQAIAIgACABEFEgAigCACEAIAJBEGokACAAC30BBH8jAEGQBGsiBCQAIARB/wE2AggCQCAEQRBqIARBCGogBEEMaiABIAIQFSIGEAMEQCAGIQUMAQtBVCEFIAQoAgwiB0EGSw0AIAMgBEEQaiAEKAIIIAcQQSIFEAMNACAAIAEgBmogAiAGayADEDwhBQsgBEGQBGokACAFC4cBAgJ/An5BABAWIQMCQANAIAEgA08EQAJAIAAoAABBcHFB0NS0wgFGBEAgACABECIiAhADRQ0BQn4PCyAAIAEQVSIEQn1WDQMgBCAFfCIFIARUIQJCfiEEIAINAyAAIAEQUiICEAMNAwsgASACayEBIAAgAmohAAwBCwtCfiAFIAEbIQQLIAQLPwIBfwF+IwBBMGsiAiQAAn5CfiACQQhqIAAgARAtDQAaQgAgAigCHEEBRg0AGiACKQMICyEDIAJBMGokACADC40BAQJ/IwBBMGsiASQAAkAgAEUNACAAKAKI4gENACABIABB/OEBaigCADYCKCABIAApAvThATcDICAAEDAgACgCqOIBIQIgASABKAIoNgIYIAEgASkDIDcDECACIAFBEGoQGyAAQQA2AqjiASABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALKgECfyMAQRBrIgAkACAAQQA2AgggAEIANwMAIAAQWCEBIABBEGokACABC4cBAQN/IwBBEGsiAiQAAkAgACgCAEUgACgCBEVzDQAgAiAAKAIINgIIIAIgACkCADcDAAJ/IAIoAgAiAQRAIAIoAghBqOMJIAERBQAMAQtBqOMJECgLIgFFDQAgASAAKQIANwL04QEgAUH84QFqIAAoAgg2AgAgARBZIAEhAwsgAkEQaiQAIAMLywEBAn8jAEEgayIBJAAgAEGBgIDAADYCtOIBIABBADYCiOIBIABBADYC7OEBIABCADcDkOIBIABBADYCpOMJIABBADYC3OIBIABCADcCzOIBIABBADYCvOIBIABBADYCxOABIABCADcCnOIBIABBpOIBakIANwIAIABBrOIBakEANgIAIAFCADcCECABQgA3AhggASABKQMYNwMIIAEgASkDEDcDACABKAIIQQh2QQFxIQIgAEEANgLg4gEgACACNgKM4gEgAUEgaiQAC3YBA38jAEEwayIBJAAgAARAIAEgAEHE0AFqIgIoAgA2AiggASAAKQK80AE3AyAgACgCACEDIAEgAigCADYCGCABIAApArzQATcDECADIAFBEGoQGyABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALzAEBAX8gACABKAK00AE2ApjiASAAIAEoAgQiAjYCwOABIAAgAjYCvOABIAAgAiABKAIIaiICNgK44AEgACACNgLE4AEgASgCuNABBEAgAEKBgICAEDcDiOEBIAAgAUGk0ABqNgIMIAAgAUGUIGo2AgggACABQZwwajYCBCAAIAFBDGo2AgAgAEGs0AFqIAFBqNABaigCADYCACAAQbDQAWogAUGs0AFqKAIANgIAIABBtNABaiABQbDQAWooAgA2AgAPCyAAQgA3A4jhAQs7ACACRQRAQbp/DwsgBEUEQEFsDwsgAiAEEGAEQCAAIAEgAiADIAQgBRBhDwsgACABIAIgAyAEIAUQZQtGAQF/IwBBEGsiBSQAIAVBCGogBBAOAn8gBS0ACQRAIAAgASACIAMgBBAyDAELIAAgASACIAMgBBA0CyEAIAVBEGokACAACzQAIAAgAyAEIAUQNiIFEAMEQCAFDwsgBSAESQR/IAEgAiADIAVqIAQgBWsgABA1BUG4fwsLRgEBfyMAQRBrIgUkACAFQQhqIAQQDgJ/IAUtAAkEQCAAIAEgAiADIAQQYgwBCyAAIAEgAiADIAQQNQshACAFQRBqJAAgAAtZAQF/QQ8hAiABIABJBEAgAUEE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';

let workerPool;
// Constants
const BasisFormat = {
    ETC1S: 0,
    UASTC_4x4: 1
};
const TranscoderFormat = {
    ETC1: 0,
    ETC2: 1,
    BC1: 2,
    BC3: 3,
    BC4: 4,
    BC5: 5,
    BC7_M6_OPAQUE_ONLY: 6,
    BC7_M5: 7,
    PVRTC1_4_RGB: 8,
    PVRTC1_4_RGBA: 9,
    ASTC_4x4: 10,
    ATC_RGB: 11,
    ATC_RGBA_INTERPOLATED_ALPHA: 12,
    RGBA32: 13,
    RGB565: 14,
    BGR565: 15,
    RGBA4444: 16
};
const InternalFormat = {
    // RGBAFormat: 1023,
    RGBAFormat: 6408,
    RGBA_ASTC_4x4_Format: 37808,
    RGBA_BPTC_Format: 36492,
    RGBA_ETC2_EAC_Format: 37496,
    RGBA_PVRTC_4BPPV1_Format: 35842,
    RGBA_S3TC_DXT5_Format: 33779,
    RGB_ETC1_Format: 36196,
    RGB_ETC2_Format: 37492,
    RGB_PVRTC_4BPPV1_Format: 35840,
    RGB_S3TC_DXT1_Format: 33776
};
// Decoder API
let transcoderPending;
const getWorkerStringUrl = (transcoder, worker)=>{
    const str = `const _InternalFormat = ${JSON.stringify(InternalFormat)}
const _TranscoderFormat = ${JSON.stringify(TranscoderFormat)}
const _BasisFormat = ${JSON.stringify(BasisFormat)}
${transcoder}
${worker}
BasisWorker(_InternalFormat, _TranscoderFormat, _BasisFormat)
`;
    return URL.createObjectURL(new Blob([
        str
    ]));
};
const getTranscoder = async (transcoderPath)=>transcoderPending || Promise.all([
        getWorkerStringUrl(await (await fetch(`${transcoderPath}basis_transcoder.js`)).text(), await (await (await fetch(`${transcoderPath}basis-worker.js`)).text()).replace("module.exports = BasisWorker", "")),
        await (await fetch(`${transcoderPath}basis_transcoder.wasm`)).arrayBuffer()
    ]);
// Texture creation
const loadCompressedTexture = async (buffers, taskConfig = {})=>{
    // eslint-disable-next-line no-unused-vars
    const { globalData, levels, ...taskConfigForCache } = taskConfig;
    const taskKey = JSON.stringify(taskConfigForCache);
    const cachedTask = workerPool.hasTask(taskKey, buffers[0]);
    if (cachedTask) return cachedTask;
    let worker;
    let taskId;
    let taskCost = 0;
    for(let i = 0; i < buffers.length; i++){
        taskCost += buffers[i].byteLength;
    }
    const texturePending = workerPool.getWorker(transcoderPending, taskCost).then((workerData)=>{
        ({ worker, taskId } = workerData);
        return new Promise((resolve, reject)=>{
            worker._callbacks[taskId] = {
                resolve,
                reject
            };
            worker.postMessage({
                type: "decode",
                id: taskId,
                taskConfig,
                buffers
            }, buffers);
        });
    }).then((message)=>{
        // eslint-disable-next-line no-unused-vars
        const { type, id, hasAlpha, ...texture } = message;
        return {
            compressed: texture.internalFormat !== InternalFormat.RGBAFormat,
            ...texture
        };
    });
    // Remove task from the task list.
    texturePending.catch(()=>true).then(()=>{
        if (worker && taskId) {
            workerPool.releaseTask(worker, taskId);
        }
    });
    workerPool.taskCache.set(buffers[0], {
        key: taskKey,
        promise: texturePending
    });
    return texturePending;
};
/**
 * @typedef BasisOptions
 * @property {WebGLRenderingContext | WebGL2RenderingContext} gl
 * @property {string} [transcoderPath='assets/decoders/basis/']
 * @property {object} [transcodeConfig={}]
 * @property {number} [workerLimit=4]
 * @property {object} [workerConfig={ astcSupported, etc1Supported, etc2Supported, dxtSupported, bptcSupported, pvrtcSupported }]
 */ /**
 * Load a basis file or array buffer as texture options
 * @alias module:pex-loaders.loadBasis
 * @param {string | ArrayBuffer} data
 * @param {BasisOptions} [options]
 * @returns {Promise<object>}
 */ async function loadBasis(data, { gl, transcoderPath = "assets/decoders/basis/", transcodeConfig = {}, workerLimit, workerConfig = {
    astcSupported: !!gl.getExtension("WEBGL_compressed_texture_astc"),
    etc1Supported: !!gl.getExtension("WEBGL_compressed_texture_etc1"),
    etc2Supported: !!gl.getExtension("WEBGL_compressed_texture_etc"),
    dxtSupported: !!gl.getExtension("WEBGL_compressed_texture_s3tc"),
    bptcSupported: !!gl.getExtension("EXT_texture_compression_bptc"),
    pvrtcSupported: !!gl.getExtension("WEBGL_compressed_texture_pvrtc") || !!gl.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc")
} } = {}) {
    if (!workerPool) workerPool = new WorkerPool(workerLimit, workerConfig);
    transcoderPending = getTranscoder(transcoderPath);
    const hasManyBuffers = Array.isArray(data);
    const buffers = hasManyBuffers ? data : data instanceof ArrayBuffer ? [
        data
    ] : [
        await loadArrayBuffer(data)
    ];
    return await loadCompressedTexture(buffers, transcodeConfig);
}

let zstd;
let zstdPending;
const KTX2ChannelETC1S = {
    AAA: 15
};
const KTX2ChannelUASTC = {
    RGBA: 3};
const getAlpha = ({ colorModel, samples })=>{
    if (colorModel === KHR_DF_MODEL_UASTC) {
        if ((samples[0].channelType & 0xf) === KTX2ChannelUASTC.RGBA) {
            return true;
        }
        return false;
    }
    if (samples.length === 2 && (samples[1].channelType & 0xf) === KTX2ChannelETC1S.AAA) {
        return true;
    }
    return false;
};
/**
 * @typedef Ktx2Options
 * @property {import("./basis.js").BasisOptions} [basisOptions={}]
 */ /**
 * Load a ktx2 file or array buffer as texture options
 *
 * - KTX: http://github.khronos.org/KTX-Specification/
 * - DFD: https://www.khronos.org/registry/DataFormat/specs/1.3/dataformat.1.3.html#basicdescriptor
 * @alias module:pex-loaders.loadKtx2
 * @param {string | ArrayBuffer} data
 * @param {Ktx2Options} [options]
 * @returns {Promise<object>}
 */ async function loadKtx2(data, { basisOptions = {} } = {}) {
    const buffer = data instanceof ArrayBuffer ? data : await loadArrayBuffer(data);
    const ktx = read(new Uint8Array(buffer));
    if (ktx.pixelDepth > 0) {
        throw new Error("Only 2D textures are currently supported.");
    }
    if (ktx.layerCount > 1) {
        throw new Error("Array textures are not currently supported.");
    }
    if (ktx.faceCount > 1) {
        throw new Error("Cube textures are not currently supported.");
    }
    const isZstd = ktx.supercompressionScheme === KHR_SUPERCOMPRESSION_ZSTD;
    if (isZstd && !zstd) {
        zstd = new ZSTDDecoder();
        zstdPending = zstd.init();
    }
    await zstdPending;
    // Get levels
    const levels = [];
    const width = ktx.pixelWidth;
    const height = ktx.pixelHeight;
    for(let levelIndex = 0; levelIndex < ktx.levels.length; levelIndex++){
        const levelWidth = Math.max(1, Math.floor(width / 2 ** levelIndex));
        const levelHeight = Math.max(1, Math.floor(height / 2 ** levelIndex));
        let levelData = ktx.levels[levelIndex].levelData;
        if (isZstd) {
            levelData = zstd.decode(levelData, ktx.levels[levelIndex].uncompressedByteLength);
        }
        levels.push({
            index: levelIndex,
            width: levelWidth,
            height: levelHeight,
            data: levelData
        });
    }
    // Basic Data Format Descriptor Block is always the first DFD.
    const dfd = ktx.dataFormatDescriptor[0];
    // Parse basis
    const basisFormat = dfd.colorModel === KHR_DF_MODEL_UASTC ? BasisFormat.UASTC_4x4 : BasisFormat.ETC1S;
    const parseConfig = {
        levels,
        width: ktx.pixelWidth,
        height: ktx.pixelHeight,
        basisFormat,
        hasAlpha: getAlpha(dfd),
        lowLevel: true
    };
    if (basisFormat === BasisFormat.ETC1S) {
        parseConfig.globalData = ktx.globalData;
    }
    return(// Load regular basis
    loadBasis(Array.from(levels.reduce((buffers, level)=>{
        buffers.add(level.data.buffer);
        return buffers;
    }, new Set())), {
        ...basisOptions,
        transcodeConfig: parseConfig
    })// Add extra ktx props
    .then((texture)=>({
            ...texture,
            // srgb or linear
            encoding: dfd.transferFunction === KHR_DF_TRANSFER_SRGB ? 3 : 1,
            premultiplyAlpha: !!(dfd.flags & KHR_DF_FLAG_ALPHA_PREMULTIPLIED)
        })));
}

// https://github.com/hsnilsson/MPFExtractor
const extractMPF = async (imageArrayBuffer, { extractNonFII = true, extractFII = true } = {})=>{
    const imgs = [];
    const dataView = new DataView(imageArrayBuffer.buffer);
    // If you're executing this line on a big endian machine, it'll be reversed.
    // bigEnd further down though, refers to the endianness of the image itself.
    if (dataView.getUint16(0) !== 0xffd8) throw new Error("Not a valid jpeg");
    const length = dataView.byteLength;
    let offset = 2;
    let loops = 0;
    let marker; // APP# marker
    while(offset < length){
        if (++loops > 250) {
            throw new Error(`Found no marker after ${loops} loops 😵`);
        }
        if (dataView.getUint8(offset) !== 0xff) {
            throw new Error(`Not a valid marker at offset 0x${offset.toString(16)}, found: 0x${dataView.getUint8(offset).toString(16)}`);
        }
        marker = dataView.getUint8(offset + 1);
        if (marker === 0xe2) {
            // Works for iPhone 8 Plus, X, and XSMax. Or any photos of MPF format.
            // Great way to visualize image information in html is using Exiftool. E.g.:
            // ./exiftool.exe -htmldump -wantTrailer photo.jpg > photo.html
            const formatPt = offset + 4;
            /*
       *  Structure of the MP Format Identifier
       *
       *  Offset Addr.  | Code (Hex)  | Description
       *  +00             ff            Marker Prefix      <-- offset
       *  +01             e2            APP2
       *  +02             #n            APP2 Field Length
       *  +03             #n            APP2 Field Length
       *  +04             4d            'M'                <-- formatPt
       *  +05             50            'P'
       *  +06             46            'F'
       *  +07             00            NULL
       *                                                   <-- tiffOffset
       */ if (dataView.getUint32(formatPt) === 0x4d504600) {
                // Found MPF tag, so we start dig out sub images
                const tiffOffset = formatPt + 4;
                let bigEnd; // Endianness from TIFF header
                // Test for TIFF validity and endianness
                // 0x4949 and 0x4D4D ('II' and 'MM') marks Little Endian and Big Endian
                if (dataView.getUint16(tiffOffset) === 0x4949) {
                    bigEnd = false;
                } else if (dataView.getUint16(tiffOffset) === 0x4d4d) {
                    bigEnd = true;
                } else {
                    throw new Error("No valid endianness marker found in TIFF header");
                }
                if (dataView.getUint16(tiffOffset + 2, !bigEnd) !== 0x002a) {
                    throw new Error("Not valid TIFF data! (no 0x002A marker)");
                }
                // 32 bit number stating the offset from the start of the 8 Byte MP Header
                // to MP Index IFD Least possible value is thus 8 (means 0 offset)
                const firstIFDOffset = dataView.getUint32(tiffOffset + 4, !bigEnd);
                if (firstIFDOffset < 0x00000008) {
                    throw new Error("Not valid TIFF data! (First offset less than 8)");
                }
                // Move ahead to MP Index IFD
                // Assume we're at the first IFD, so firstIFDOffset points to
                // MP Index IFD and not MP Attributes IFD. (If we try extract from a sub image,
                // we fail silently here due to this assumption)
                // Count (2 Byte) | MP Index Fields a.k.a. MP Entries (count * 12 Byte) | Offset of Next IFD (4 Byte)
                const dirStart = tiffOffset + firstIFDOffset; // Start of IFD (Image File Directory)
                const count = dataView.getUint16(dirStart, !bigEnd); // Count of MPEntries (2 Byte)
                // Extract info from MPEntries (starting after Count)
                const entriesStart = dirStart + 2;
                let numberOfImages = 0;
                for(let i = entriesStart; i < entriesStart + 12 * count; i += 12){
                    // Each entry is 12 Bytes long
                    // Check MP Index IFD tags, here we only take tag 0xb001 = Number of images
                    if (dataView.getUint16(i, !bigEnd) === 0xb001) {
                        // stored in Last 4 bytes of its 12 Byte entry.
                        numberOfImages = dataView.getUint32(i + 8, !bigEnd);
                    }
                }
                const nextIFDOffsetLen = 4; // 4 Byte offset field that appears after MP Index IFD tags
                const MPImageListValPt = dirStart + 2 + count * 12 + nextIFDOffsetLen;
                const images = [];
                for(let i = MPImageListValPt; i < MPImageListValPt + numberOfImages * 16; i += 16){
                    const image = {
                        MPType: dataView.getUint32(i, !bigEnd),
                        size: dataView.getUint32(i + 4, !bigEnd),
                        // This offset is specified relative to the address of the MP Endian
                        // field in the MP Header, unless the image is a First Individual Image,
                        // in which case the value of the offset shall be NULL (0x00000000).
                        dataOffset: dataView.getUint32(i + 8, !bigEnd),
                        dependantImages: dataView.getUint32(i + 12, !bigEnd),
                        start: -1,
                        end: -1,
                        isFII: false
                    };
                    if (!image.dataOffset) {
                        // dataOffset is 0x00000000 for First Individual Image
                        image.start = 0;
                        image.isFII = true;
                    } else {
                        image.start = tiffOffset + image.dataOffset;
                        image.isFII = false;
                    }
                    image.end = image.start + image.size;
                    images.push(image);
                }
                if (extractNonFII && images.length) {
                    const bufferBlob = new Blob([
                        dataView
                    ]);
                    for (const image of images){
                        if (image.isFII && !extractFII) continue; // Skip FII
                        const imageBlob = bufferBlob.slice(image.start, image.end + 1, "image/jpeg");
                        imgs.push(imageBlob);
                    }
                    break;
                }
            }
        }
        offset += 2 + dataView.getUint16(offset + 2);
    }
    return imgs;
};
// https://github.com/MONOGRID/gainmap-js/blob/c82cc167d369b1fc7ec6cf4e30a7e110cf41ce6c/src/decode/utils/extractXMP.ts
const getAttribute = (description, name, defaultValue)=>{
    let returnValue;
    const parsedValue = description.attributes.getNamedItem(name)?.nodeValue;
    if (!parsedValue) {
        const node = description.getElementsByTagName(name)[0];
        if (node) {
            const values = node.getElementsByTagName("rdf:li");
            if (values.length === 3) {
                returnValue = Array.from(values).map((v)=>v.innerHTML);
            } else {
                throw new Error(`Gainmap metadata contains an array of items for ${name} but its length is not 3`);
            }
        } else {
            if (defaultValue) return defaultValue;
            else throw new Error(`Can't find ${name} in gainmap metadata`);
        }
    } else {
        returnValue = parsedValue;
    }
    return returnValue;
};
const extractXMP = (input)=>{
    let str;
    // support node test environment
    if (typeof TextDecoder !== "undefined") str = new TextDecoder().decode(input);
    else str = input.toString();
    let start = str.indexOf("<x:xmpmeta");
    const parser = new DOMParser();
    while(start !== -1){
        const end = str.indexOf("x:xmpmeta>", start);
        str.slice(start, end + 10);
        const xmpBlock = str.slice(start, end + 10);
        try {
            const xmlDocument = parser.parseFromString(xmpBlock, "text/xml");
            const description = xmlDocument.getElementsByTagName("rdf:Description")[0];
            const gainMapMin = getAttribute(description, "hdrgm:GainMapMin", "0");
            const gainMapMax = getAttribute(description, "hdrgm:GainMapMax");
            const gamma = getAttribute(description, "hdrgm:Gamma", "1");
            const offsetSDR = getAttribute(description, "hdrgm:OffsetSDR", "0.015625");
            const offsetHDR = getAttribute(description, "hdrgm:OffsetHDR", "0.015625");
            let hdrCapacityMin = description.attributes.getNamedItem("hdrgm:HDRCapacityMin")?.nodeValue;
            if (!hdrCapacityMin) hdrCapacityMin = "0";
            const hdrCapacityMax = description.attributes.getNamedItem("hdrgm:HDRCapacityMax")?.nodeValue;
            if (!hdrCapacityMax) throw new Error("Incomplete gainmap metadata");
            // prettier-ignore
            return {
                gainMapMin: Array.isArray(gainMapMin) ? gainMapMin.map((v)=>parseFloat(v)) : [
                    parseFloat(gainMapMin),
                    parseFloat(gainMapMin),
                    parseFloat(gainMapMin)
                ],
                gainMapMax: Array.isArray(gainMapMax) ? gainMapMax.map((v)=>parseFloat(v)) : [
                    parseFloat(gainMapMax),
                    parseFloat(gainMapMax),
                    parseFloat(gainMapMax)
                ],
                gamma: Array.isArray(gamma) ? gamma.map((v)=>parseFloat(v)) : [
                    parseFloat(gamma),
                    parseFloat(gamma),
                    parseFloat(gamma)
                ],
                offsetSdr: Array.isArray(offsetSDR) ? offsetSDR.map((v)=>parseFloat(v)) : [
                    parseFloat(offsetSDR),
                    parseFloat(offsetSDR),
                    parseFloat(offsetSDR)
                ],
                offsetHdr: Array.isArray(offsetHDR) ? offsetHDR.map((v)=>parseFloat(v)) : [
                    parseFloat(offsetHDR),
                    parseFloat(offsetHDR),
                    parseFloat(offsetHDR)
                ],
                hdrCapacityMin: parseFloat(hdrCapacityMin),
                hdrCapacityMax: parseFloat(hdrCapacityMax)
            };
        } catch (e) {}
        start = str.indexOf("<x:xmpmeta", end);
    }
};
/**
 * Load an Ultra HDR (aka gain map) file or array buffer as a texture
 * @alias module:pex-loaders.loadUltraHdr
 * @param {ctx} ctx
 * @param {string | ArrayBuffer} data
 * @param {ctx.texture2D} [texture] Optionally pass an already created texture resource.
 * @returns {Promise<ctx.texture2D>}
 */ async function loadUltraHdr(ctx, data, texture) {
    const jpegBuffer = new Uint8Array(data instanceof ArrayBuffer ? data : await loadArrayBuffer(data));
    // Decode the files into the textures
    const metadata = extractXMP(jpegBuffer);
    if (!metadata) throw new Error("Gain map XMP metadata not found");
    const images = await extractMPF(jpegBuffer);
    if (images.length !== 2) throw new Error("Gain map recovery image not found");
    const sdrBuffer = new Uint8Array(await images[0].arrayBuffer());
    const gainMapBuffer = new Uint8Array(await images[1].arrayBuffer());
    const blobOptions = {
        type: "image/jpeg"
    };
    const imageBitmapOptions = {
        imageOrientation: "flipY"
    };
    const [sdrImage, gainMapImage] = await Promise.all([
        createImageBitmap(new Blob([
            sdrBuffer
        ], blobOptions), imageBitmapOptions),
        gainMapBuffer ? createImageBitmap(new Blob([
            gainMapBuffer
        ], blobOptions), imageBitmapOptions) : Promise.resolve(new ImageData(2, 2))
    ]);
    const sdr = ctx.texture2D({
        data: sdrImage,
        pixelFormat: ctx.PixelFormat.SRGB8,
        encoding: ctx.Encoding.Linear,
        mag: ctx.Filter.Linear,
        min: ctx.Filter.Linear
    });
    const gainMap = ctx.texture2D({
        data: gainMapImage,
        width: gainMapImage.width,
        height: gainMapImage.height,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.Linear,
        mag: ctx.Filter.Linear,
        min: ctx.Filter.LinearMipmapLinear,
        mipmap: true
    });
    // Render
    texture ||= ctx.texture2D({
        pixelFormat: ctx.PixelFormat.RGBA16F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear
    });
    ctx.update(texture, {
        width: sdrImage.width,
        height: sdrImage.height
    });
    const maxDisplayBoost = clamp(Math.pow(2, metadata.hdrCapacityMax), 1, 65504);
    const weightFactor = clamp((Math.log2(maxDisplayBoost) - metadata.hdrCapacityMin) / (metadata.hdrCapacityMax - metadata.hdrCapacityMin), 0, 1);
    const cmd = {
        name: "drawGainMap",
        pass: ctx.pass({
            color: [
                texture
            ],
            clearColor: [
                0,
                0,
                0,
                1
            ]
        }),
        pipeline: ctx.pipeline({
            vert: blit.vert,
            frag: /* glsl */ `precision highp float;

#define HALF_FLOAT_MIN vec3(-65504, -65504, -65504)
#define HALF_FLOAT_MAX vec3(65504, 65504, 65504)

uniform sampler2D sdr;
uniform sampler2D gainMap;
uniform vec3 gamma;
uniform vec3 offsetHdr;
uniform vec3 offsetSdr;
uniform vec3 gainMapMin;
uniform vec3 gainMapMax;
uniform float weightFactor;

varying vec2 vTexCoord0;

void main() {
  vec3 rgb = texture2D(sdr, vTexCoord0).rgb;
  vec3 recovery = texture2D(gainMap, vTexCoord0).rgb;

  vec3 logRecovery = pow(recovery, gamma);
  vec3 logBoost = gainMapMin * (1.0 - logRecovery) + gainMapMax * logRecovery;
  vec3 hdrColor = (rgb + offsetSdr) * exp2(logBoost * weightFactor) - offsetHdr;
  vec3 clampedHdrColor = max(HALF_FLOAT_MIN, min(HALF_FLOAT_MAX, hdrColor));

  gl_FragColor = vec4(clampedHdrColor, 1.0);
}`,
            depthTest: false,
            depthWrite: false
        }),
        attributes: {
            aPosition: ctx.vertexBuffer(Float32Array.of(-1, -1, 3, -1, -1, 3))
        },
        count: 3,
        uniforms: {
            sdr,
            gainMap,
            gainMapMin: metadata.gainMapMin,
            gainMapMax: metadata.gainMapMax,
            offsetSdr: metadata.offsetSdr,
            offsetHdr: metadata.offsetHdr,
            gamma: metadata.gamma.map((c)=>1 / c),
            hdrCapacityMin: metadata.hdrCapacityMin,
            hdrCapacityMax: metadata.hdrCapacityMax,
            weightFactor
        }
    };
    ctx.submit(cmd);
    // Dispose
    ctx.dispose(sdr);
    ctx.dispose(gainMap);
    ctx.dispose(cmd.attributes.aPosition);
    ctx.dispose(cmd.pass);
    ctx.dispose(cmd.pipeline);
    sdrImage.close();
    gainMapImage.close();
    return texture;
}

//Code ported by Marcin Ignac (2014)
//Based on Java implementation from
//https://code.google.com/r/cys12345-research/source/browse/hdr/image_processor/RGBE.java?r=7d84e9fd866b24079dbe61fa0a966ce8365f5726
var radiancePattern = "#\\?RADIANCE";
var commentPattern = "#.*";
var exposurePattern = "EXPOSURE=\\s*([0-9]*[.][0-9]*)";
var formatPattern = "FORMAT=32-bit_rle_rgbe";
var widthHeightPattern = "-Y ([0-9]+) \\+X ([0-9]+)";
function readPixelsRawRLE(buffer, data, offset, fileOffset, scanline_width, num_scanlines) {
    var rgbe = new Array(4);
    var scanline_buffer = null;
    var ptr;
    var ptr_end;
    var count;
    var buf = new Array(2);
    var bufferLength = buffer.length;
    function readBuf(buf) {
        var bytesRead = 0;
        do {
            buf[bytesRead++] = buffer[fileOffset];
        }while (++fileOffset < bufferLength && bytesRead < buf.length);
        return bytesRead;
    }
    function readBufOffset(buf, offset, length) {
        var bytesRead = 0;
        do {
            buf[offset + bytesRead++] = buffer[fileOffset];
        }while (++fileOffset < bufferLength && bytesRead < length);
        return bytesRead;
    }
    function readPixelsRaw(buffer, data, offset, numpixels) {
        var numExpected = 4 * numpixels;
        var numRead = readBufOffset(data, offset, numExpected);
        if (numRead < numExpected) {
            throw new Error('Error reading raw pixels: got ' + numRead + ' bytes, expected ' + numExpected);
        }
    }
    while(num_scanlines > 0){
        if (readBuf(rgbe) < rgbe.length) {
            throw new Error("Error reading bytes: expected " + rgbe.length);
        }
        if (rgbe[0] != 2 || rgbe[1] != 2 || (rgbe[2] & 0x80) != 0) {
            //this file is not run length encoded
            data[offset++] = rgbe[0];
            data[offset++] = rgbe[1];
            data[offset++] = rgbe[2];
            data[offset++] = rgbe[3];
            readPixelsRaw(buffer, data, offset, scanline_width * num_scanlines - 1);
            return;
        }
        if (((rgbe[2] & 0xFF) << 8 | rgbe[3] & 0xFF) != scanline_width) {
            throw new Error("Wrong scanline width " + ((rgbe[2] & 0xFF) << 8 | rgbe[3] & 0xFF) + ", expected " + scanline_width);
        }
        if (scanline_buffer == null) {
            scanline_buffer = new Array(4 * scanline_width);
        }
        ptr = 0;
        /* read each of the four channels for the scanline into the buffer */ for(var i = 0; i < 4; i++){
            ptr_end = (i + 1) * scanline_width;
            while(ptr < ptr_end){
                if (readBuf(buf) < buf.length) {
                    throw new Error("Error reading 2-byte buffer");
                }
                if ((buf[0] & 0xFF) > 128) {
                    /* a run of the same value */ count = (buf[0] & 0xFF) - 128;
                    if (count == 0 || count > ptr_end - ptr) {
                        throw new Error("Bad scanline data");
                    }
                    while(count-- > 0)scanline_buffer[ptr++] = buf[1];
                } else {
                    /* a non-run */ count = buf[0] & 0xFF;
                    if (count == 0 || count > ptr_end - ptr) {
                        throw new Error("Bad scanline data");
                    }
                    scanline_buffer[ptr++] = buf[1];
                    if (--count > 0) {
                        if (readBufOffset(scanline_buffer, ptr, count) < count) {
                            throw new Error("Error reading non-run data");
                        }
                        ptr += count;
                    }
                }
            }
        }
        /* copy byte data to output */ for(var i = 0; i < scanline_width; i++){
            data[offset + 0] = scanline_buffer[i];
            data[offset + 1] = scanline_buffer[i + scanline_width];
            data[offset + 2] = scanline_buffer[i + 2 * scanline_width];
            data[offset + 3] = scanline_buffer[i + 3 * scanline_width];
            offset += 4;
        }
        num_scanlines--;
    }
}
//Returns data as floats and flipped along Y by default
function parseHdr(buffer) {
    if (buffer instanceof ArrayBuffer) {
        buffer = new Uint8Array(buffer);
    }
    var fileOffset = 0;
    var bufferLength = buffer.length;
    var NEW_LINE = 10;
    function readLine() {
        var buf = "";
        do {
            var b = buffer[fileOffset];
            if (b == NEW_LINE) {
                ++fileOffset;
                break;
            }
            buf += String.fromCharCode(b);
        }while (++fileOffset < bufferLength);
        return buf;
    }
    var width = 0;
    var height = 0;
    var exposure = 1;
    var gamma = 1;
    var rle = false;
    for(var i = 0; i < 20; i++){
        var line = readLine();
        var match;
        if (match = line.match(radiancePattern)) ; else if (match = line.match(formatPattern)) {
            rle = true;
        } else if (match = line.match(exposurePattern)) {
            exposure = Number(match[1]);
        } else if (match = line.match(commentPattern)) ; else if (match = line.match(widthHeightPattern)) {
            height = Number(match[1]);
            width = Number(match[2]);
            break;
        }
    }
    if (!rle) {
        throw new Error("File is not run length encoded!");
    }
    var data = new Uint8Array(width * height * 4);
    var scanline_width = width;
    var num_scanlines = height;
    readPixelsRawRLE(buffer, data, 0, fileOffset, scanline_width, num_scanlines);
    //TODO: Should be Float16
    var floatData = new Float32Array(width * height * 4);
    for(var offset = 0; offset < data.length; offset += 4){
        var r = data[offset + 0] / 255;
        var g = data[offset + 1] / 255;
        var b = data[offset + 2] / 255;
        var e = data[offset + 3];
        var f = Math.pow(2.0, e - 128.0);
        r *= f;
        g *= f;
        b *= f;
        var floatOffset = offset;
        floatData[floatOffset + 0] = r;
        floatData[floatOffset + 1] = g;
        floatData[floatOffset + 2] = b;
        floatData[floatOffset + 3] = 1.0;
    }
    return {
        shape: [
            width,
            height
        ],
        exposure: exposure,
        gamma: gamma,
        data: floatData
    };
}
var parseHdr_1 = parseHdr;
var parseHdr$1 = /*@__PURE__*/ getDefaultExportFromCjs(parseHdr_1);

/**
 * Load an HDR file or array buffer as a texture
 * @alias module:pex-loaders.loadHdr
 * @param {ctx} ctx
 * @param {string | ArrayBuffer} data
 * @param {ctx.texture2D} [texture] Optionally pass an already created texture resource.
 * @returns {Promise<ctx.texture2D>}
 */ async function loadHdr(ctx, data, texture) {
    const parsed = parseHdr$1(data instanceof ArrayBuffer ? data : await loadArrayBuffer(data));
    texture ||= ctx.texture2D({
        pixelFormat: ctx.PixelFormat.RGBA32F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
        flipY: true
    });
    ctx.update(texture, {
        data: parsed.data,
        width: parsed.shape[0],
        height: parsed.shape[1]
    });
    return texture;
}

// DEFLATE is a complex format; to read this code, you should probably check the RFC first:
// https://tools.ietf.org/html/rfc1951
// You may also wish to take a look at the guide I made about this program:
// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad
// Some of the following code is similar to that of UZIP.js:
// https://github.com/photopea/UZIP.js
// However, the vast majority of the codebase has diverged from UZIP.js to increase performance and reduce bundle size.
// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint
// is better for memory in most engines (I *think*).
// aliases for shorter compressed code (most minifers don't do this)
var u8 = Uint8Array, u16 = Uint16Array, i32 = Int32Array;
// fixed length extra bits
var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */ 0,
    0,
    /* impossible */ 0
]);
// fixed distance extra bits
var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */ 0,
    0
]);
// code length index map
var clim = new u8([
    16,
    17,
    18,
    0,
    8,
    7,
    9,
    6,
    10,
    5,
    11,
    4,
    12,
    3,
    13,
    2,
    14,
    1,
    15
]);
// get base, reverse index map from extra bits
var freb = function(eb, start) {
    var b = new u16(31);
    for(var i = 0; i < 31; ++i){
        b[i] = start += 1 << eb[i - 1];
    }
    // numbers here are at max 18 bits
    var r = new i32(b[30]);
    for(var i = 1; i < 30; ++i){
        for(var j = b[i]; j < b[i + 1]; ++j){
            r[j] = j - b[i] << 5 | i;
        }
    }
    return {
        b: b,
        r: r
    };
};
var _a = freb(fleb, 2), fl = _a.b, revfl = _a.r;
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0), fd = _b.b;
// map of value to reverse (assuming 16 bits)
var rev = new u16(32768);
for(var i = 0; i < 32768; ++i){
    // reverse table algorithm from SO
    var x = (i & 0xAAAA) >> 1 | (i & 0x5555) << 1;
    x = (x & 0xCCCC) >> 2 | (x & 0x3333) << 2;
    x = (x & 0xF0F0) >> 4 | (x & 0x0F0F) << 4;
    rev[i] = ((x & 0xFF00) >> 8 | (x & 0x00FF) << 8) >> 1;
}
// create huffman tree from u8 "map": index -> code length for code index
// mb (max bits) must be at most 15
// TODO: optimize/split up?
var hMap = function(cd, mb, r) {
    var s = cd.length;
    // index
    var i = 0;
    // u16 "map": index -> # of codes with bit length = index
    var l = new u16(mb);
    // length of cd must be 288 (total # of codes)
    for(; i < s; ++i){
        if (cd[i]) ++l[cd[i] - 1];
    }
    // u16 "map": index -> minimum code for bit length = index
    var le = new u16(mb);
    for(i = 1; i < mb; ++i){
        le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
        // u16 "map": index -> number of actual bits, symbol for code
        co = new u16(1 << mb);
        // bits to remove for reverser
        var rvb = 15 - mb;
        for(i = 0; i < s; ++i){
            // ignore 0 lengths
            if (cd[i]) {
                // num encoding both symbol and bits read
                var sv = i << 4 | cd[i];
                // free bits
                var r_1 = mb - cd[i];
                // start value
                var v = le[cd[i] - 1]++ << r_1;
                // m is end value
                for(var m = v | (1 << r_1) - 1; v <= m; ++v){
                    // every 16 bit value starting with the code yields the same result
                    co[rev[v] >> rvb] = sv;
                }
            }
        }
    } else {
        co = new u16(s);
        for(i = 0; i < s; ++i){
            if (cd[i]) {
                co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
            }
        }
    }
    return co;
};
// fixed length tree
var flt = new u8(288);
for(var i = 0; i < 144; ++i)flt[i] = 8;
for(var i = 144; i < 256; ++i)flt[i] = 9;
for(var i = 256; i < 280; ++i)flt[i] = 7;
for(var i = 280; i < 288; ++i)flt[i] = 8;
// fixed distance tree
var fdt = new u8(32);
for(var i = 0; i < 32; ++i)fdt[i] = 5;
// fixed length map
var flrm = /*#__PURE__*/ hMap(flt, 9, 1);
// fixed distance map
var fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
// find max of array
var max = function(a) {
    var m = a[0];
    for(var i = 1; i < a.length; ++i){
        if (a[i] > m) m = a[i];
    }
    return m;
};
// read d, starting at bit p and mask with m
var bits = function(d, p, m) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
// read d, starting at bit p continuing for at least 16 bits
var bits16 = function(d, p) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
// get end of byte
var shft = function(p) {
    return (p + 7) / 8 | 0;
};
// typed array slice - allows garbage collector to free original reference,
// while being more compatible than .slice
var slc = function(v, s, e) {
    if (e == null || e > v.length) e = v.length;
    // can't use .constructor in case user-supplied
    return new u8(v.subarray(s, e));
};
// error codes
var ec = [
    'unexpected EOF',
    'invalid block type',
    'invalid length/literal',
    'invalid distance',
    'stream finished',
    'no stream handler',
    ,
    'no callback',
    'invalid UTF-8 data',
    'extra field too long',
    'date not in range 1980-2099',
    'filename too long',
    'stream finishing',
    'invalid zip data'
];
var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace) Error.captureStackTrace(e, err);
    if (!nt) throw e;
    return e;
};
// expands raw DEFLATE data
var inflt = function(dat, st, buf, dict) {
    // source length       dict length
    var sl = dat.length, dl = 0;
    if (!sl || st.f && !st.l) return buf || new u8(0);
    var noBuf = !buf;
    // have to estimate size
    var resize = noBuf || st.i != 2;
    // no state
    var noSt = st.i;
    // Assumes roughly 33% compression ratio average
    if (noBuf) buf = new u8(sl * 3);
    // ensure buffer can fit at least l elements
    var cbuf = function(l) {
        var bl = buf.length;
        // need to increase size to fit
        if (l > bl) {
            // Double or set to necessary, whichever is greater
            var nbuf = new u8(Math.max(bl * 2, l));
            nbuf.set(buf);
            buf = nbuf;
        }
    };
    //  last chunk         bitpos           bytes
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    // total bits
    var tbts = sl * 8;
    do {
        if (!lm) {
            // BFINAL - this is only 1 when last chunk is next
            final = bits(dat, pos, 1);
            // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
            var type = bits(dat, pos + 1, 3);
            pos += 3;
            if (!type) {
                // go to end of byte boundary
                var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
                if (t > sl) {
                    if (noSt) err(0);
                    break;
                }
                // ensure size
                if (resize) cbuf(bt + l);
                // Copy over uncompressed data
                buf.set(dat.subarray(s, t), bt);
                // Get new bitpos, update byte count
                st.b = bt += l, st.p = pos = t * 8, st.f = final;
                continue;
            } else if (type == 1) lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
            else if (type == 2) {
                //  literal                            lengths
                var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
                var tl = hLit + bits(dat, pos + 5, 31) + 1;
                pos += 14;
                // length+distance tree
                var ldt = new u8(tl);
                // code length tree
                var clt = new u8(19);
                for(var i = 0; i < hcLen; ++i){
                    // use index map to get real code
                    clt[clim[i]] = bits(dat, pos + i * 3, 7);
                }
                pos += hcLen * 3;
                // code lengths bits
                var clb = max(clt), clbmsk = (1 << clb) - 1;
                // code lengths map
                var clm = hMap(clt, clb, 1);
                for(var i = 0; i < tl;){
                    var r = clm[bits(dat, pos, clbmsk)];
                    // bits read
                    pos += r & 15;
                    // symbol
                    var s = r >> 4;
                    // code length to copy
                    if (s < 16) {
                        ldt[i++] = s;
                    } else {
                        //  copy   count
                        var c = 0, n = 0;
                        if (s == 16) n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                        else if (s == 17) n = 3 + bits(dat, pos, 7), pos += 3;
                        else if (s == 18) n = 11 + bits(dat, pos, 127), pos += 7;
                        while(n--)ldt[i++] = c;
                    }
                }
                //    length tree                 distance tree
                var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
                // max length bits
                lbt = max(lt);
                // max dist bits
                dbt = max(dt);
                lm = hMap(lt, lbt, 1);
                dm = hMap(dt, dbt, 1);
            } else err(1);
            if (pos > tbts) {
                if (noSt) err(0);
                break;
            }
        }
        // Make sure the buffer can hold this + the largest possible addition
        // Maximum chunk size (practically, theoretically infinite) is 2^17
        if (resize) cbuf(bt + 131072);
        var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
        var lpos = pos;
        for(;; lpos = pos){
            // bits read, code
            var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
            pos += c & 15;
            if (pos > tbts) {
                if (noSt) err(0);
                break;
            }
            if (!c) err(2);
            if (sym < 256) buf[bt++] = sym;
            else if (sym == 256) {
                lpos = pos, lm = null;
                break;
            } else {
                var add = sym - 254;
                // no extra bits needed if less
                if (sym > 264) {
                    // index
                    var i = sym - 257, b = fleb[i];
                    add = bits(dat, pos, (1 << b) - 1) + fl[i];
                    pos += b;
                }
                // dist
                var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
                if (!d) err(3);
                pos += d & 15;
                var dt = fd[dsym];
                if (dsym > 3) {
                    var b = fdeb[dsym];
                    dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
                }
                if (pos > tbts) {
                    if (noSt) err(0);
                    break;
                }
                if (resize) cbuf(bt + 131072);
                var end = bt + add;
                if (bt < dt) {
                    var shift = dl - dt, dend = Math.min(dt, end);
                    if (shift + bt < 0) err(3);
                    for(; bt < dend; ++bt)buf[bt] = dict[shift + bt];
                }
                for(; bt < end; ++bt)buf[bt] = buf[bt - dt];
            }
        }
        st.l = lm, st.p = lpos, st.b = bt, st.f = final;
        if (lm) final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    }while (!final);
    // don't reallocate for streams or user buffers
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
// empty
var et = /*#__PURE__*/ new u8(0);
// zlib start
var zls = function(d, dict) {
    if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31) err(6, 'invalid zlib data');
    if ((d[1] >> 5 & 1) == 1) err(6, 'invalid zlib data: ' + (d[1] & 32 ? 'need' : 'unexpected') + ' dictionary');
    return (d[1] >> 3 & 4) + 2;
};
/**
 * Expands Zlib data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */ function unzlibSync(data, opts) {
    return inflt(data.subarray(zls(data), -4), {
        i: 2
    }, opts, opts);
}
// text decoder
var td = typeof TextDecoder != 'undefined' && /*#__PURE__*/ new TextDecoder();
// text decoder stream
var tds = 0;
try {
    td.decode(et, {
        stream: true
    });
    tds = 1;
} catch (e) {}

const FloatType = 1015;
const HalfFloatType = 1016;
const RGBAFormat = 1023;
const RedFormat = 1028;
const NoColorSpace = "";
const LinearSRGBColorSpace = "srgb-linear";
// Fast Half Float Conversions, http://www.fox-toolkit.org/ftp/fasthalffloatconversion.pdf
const _tables = /*@__PURE__*/ _generateTables();
function _generateTables() {
    // float32 to float16 helpers
    const buffer = new ArrayBuffer(4);
    const floatView = new Float32Array(buffer);
    const uint32View = new Uint32Array(buffer);
    const baseTable = new Uint32Array(512);
    const shiftTable = new Uint32Array(512);
    for(let i = 0; i < 256; ++i){
        const e = i - 127;
        // very small number (0, -0)
        if (e < -27) {
            baseTable[i] = 0x0000;
            baseTable[i | 0x100] = 0x8000;
            shiftTable[i] = 24;
            shiftTable[i | 0x100] = 24;
        // small number (denorm)
        } else if (e < -14) {
            baseTable[i] = 0x0400 >> -e - 14;
            baseTable[i | 0x100] = 0x0400 >> -e - 14 | 0x8000;
            shiftTable[i] = -e - 1;
            shiftTable[i | 0x100] = -e - 1;
        // normal number
        } else if (e <= 15) {
            baseTable[i] = e + 15 << 10;
            baseTable[i | 0x100] = e + 15 << 10 | 0x8000;
            shiftTable[i] = 13;
            shiftTable[i | 0x100] = 13;
        // large number (Infinity, -Infinity)
        } else if (e < 128) {
            baseTable[i] = 0x7c00;
            baseTable[i | 0x100] = 0xfc00;
            shiftTable[i] = 24;
            shiftTable[i | 0x100] = 24;
        // stay (NaN, Infinity, -Infinity)
        } else {
            baseTable[i] = 0x7c00;
            baseTable[i | 0x100] = 0xfc00;
            shiftTable[i] = 13;
            shiftTable[i | 0x100] = 13;
        }
    }
    // float16 to float32 helpers
    const mantissaTable = new Uint32Array(2048);
    const exponentTable = new Uint32Array(64);
    const offsetTable = new Uint32Array(64);
    for(let i = 1; i < 1024; ++i){
        let m = i << 13; // zero pad mantissa bits
        let e = 0; // zero exponent
        // normalized
        while((m & 0x00800000) === 0){
            m <<= 1;
            e -= 0x00800000; // decrement exponent
        }
        m &= -8388609; // clear leading 1 bit
        e += 0x38800000; // adjust bias
        mantissaTable[i] = m | e;
    }
    for(let i = 1024; i < 2048; ++i){
        mantissaTable[i] = 0x38000000 + (i - 1024 << 13);
    }
    for(let i = 1; i < 31; ++i){
        exponentTable[i] = i << 23;
    }
    exponentTable[31] = 0x47800000;
    exponentTable[32] = 0x80000000;
    for(let i = 33; i < 63; ++i){
        exponentTable[i] = 0x80000000 + (i - 32 << 23);
    }
    exponentTable[63] = 0xc7800000;
    for(let i = 1; i < 64; ++i){
        if (i !== 32) {
            offsetTable[i] = 1024;
        }
    }
    return {
        floatView: floatView,
        uint32View: uint32View,
        baseTable: baseTable,
        shiftTable: shiftTable,
        mantissaTable: mantissaTable,
        exponentTable: exponentTable,
        offsetTable: offsetTable
    };
}
const DataUtils = {
    toHalfFloat (val) {
        if (Math.abs(val) > 65504) console.warn("DataUtils.toHalfFloat(): Value out of range.");
        val = Math.max(-65504, Math.min(val, 65504));
        _tables.floatView[0] = val;
        const f = _tables.uint32View[0];
        const e = f >> 23 & 0x1ff;
        return _tables.baseTable[e] + ((f & 0x007fffff) >> _tables.shiftTable[e]);
    }
};
// /**
//  * OpenEXR loader currently supports uncompressed, ZIP(S), RLE, PIZ and DWA/B compression.
//  * Supports reading as UnsignedByte, HalfFloat and Float type data texture.
//  *
//  * Referred to the original Industrial Light & Magic OpenEXR implementation and the TinyEXR / Syoyo Fujita
//  * implementation, so I have preserved their copyright notices.
//  */
// /*
// Copyright (c) 2014 - 2017, Syoyo Fujita
// All rights reserved.
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Syoyo Fujita nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// */
// // TinyEXR contains some OpenEXR code, which is licensed under ------------
// ///////////////////////////////////////////////////////////////////////////
// //
// // Copyright (c) 2002, Industrial Light & Magic, a division of Lucas
// // Digital Ltd. LLC
// //
// // All rights reserved.
// //
// // Redistribution and use in source and binary forms, with or without
// // modification, are permitted provided that the following conditions are
// // met:
// // *       Redistributions of source code must retain the above copyright
// // notice, this list of conditions and the following disclaimer.
// // *       Redistributions in binary form must reproduce the above
// // copyright notice, this list of conditions and the following disclaimer
// // in the documentation and/or other materials provided with the
// // distribution.
// // *       Neither the name of Industrial Light & Magic nor the names of
// // its contributors may be used to endorse or promote products derived
// // from this software without specific prior written permission.
// //
// // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// // "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// // LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// // A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// // OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// // SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// // LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// // THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// // OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// //
// ///////////////////////////////////////////////////////////////////////////
// // End of OpenEXR license -------------------------------------------------
/**
 * @typedef EXRData
 * @property {object} header
 * @property {number} width
 * @property {number} height
 * @property {Uint16Array|Float32Array} data
 * @property {1023|1028} format RGBAFormat (1023) or RedFormat (1028)
 * @property {""|"srgb-linear"} colorSpace
 */ /**
 * Parse a buffer and return EXR data
 * @param {ArrayBuffer} buffer
 * @param {1015|1016} [type=1016] Float (1015) or Half Float (1016)
 * @returns {EXRData}
 */ function parseExr(buffer, type = HalfFloatType) {
    const USHORT_RANGE = 1 << 16;
    const BITMAP_SIZE = USHORT_RANGE >> 3;
    const HUF_ENCBITS = 16; // literal (value) bit length
    const HUF_DECBITS = 14; // decoding bit size (>= 8)
    const HUF_ENCSIZE = (1 << HUF_ENCBITS) + 1; // encoding table size
    const HUF_DECSIZE = 1 << HUF_DECBITS; // decoding table size
    const HUF_DECMASK = HUF_DECSIZE - 1;
    const NBITS = 16;
    const A_OFFSET = 1 << NBITS - 1;
    const MOD_MASK = (1 << NBITS) - 1;
    const SHORT_ZEROCODE_RUN = 59;
    const LONG_ZEROCODE_RUN = 63;
    const SHORTEST_LONG_RUN = 2 + LONG_ZEROCODE_RUN - SHORT_ZEROCODE_RUN;
    const ULONG_SIZE = 8;
    const FLOAT32_SIZE = 4;
    const INT32_SIZE = 4;
    const INT16_SIZE = 2;
    const INT8_SIZE = 1;
    const STATIC_HUFFMAN = 0;
    const DEFLATE = 1;
    const UNKNOWN = 0;
    const LOSSY_DCT = 1;
    const RLE = 2;
    const logBase = Math.pow(2.7182818, 2.2);
    function reverseLutFromBitmap(bitmap, lut) {
        let k = 0;
        for(let i = 0; i < USHORT_RANGE; ++i){
            if (i == 0 || bitmap[i >> 3] & 1 << (i & 7)) {
                lut[k++] = i;
            }
        }
        const n = k - 1;
        while(k < USHORT_RANGE)lut[k++] = 0;
        return n;
    }
    function hufClearDecTable(hdec) {
        for(let i = 0; i < HUF_DECSIZE; i++){
            hdec[i] = {};
            hdec[i].len = 0;
            hdec[i].lit = 0;
            hdec[i].p = null;
        }
    }
    const getBitsReturn = {
        l: 0,
        c: 0,
        lc: 0
    };
    function getBits(nBits, c, lc, uInt8Array, inOffset) {
        while(lc < nBits){
            c = c << 8 | parseUint8Array(uInt8Array, inOffset);
            lc += 8;
        }
        lc -= nBits;
        getBitsReturn.l = c >> lc & (1 << nBits) - 1;
        getBitsReturn.c = c;
        getBitsReturn.lc = lc;
    }
    const hufTableBuffer = new Array(59);
    function hufCanonicalCodeTable(hcode) {
        for(let i = 0; i <= 58; ++i)hufTableBuffer[i] = 0;
        for(let i = 0; i < HUF_ENCSIZE; ++i)hufTableBuffer[hcode[i]] += 1;
        let c = 0;
        for(let i = 58; i > 0; --i){
            const nc = c + hufTableBuffer[i] >> 1;
            hufTableBuffer[i] = c;
            c = nc;
        }
        for(let i = 0; i < HUF_ENCSIZE; ++i){
            const l = hcode[i];
            if (l > 0) hcode[i] = l | hufTableBuffer[l]++ << 6;
        }
    }
    function hufUnpackEncTable(uInt8Array, inOffset, ni, im, iM, hcode) {
        const p = inOffset;
        let c = 0;
        let lc = 0;
        for(; im <= iM; im++){
            if (p.value - inOffset.value > ni) return false;
            getBits(6, c, lc, uInt8Array, p);
            const l = getBitsReturn.l;
            c = getBitsReturn.c;
            lc = getBitsReturn.lc;
            hcode[im] = l;
            if (l == LONG_ZEROCODE_RUN) {
                if (p.value - inOffset.value > ni) {
                    throw new Error("Something wrong with hufUnpackEncTable");
                }
                getBits(8, c, lc, uInt8Array, p);
                let zerun = getBitsReturn.l + SHORTEST_LONG_RUN;
                c = getBitsReturn.c;
                lc = getBitsReturn.lc;
                if (im + zerun > iM + 1) {
                    throw new Error("Something wrong with hufUnpackEncTable");
                }
                while(zerun--)hcode[im++] = 0;
                im--;
            } else if (l >= SHORT_ZEROCODE_RUN) {
                let zerun = l - SHORT_ZEROCODE_RUN + 2;
                if (im + zerun > iM + 1) {
                    throw new Error("Something wrong with hufUnpackEncTable");
                }
                while(zerun--)hcode[im++] = 0;
                im--;
            }
        }
        hufCanonicalCodeTable(hcode);
    }
    function hufLength(code) {
        return code & 63;
    }
    function hufCode(code) {
        return code >> 6;
    }
    function hufBuildDecTable(hcode, im, iM, hdecod) {
        for(; im <= iM; im++){
            const c = hufCode(hcode[im]);
            const l = hufLength(hcode[im]);
            if (c >> l) {
                throw new Error("Invalid table entry");
            }
            if (l > HUF_DECBITS) {
                const pl = hdecod[c >> l - HUF_DECBITS];
                if (pl.len) {
                    throw new Error("Invalid table entry");
                }
                pl.lit++;
                if (pl.p) {
                    const p = pl.p;
                    pl.p = new Array(pl.lit);
                    for(let i = 0; i < pl.lit - 1; ++i){
                        pl.p[i] = p[i];
                    }
                } else {
                    pl.p = new Array(1);
                }
                pl.p[pl.lit - 1] = im;
            } else if (l) {
                let plOffset = 0;
                for(let i = 1 << HUF_DECBITS - l; i > 0; i--){
                    const pl = hdecod[(c << HUF_DECBITS - l) + plOffset];
                    if (pl.len || pl.p) {
                        throw new Error("Invalid table entry");
                    }
                    pl.len = l;
                    pl.lit = im;
                    plOffset++;
                }
            }
        }
        return true;
    }
    const getCharReturn = {
        c: 0,
        lc: 0
    };
    function getChar(c, lc, uInt8Array, inOffset) {
        c = c << 8 | parseUint8Array(uInt8Array, inOffset);
        lc += 8;
        getCharReturn.c = c;
        getCharReturn.lc = lc;
    }
    const getCodeReturn = {
        c: 0,
        lc: 0
    };
    function getCode(po, rlc, c, lc, uInt8Array, inOffset, outBuffer, outBufferOffset, outBufferEndOffset) {
        if (po == rlc) {
            if (lc < 8) {
                getChar(c, lc, uInt8Array, inOffset);
                c = getCharReturn.c;
                lc = getCharReturn.lc;
            }
            lc -= 8;
            let cs = c >> lc;
            cs = new Uint8Array([
                cs
            ])[0];
            if (outBufferOffset.value + cs > outBufferEndOffset) {
                return false;
            }
            const s = outBuffer[outBufferOffset.value - 1];
            while(cs-- > 0){
                outBuffer[outBufferOffset.value++] = s;
            }
        } else if (outBufferOffset.value < outBufferEndOffset) {
            outBuffer[outBufferOffset.value++] = po;
        } else {
            return false;
        }
        getCodeReturn.c = c;
        getCodeReturn.lc = lc;
    }
    function UInt16(value) {
        return value & 0xffff;
    }
    function Int16(value) {
        const ref = UInt16(value);
        return ref > 0x7fff ? ref - 0x10000 : ref;
    }
    const wdec14Return = {
        a: 0,
        b: 0
    };
    function wdec14(l, h) {
        const ls = Int16(l);
        const hs = Int16(h);
        const hi = hs;
        const ai = ls + (hi & 1) + (hi >> 1);
        const as = ai;
        const bs = ai - hi;
        wdec14Return.a = as;
        wdec14Return.b = bs;
    }
    function wdec16(l, h) {
        const m = UInt16(l);
        const d = UInt16(h);
        const bb = m - (d >> 1) & MOD_MASK;
        const aa = d + bb - A_OFFSET & MOD_MASK;
        wdec14Return.a = aa;
        wdec14Return.b = bb;
    }
    function wav2Decode(buffer, j, nx, ox, ny, oy, mx) {
        const w14 = mx < 1 << 14;
        const n = nx > ny ? ny : nx;
        let p = 1;
        let p2;
        let py;
        while(p <= n)p <<= 1;
        p >>= 1;
        p2 = p;
        p >>= 1;
        while(p >= 1){
            py = 0;
            const ey = py + oy * (ny - p2);
            const oy1 = oy * p;
            const oy2 = oy * p2;
            const ox1 = ox * p;
            const ox2 = ox * p2;
            let i00, i01, i10, i11;
            for(; py <= ey; py += oy2){
                let px = py;
                const ex = py + ox * (nx - p2);
                for(; px <= ex; px += ox2){
                    const p01 = px + ox1;
                    const p10 = px + oy1;
                    const p11 = p10 + ox1;
                    if (w14) {
                        wdec14(buffer[px + j], buffer[p10 + j]);
                        i00 = wdec14Return.a;
                        i10 = wdec14Return.b;
                        wdec14(buffer[p01 + j], buffer[p11 + j]);
                        i01 = wdec14Return.a;
                        i11 = wdec14Return.b;
                        wdec14(i00, i01);
                        buffer[px + j] = wdec14Return.a;
                        buffer[p01 + j] = wdec14Return.b;
                        wdec14(i10, i11);
                        buffer[p10 + j] = wdec14Return.a;
                        buffer[p11 + j] = wdec14Return.b;
                    } else {
                        wdec16(buffer[px + j], buffer[p10 + j]);
                        i00 = wdec14Return.a;
                        i10 = wdec14Return.b;
                        wdec16(buffer[p01 + j], buffer[p11 + j]);
                        i01 = wdec14Return.a;
                        i11 = wdec14Return.b;
                        wdec16(i00, i01);
                        buffer[px + j] = wdec14Return.a;
                        buffer[p01 + j] = wdec14Return.b;
                        wdec16(i10, i11);
                        buffer[p10 + j] = wdec14Return.a;
                        buffer[p11 + j] = wdec14Return.b;
                    }
                }
                if (nx & p) {
                    const p10 = px + oy1;
                    if (w14) wdec14(buffer[px + j], buffer[p10 + j]);
                    else wdec16(buffer[px + j], buffer[p10 + j]);
                    i00 = wdec14Return.a;
                    buffer[p10 + j] = wdec14Return.b;
                    buffer[px + j] = i00;
                }
            }
            if (ny & p) {
                let px = py;
                const ex = py + ox * (nx - p2);
                for(; px <= ex; px += ox2){
                    const p01 = px + ox1;
                    if (w14) wdec14(buffer[px + j], buffer[p01 + j]);
                    else wdec16(buffer[px + j], buffer[p01 + j]);
                    i00 = wdec14Return.a;
                    buffer[p01 + j] = wdec14Return.b;
                    buffer[px + j] = i00;
                }
            }
            p2 = p;
            p >>= 1;
        }
        return py;
    }
    function hufDecode(encodingTable, decodingTable, uInt8Array, inOffset, ni, rlc, no, outBuffer, outOffset) {
        let c = 0;
        let lc = 0;
        const outBufferEndOffset = no;
        const inOffsetEnd = Math.trunc(inOffset.value + (ni + 7) / 8);
        while(inOffset.value < inOffsetEnd){
            getChar(c, lc, uInt8Array, inOffset);
            c = getCharReturn.c;
            lc = getCharReturn.lc;
            while(lc >= HUF_DECBITS){
                const index = c >> lc - HUF_DECBITS & HUF_DECMASK;
                const pl = decodingTable[index];
                if (pl.len) {
                    lc -= pl.len;
                    getCode(pl.lit, rlc, c, lc, uInt8Array, inOffset, outBuffer, outOffset, outBufferEndOffset);
                    c = getCodeReturn.c;
                    lc = getCodeReturn.lc;
                } else {
                    if (!pl.p) {
                        throw new Error("hufDecode issues");
                    }
                    let j;
                    for(j = 0; j < pl.lit; j++){
                        const l = hufLength(encodingTable[pl.p[j]]);
                        while(lc < l && inOffset.value < inOffsetEnd){
                            getChar(c, lc, uInt8Array, inOffset);
                            c = getCharReturn.c;
                            lc = getCharReturn.lc;
                        }
                        if (lc >= l) {
                            if (hufCode(encodingTable[pl.p[j]]) == (c >> lc - l & (1 << l) - 1)) {
                                lc -= l;
                                getCode(pl.p[j], rlc, c, lc, uInt8Array, inOffset, outBuffer, outOffset, outBufferEndOffset);
                                c = getCodeReturn.c;
                                lc = getCodeReturn.lc;
                                break;
                            }
                        }
                    }
                    if (j == pl.lit) {
                        throw new Error("hufDecode issues");
                    }
                }
            }
        }
        const i = 8 - ni & 7;
        c >>= i;
        lc -= i;
        while(lc > 0){
            const pl = decodingTable[c << HUF_DECBITS - lc & HUF_DECMASK];
            if (pl.len) {
                lc -= pl.len;
                getCode(pl.lit, rlc, c, lc, uInt8Array, inOffset, outBuffer, outOffset, outBufferEndOffset);
                c = getCodeReturn.c;
                lc = getCodeReturn.lc;
            } else {
                throw new Error("hufDecode issues");
            }
        }
        return true;
    }
    function hufUncompress(uInt8Array, inDataView, inOffset, nCompressed, outBuffer, nRaw) {
        const outOffset = {
            value: 0
        };
        const initialInOffset = inOffset.value;
        const im = parseUint32(inDataView, inOffset);
        const iM = parseUint32(inDataView, inOffset);
        inOffset.value += 4;
        const nBits = parseUint32(inDataView, inOffset);
        inOffset.value += 4;
        if (im < 0 || im >= HUF_ENCSIZE || iM < 0 || iM >= HUF_ENCSIZE) {
            throw new Error("Something wrong with HUF_ENCSIZE");
        }
        const freq = new Array(HUF_ENCSIZE);
        const hdec = new Array(HUF_DECSIZE);
        hufClearDecTable(hdec);
        const ni = nCompressed - (inOffset.value - initialInOffset);
        hufUnpackEncTable(uInt8Array, inOffset, ni, im, iM, freq);
        if (nBits > 8 * (nCompressed - (inOffset.value - initialInOffset))) {
            throw new Error("Something wrong with hufUncompress");
        }
        hufBuildDecTable(freq, im, iM, hdec);
        hufDecode(freq, hdec, uInt8Array, inOffset, nBits, iM, nRaw, outBuffer, outOffset);
    }
    function applyLut(lut, data, nData) {
        for(let i = 0; i < nData; ++i){
            data[i] = lut[data[i]];
        }
    }
    function predictor(source) {
        for(let t = 1; t < source.length; t++){
            const d = source[t - 1] + source[t] - 128;
            source[t] = d;
        }
    }
    function interleaveScalar(source, out) {
        let t1 = 0;
        let t2 = Math.floor((source.length + 1) / 2);
        let s = 0;
        const stop = source.length - 1;
        while(true){
            if (s > stop) break;
            out[s++] = source[t1++];
            if (s > stop) break;
            out[s++] = source[t2++];
        }
    }
    function decodeRunLength(source) {
        let size = source.byteLength;
        const out = new Array();
        let p = 0;
        const reader = new DataView(source);
        while(size > 0){
            const l = reader.getInt8(p++);
            if (l < 0) {
                const count = -l;
                size -= count + 1;
                for(let i = 0; i < count; i++){
                    out.push(reader.getUint8(p++));
                }
            } else {
                const count = l;
                size -= 2;
                const value = reader.getUint8(p++);
                for(let i = 0; i < count + 1; i++){
                    out.push(value);
                }
            }
        }
        return out;
    }
    function lossyDctDecode(cscSet, rowPtrs, channelData, acBuffer, dcBuffer, outBuffer) {
        let dataView = new DataView(outBuffer.buffer);
        const width = channelData[cscSet.idx[0]].width;
        const height = channelData[cscSet.idx[0]].height;
        const numComp = 3;
        const numFullBlocksX = Math.floor(width / 8.0);
        const numBlocksX = Math.ceil(width / 8.0);
        const numBlocksY = Math.ceil(height / 8.0);
        const leftoverX = width - (numBlocksX - 1) * 8;
        const leftoverY = height - (numBlocksY - 1) * 8;
        const currAcComp = {
            value: 0
        };
        const currDcComp = new Array(numComp);
        const dctData = new Array(numComp);
        const halfZigBlock = new Array(numComp);
        const rowBlock = new Array(numComp);
        const rowOffsets = new Array(numComp);
        for(let comp = 0; comp < numComp; ++comp){
            rowOffsets[comp] = rowPtrs[cscSet.idx[comp]];
            currDcComp[comp] = comp < 1 ? 0 : currDcComp[comp - 1] + numBlocksX * numBlocksY;
            dctData[comp] = new Float32Array(64);
            halfZigBlock[comp] = new Uint16Array(64);
            rowBlock[comp] = new Uint16Array(numBlocksX * 64);
        }
        for(let blocky = 0; blocky < numBlocksY; ++blocky){
            let maxY = 8;
            if (blocky == numBlocksY - 1) maxY = leftoverY;
            let maxX = 8;
            for(let blockx = 0; blockx < numBlocksX; ++blockx){
                if (blockx == numBlocksX - 1) maxX = leftoverX;
                for(let comp = 0; comp < numComp; ++comp){
                    halfZigBlock[comp].fill(0);
                    // set block DC component
                    halfZigBlock[comp][0] = dcBuffer[currDcComp[comp]++];
                    // set block AC components
                    unRleAC(currAcComp, acBuffer, halfZigBlock[comp]);
                    // UnZigZag block to float
                    unZigZag(halfZigBlock[comp], dctData[comp]);
                    // decode float dct
                    dctInverse(dctData[comp]);
                }
                {
                    csc709Inverse(dctData);
                }
                for(let comp = 0; comp < numComp; ++comp){
                    convertToHalf(dctData[comp], rowBlock[comp], blockx * 64);
                }
            } // blockx
            let offset = 0;
            for(let comp = 0; comp < numComp; ++comp){
                const type = channelData[cscSet.idx[comp]].type;
                for(let y = 8 * blocky; y < 8 * blocky + maxY; ++y){
                    offset = rowOffsets[comp][y];
                    for(let blockx = 0; blockx < numFullBlocksX; ++blockx){
                        const src = blockx * 64 + (y & 0x7) * 8;
                        dataView.setUint16(offset + 0 * INT16_SIZE * type, rowBlock[comp][src + 0], true);
                        dataView.setUint16(offset + 1 * INT16_SIZE * type, rowBlock[comp][src + 1], true);
                        dataView.setUint16(offset + 2 * INT16_SIZE * type, rowBlock[comp][src + 2], true);
                        dataView.setUint16(offset + 3 * INT16_SIZE * type, rowBlock[comp][src + 3], true);
                        dataView.setUint16(offset + 4 * INT16_SIZE * type, rowBlock[comp][src + 4], true);
                        dataView.setUint16(offset + 5 * INT16_SIZE * type, rowBlock[comp][src + 5], true);
                        dataView.setUint16(offset + 6 * INT16_SIZE * type, rowBlock[comp][src + 6], true);
                        dataView.setUint16(offset + 7 * INT16_SIZE * type, rowBlock[comp][src + 7], true);
                        offset += 8 * INT16_SIZE * type;
                    }
                }
                // handle partial X blocks
                if (numFullBlocksX != numBlocksX) {
                    for(let y = 8 * blocky; y < 8 * blocky + maxY; ++y){
                        const offset = rowOffsets[comp][y] + 8 * numFullBlocksX * INT16_SIZE * type;
                        const src = numFullBlocksX * 64 + (y & 0x7) * 8;
                        for(let x = 0; x < maxX; ++x){
                            dataView.setUint16(offset + x * INT16_SIZE * type, rowBlock[comp][src + x], true);
                        }
                    }
                }
            } // comp
        } // blocky
        const halfRow = new Uint16Array(width);
        dataView = new DataView(outBuffer.buffer);
        // convert channels back to float, if needed
        for(let comp = 0; comp < numComp; ++comp){
            channelData[cscSet.idx[comp]].decoded = true;
            const type = channelData[cscSet.idx[comp]].type;
            if (channelData[comp].type != 2) continue;
            for(let y = 0; y < height; ++y){
                const offset = rowOffsets[comp][y];
                for(let x = 0; x < width; ++x){
                    halfRow[x] = dataView.getUint16(offset + x * INT16_SIZE * type, true);
                }
                for(let x = 0; x < width; ++x){
                    dataView.setFloat32(offset + x * INT16_SIZE * type, decodeFloat16(halfRow[x]), true);
                }
            }
        }
    }
    function unRleAC(currAcComp, acBuffer, halfZigBlock) {
        let acValue;
        let dctComp = 1;
        while(dctComp < 64){
            acValue = acBuffer[currAcComp.value];
            if (acValue == 0xff00) {
                dctComp = 64;
            } else if (acValue >> 8 == 0xff) {
                dctComp += acValue & 0xff;
            } else {
                halfZigBlock[dctComp] = acValue;
                dctComp++;
            }
            currAcComp.value++;
        }
    }
    function unZigZag(src, dst) {
        dst[0] = decodeFloat16(src[0]);
        dst[1] = decodeFloat16(src[1]);
        dst[2] = decodeFloat16(src[5]);
        dst[3] = decodeFloat16(src[6]);
        dst[4] = decodeFloat16(src[14]);
        dst[5] = decodeFloat16(src[15]);
        dst[6] = decodeFloat16(src[27]);
        dst[7] = decodeFloat16(src[28]);
        dst[8] = decodeFloat16(src[2]);
        dst[9] = decodeFloat16(src[4]);
        dst[10] = decodeFloat16(src[7]);
        dst[11] = decodeFloat16(src[13]);
        dst[12] = decodeFloat16(src[16]);
        dst[13] = decodeFloat16(src[26]);
        dst[14] = decodeFloat16(src[29]);
        dst[15] = decodeFloat16(src[42]);
        dst[16] = decodeFloat16(src[3]);
        dst[17] = decodeFloat16(src[8]);
        dst[18] = decodeFloat16(src[12]);
        dst[19] = decodeFloat16(src[17]);
        dst[20] = decodeFloat16(src[25]);
        dst[21] = decodeFloat16(src[30]);
        dst[22] = decodeFloat16(src[41]);
        dst[23] = decodeFloat16(src[43]);
        dst[24] = decodeFloat16(src[9]);
        dst[25] = decodeFloat16(src[11]);
        dst[26] = decodeFloat16(src[18]);
        dst[27] = decodeFloat16(src[24]);
        dst[28] = decodeFloat16(src[31]);
        dst[29] = decodeFloat16(src[40]);
        dst[30] = decodeFloat16(src[44]);
        dst[31] = decodeFloat16(src[53]);
        dst[32] = decodeFloat16(src[10]);
        dst[33] = decodeFloat16(src[19]);
        dst[34] = decodeFloat16(src[23]);
        dst[35] = decodeFloat16(src[32]);
        dst[36] = decodeFloat16(src[39]);
        dst[37] = decodeFloat16(src[45]);
        dst[38] = decodeFloat16(src[52]);
        dst[39] = decodeFloat16(src[54]);
        dst[40] = decodeFloat16(src[20]);
        dst[41] = decodeFloat16(src[22]);
        dst[42] = decodeFloat16(src[33]);
        dst[43] = decodeFloat16(src[38]);
        dst[44] = decodeFloat16(src[46]);
        dst[45] = decodeFloat16(src[51]);
        dst[46] = decodeFloat16(src[55]);
        dst[47] = decodeFloat16(src[60]);
        dst[48] = decodeFloat16(src[21]);
        dst[49] = decodeFloat16(src[34]);
        dst[50] = decodeFloat16(src[37]);
        dst[51] = decodeFloat16(src[47]);
        dst[52] = decodeFloat16(src[50]);
        dst[53] = decodeFloat16(src[56]);
        dst[54] = decodeFloat16(src[59]);
        dst[55] = decodeFloat16(src[61]);
        dst[56] = decodeFloat16(src[35]);
        dst[57] = decodeFloat16(src[36]);
        dst[58] = decodeFloat16(src[48]);
        dst[59] = decodeFloat16(src[49]);
        dst[60] = decodeFloat16(src[57]);
        dst[61] = decodeFloat16(src[58]);
        dst[62] = decodeFloat16(src[62]);
        dst[63] = decodeFloat16(src[63]);
    }
    function dctInverse(data) {
        const a = 0.5 * Math.cos(3.14159 / 4.0);
        const b = 0.5 * Math.cos(3.14159 / 16.0);
        const c = 0.5 * Math.cos(3.14159 / 8.0);
        const d = 0.5 * Math.cos(3.0 * 3.14159 / 16.0);
        const e = 0.5 * Math.cos(5.0 * 3.14159 / 16.0);
        const f = 0.5 * Math.cos(3.0 * 3.14159 / 8.0);
        const g = 0.5 * Math.cos(7.0 * 3.14159 / 16.0);
        const alpha = new Array(4);
        const beta = new Array(4);
        const theta = new Array(4);
        const gamma = new Array(4);
        for(let row = 0; row < 8; ++row){
            const rowPtr = row * 8;
            alpha[0] = c * data[rowPtr + 2];
            alpha[1] = f * data[rowPtr + 2];
            alpha[2] = c * data[rowPtr + 6];
            alpha[3] = f * data[rowPtr + 6];
            beta[0] = b * data[rowPtr + 1] + d * data[rowPtr + 3] + e * data[rowPtr + 5] + g * data[rowPtr + 7];
            beta[1] = d * data[rowPtr + 1] - g * data[rowPtr + 3] - b * data[rowPtr + 5] - e * data[rowPtr + 7];
            beta[2] = e * data[rowPtr + 1] - b * data[rowPtr + 3] + g * data[rowPtr + 5] + d * data[rowPtr + 7];
            beta[3] = g * data[rowPtr + 1] - e * data[rowPtr + 3] + d * data[rowPtr + 5] - b * data[rowPtr + 7];
            theta[0] = a * (data[rowPtr + 0] + data[rowPtr + 4]);
            theta[3] = a * (data[rowPtr + 0] - data[rowPtr + 4]);
            theta[1] = alpha[0] + alpha[3];
            theta[2] = alpha[1] - alpha[2];
            gamma[0] = theta[0] + theta[1];
            gamma[1] = theta[3] + theta[2];
            gamma[2] = theta[3] - theta[2];
            gamma[3] = theta[0] - theta[1];
            data[rowPtr + 0] = gamma[0] + beta[0];
            data[rowPtr + 1] = gamma[1] + beta[1];
            data[rowPtr + 2] = gamma[2] + beta[2];
            data[rowPtr + 3] = gamma[3] + beta[3];
            data[rowPtr + 4] = gamma[3] - beta[3];
            data[rowPtr + 5] = gamma[2] - beta[2];
            data[rowPtr + 6] = gamma[1] - beta[1];
            data[rowPtr + 7] = gamma[0] - beta[0];
        }
        for(let column = 0; column < 8; ++column){
            alpha[0] = c * data[16 + column];
            alpha[1] = f * data[16 + column];
            alpha[2] = c * data[48 + column];
            alpha[3] = f * data[48 + column];
            beta[0] = b * data[8 + column] + d * data[24 + column] + e * data[40 + column] + g * data[56 + column];
            beta[1] = d * data[8 + column] - g * data[24 + column] - b * data[40 + column] - e * data[56 + column];
            beta[2] = e * data[8 + column] - b * data[24 + column] + g * data[40 + column] + d * data[56 + column];
            beta[3] = g * data[8 + column] - e * data[24 + column] + d * data[40 + column] - b * data[56 + column];
            theta[0] = a * (data[column] + data[32 + column]);
            theta[3] = a * (data[column] - data[32 + column]);
            theta[1] = alpha[0] + alpha[3];
            theta[2] = alpha[1] - alpha[2];
            gamma[0] = theta[0] + theta[1];
            gamma[1] = theta[3] + theta[2];
            gamma[2] = theta[3] - theta[2];
            gamma[3] = theta[0] - theta[1];
            data[0 + column] = gamma[0] + beta[0];
            data[8 + column] = gamma[1] + beta[1];
            data[16 + column] = gamma[2] + beta[2];
            data[24 + column] = gamma[3] + beta[3];
            data[32 + column] = gamma[3] - beta[3];
            data[40 + column] = gamma[2] - beta[2];
            data[48 + column] = gamma[1] - beta[1];
            data[56 + column] = gamma[0] - beta[0];
        }
    }
    function csc709Inverse(data) {
        for(let i = 0; i < 64; ++i){
            const y = data[0][i];
            const cb = data[1][i];
            const cr = data[2][i];
            data[0][i] = y + 1.5747 * cr;
            data[1][i] = y - 0.1873 * cb - 0.4682 * cr;
            data[2][i] = y + 1.8556 * cb;
        }
    }
    function convertToHalf(src, dst, idx) {
        for(let i = 0; i < 64; ++i){
            dst[idx + i] = DataUtils.toHalfFloat(toLinear(src[i]));
        }
    }
    function toLinear(float) {
        if (float <= 1) {
            return Math.sign(float) * Math.pow(Math.abs(float), 2.2);
        } else {
            return Math.sign(float) * Math.pow(logBase, Math.abs(float) - 1.0);
        }
    }
    function uncompressRAW(info) {
        return new DataView(info.array.buffer, info.offset.value, info.size);
    }
    function uncompressRLE(info) {
        const compressed = info.viewer.buffer.slice(info.offset.value, info.offset.value + info.size);
        const rawBuffer = new Uint8Array(decodeRunLength(compressed));
        const tmpBuffer = new Uint8Array(rawBuffer.length);
        predictor(rawBuffer); // revert predictor
        interleaveScalar(rawBuffer, tmpBuffer); // interleave pixels
        return new DataView(tmpBuffer.buffer);
    }
    function uncompressZIP(info) {
        const compressed = info.array.slice(info.offset.value, info.offset.value + info.size);
        const rawBuffer = unzlibSync(compressed);
        const tmpBuffer = new Uint8Array(rawBuffer.length);
        predictor(rawBuffer); // revert predictor
        interleaveScalar(rawBuffer, tmpBuffer); // interleave pixels
        return new DataView(tmpBuffer.buffer);
    }
    function uncompressPIZ(info) {
        const inDataView = info.viewer;
        const inOffset = {
            value: info.offset.value
        };
        const outBuffer = new Uint16Array(info.columns * info.lines * (info.inputChannels.length * info.type));
        const bitmap = new Uint8Array(BITMAP_SIZE);
        // Setup channel info
        let outBufferEnd = 0;
        const pizChannelData = new Array(info.inputChannels.length);
        for(let i = 0, il = info.inputChannels.length; i < il; i++){
            pizChannelData[i] = {};
            pizChannelData[i]["start"] = outBufferEnd;
            pizChannelData[i]["end"] = pizChannelData[i]["start"];
            pizChannelData[i]["nx"] = info.columns;
            pizChannelData[i]["ny"] = info.lines;
            pizChannelData[i]["size"] = info.type;
            outBufferEnd += pizChannelData[i].nx * pizChannelData[i].ny * pizChannelData[i].size;
        }
        // Read range compression data
        const minNonZero = parseUint16(inDataView, inOffset);
        const maxNonZero = parseUint16(inDataView, inOffset);
        if (maxNonZero >= BITMAP_SIZE) {
            throw new Error("Something is wrong with PIZ_COMPRESSION BITMAP_SIZE");
        }
        if (minNonZero <= maxNonZero) {
            for(let i = 0; i < maxNonZero - minNonZero + 1; i++){
                bitmap[i + minNonZero] = parseUint8(inDataView, inOffset);
            }
        }
        // Reverse LUT
        const lut = new Uint16Array(USHORT_RANGE);
        const maxValue = reverseLutFromBitmap(bitmap, lut);
        const length = parseUint32(inDataView, inOffset);
        // Huffman decoding
        hufUncompress(info.array, inDataView, inOffset, length, outBuffer, outBufferEnd);
        // Wavelet decoding
        for(let i = 0; i < info.inputChannels.length; ++i){
            const cd = pizChannelData[i];
            for(let j = 0; j < pizChannelData[i].size; ++j){
                wav2Decode(outBuffer, cd.start + j, cd.nx, cd.size, cd.ny, cd.nx * cd.size, maxValue);
            }
        }
        // Expand the pixel data to their original range
        applyLut(lut, outBuffer, outBufferEnd);
        // Rearrange the pixel data into the format expected by the caller.
        let tmpOffset = 0;
        const tmpBuffer = new Uint8Array(outBuffer.buffer.byteLength);
        for(let y = 0; y < info.lines; y++){
            for(let c = 0; c < info.inputChannels.length; c++){
                const cd = pizChannelData[c];
                const n = cd.nx * cd.size;
                const cp = new Uint8Array(outBuffer.buffer, cd.end * INT16_SIZE, n * INT16_SIZE);
                tmpBuffer.set(cp, tmpOffset);
                tmpOffset += n * INT16_SIZE;
                cd.end += n;
            }
        }
        return new DataView(tmpBuffer.buffer);
    }
    function uncompressPXR(info) {
        const compressed = info.array.slice(info.offset.value, info.offset.value + info.size);
        const rawBuffer = unzlibSync(compressed);
        const byteSize = info.inputChannels.length * info.lines * info.columns * info.totalBytes;
        const tmpBuffer = new ArrayBuffer(byteSize);
        const viewer = new DataView(tmpBuffer);
        let tmpBufferEnd = 0;
        let writePtr = 0;
        const ptr = new Array(4);
        for(let y = 0; y < info.lines; y++){
            for(let c = 0; c < info.inputChannels.length; c++){
                let pixel = 0;
                const type = info.inputChannels[c].pixelType;
                switch(type){
                    case 1:
                        ptr[0] = tmpBufferEnd;
                        ptr[1] = ptr[0] + info.columns;
                        tmpBufferEnd = ptr[1] + info.columns;
                        for(let j = 0; j < info.columns; ++j){
                            const diff = rawBuffer[ptr[0]++] << 8 | rawBuffer[ptr[1]++];
                            pixel += diff;
                            viewer.setUint16(writePtr, pixel, true);
                            writePtr += 2;
                        }
                        break;
                    case 2:
                        ptr[0] = tmpBufferEnd;
                        ptr[1] = ptr[0] + info.columns;
                        ptr[2] = ptr[1] + info.columns;
                        tmpBufferEnd = ptr[2] + info.columns;
                        for(let j = 0; j < info.columns; ++j){
                            const diff = rawBuffer[ptr[0]++] << 24 | rawBuffer[ptr[1]++] << 16 | rawBuffer[ptr[2]++] << 8;
                            pixel += diff;
                            viewer.setUint32(writePtr, pixel, true);
                            writePtr += 4;
                        }
                        break;
                }
            }
        }
        return viewer;
    }
    function uncompressDWA(info) {
        const inDataView = info.viewer;
        const inOffset = {
            value: info.offset.value
        };
        const outBuffer = new Uint8Array(info.columns * info.lines * (info.inputChannels.length * info.type * INT16_SIZE));
        // Read compression header information
        const dwaHeader = {
            version: parseInt64(inDataView, inOffset),
            unknownUncompressedSize: parseInt64(inDataView, inOffset),
            unknownCompressedSize: parseInt64(inDataView, inOffset),
            acCompressedSize: parseInt64(inDataView, inOffset),
            dcCompressedSize: parseInt64(inDataView, inOffset),
            rleCompressedSize: parseInt64(inDataView, inOffset),
            rleUncompressedSize: parseInt64(inDataView, inOffset),
            rleRawSize: parseInt64(inDataView, inOffset),
            totalAcUncompressedCount: parseInt64(inDataView, inOffset),
            totalDcUncompressedCount: parseInt64(inDataView, inOffset),
            acCompression: parseInt64(inDataView, inOffset)
        };
        if (dwaHeader.version < 2) throw new Error("EXRLoader.parse: " + EXRHeader.compression + " version " + dwaHeader.version + " is unsupported");
        // Read channel ruleset information
        const channelRules = new Array();
        let ruleSize = parseUint16(inDataView, inOffset) - INT16_SIZE;
        while(ruleSize > 0){
            const name = parseNullTerminatedString(inDataView.buffer, inOffset);
            const value = parseUint8(inDataView, inOffset);
            const compression = value >> 2 & 3;
            const csc = (value >> 4) - 1;
            const index = new Int8Array([
                csc
            ])[0];
            const type = parseUint8(inDataView, inOffset);
            channelRules.push({
                name: name,
                index: index,
                type: type,
                compression: compression
            });
            ruleSize -= name.length + 3;
        }
        // Classify channels
        const channels = EXRHeader.channels;
        const channelData = new Array(info.inputChannels.length);
        for(let i = 0; i < info.inputChannels.length; ++i){
            const cd = channelData[i] = {};
            const channel = channels[i];
            cd.name = channel.name;
            cd.compression = UNKNOWN;
            cd.decoded = false;
            cd.type = channel.pixelType;
            cd.pLinear = channel.pLinear;
            cd.width = info.columns;
            cd.height = info.lines;
        }
        const cscSet = {
            idx: new Array(3)
        };
        for(let offset = 0; offset < info.inputChannels.length; ++offset){
            const cd = channelData[offset];
            for(let i = 0; i < channelRules.length; ++i){
                const rule = channelRules[i];
                if (cd.name == rule.name) {
                    cd.compression = rule.compression;
                    if (rule.index >= 0) {
                        cscSet.idx[rule.index] = offset;
                    }
                    cd.offset = offset;
                }
            }
        }
        let acBuffer, dcBuffer, rleBuffer;
        // Read DCT - AC component data
        if (dwaHeader.acCompressedSize > 0) {
            switch(dwaHeader.acCompression){
                case STATIC_HUFFMAN:
                    acBuffer = new Uint16Array(dwaHeader.totalAcUncompressedCount);
                    hufUncompress(info.array, inDataView, inOffset, dwaHeader.acCompressedSize, acBuffer, dwaHeader.totalAcUncompressedCount);
                    break;
                case DEFLATE:
                    const compressed = info.array.slice(inOffset.value, inOffset.value + dwaHeader.totalAcUncompressedCount);
                    const data = unzlibSync(compressed);
                    acBuffer = new Uint16Array(data.buffer);
                    inOffset.value += dwaHeader.totalAcUncompressedCount;
                    break;
            }
        }
        // Read DCT - DC component data
        if (dwaHeader.dcCompressedSize > 0) {
            const zlibInfo = {
                array: info.array,
                offset: inOffset,
                size: dwaHeader.dcCompressedSize
            };
            dcBuffer = new Uint16Array(uncompressZIP(zlibInfo).buffer);
            inOffset.value += dwaHeader.dcCompressedSize;
        }
        // Read RLE compressed data
        if (dwaHeader.rleRawSize > 0) {
            const compressed = info.array.slice(inOffset.value, inOffset.value + dwaHeader.rleCompressedSize);
            const data = unzlibSync(compressed);
            rleBuffer = decodeRunLength(data.buffer);
            inOffset.value += dwaHeader.rleCompressedSize;
        }
        // Prepare outbuffer data offset
        let outBufferEnd = 0;
        const rowOffsets = new Array(channelData.length);
        for(let i = 0; i < rowOffsets.length; ++i){
            rowOffsets[i] = new Array();
        }
        for(let y = 0; y < info.lines; ++y){
            for(let chan = 0; chan < channelData.length; ++chan){
                rowOffsets[chan].push(outBufferEnd);
                outBufferEnd += channelData[chan].width * info.type * INT16_SIZE;
            }
        }
        // Lossy DCT decode RGB channels
        lossyDctDecode(cscSet, rowOffsets, channelData, acBuffer, dcBuffer, outBuffer);
        // Decode other channels
        for(let i = 0; i < channelData.length; ++i){
            const cd = channelData[i];
            if (cd.decoded) continue;
            switch(cd.compression){
                case RLE:
                    let row = 0;
                    let rleOffset = 0;
                    for(let y = 0; y < info.lines; ++y){
                        let rowOffsetBytes = rowOffsets[i][row];
                        for(let x = 0; x < cd.width; ++x){
                            for(let byte = 0; byte < INT16_SIZE * cd.type; ++byte){
                                outBuffer[rowOffsetBytes++] = rleBuffer[rleOffset + byte * cd.width * cd.height];
                            }
                            rleOffset++;
                        }
                        row++;
                    }
                    break;
                case LOSSY_DCT:
                default:
                    throw new Error("EXRLoader.parse: unsupported channel compression");
            }
        }
        return new DataView(outBuffer.buffer);
    }
    function parseNullTerminatedString(buffer, offset) {
        const uintBuffer = new Uint8Array(buffer);
        let endOffset = 0;
        while(uintBuffer[offset.value + endOffset] != 0){
            endOffset += 1;
        }
        const stringValue = new TextDecoder().decode(uintBuffer.slice(offset.value, offset.value + endOffset));
        offset.value = offset.value + endOffset + 1;
        return stringValue;
    }
    function parseFixedLengthString(buffer, offset, size) {
        const stringValue = new TextDecoder().decode(new Uint8Array(buffer).slice(offset.value, offset.value + size));
        offset.value = offset.value + size;
        return stringValue;
    }
    function parseRational(dataView, offset) {
        const x = parseInt32(dataView, offset);
        const y = parseUint32(dataView, offset);
        return [
            x,
            y
        ];
    }
    function parseTimecode(dataView, offset) {
        const x = parseUint32(dataView, offset);
        const y = parseUint32(dataView, offset);
        return [
            x,
            y
        ];
    }
    function parseInt32(dataView, offset) {
        const Int32 = dataView.getInt32(offset.value, true);
        offset.value = offset.value + INT32_SIZE;
        return Int32;
    }
    function parseUint32(dataView, offset) {
        const Uint32 = dataView.getUint32(offset.value, true);
        offset.value = offset.value + INT32_SIZE;
        return Uint32;
    }
    function parseUint8Array(uInt8Array, offset) {
        const Uint8 = uInt8Array[offset.value];
        offset.value = offset.value + INT8_SIZE;
        return Uint8;
    }
    function parseUint8(dataView, offset) {
        const Uint8 = dataView.getUint8(offset.value);
        offset.value = offset.value + INT8_SIZE;
        return Uint8;
    }
    const parseInt64 = function(dataView, offset) {
        let int;
        if ("getBigInt64" in DataView.prototype) {
            int = Number(dataView.getBigInt64(offset.value, true));
        } else {
            int = dataView.getUint32(offset.value + 4, true) + Number(dataView.getUint32(offset.value, true) << 32);
        }
        offset.value += ULONG_SIZE;
        return int;
    };
    function parseFloat32(dataView, offset) {
        const float = dataView.getFloat32(offset.value, true);
        offset.value += FLOAT32_SIZE;
        return float;
    }
    function decodeFloat32(dataView, offset) {
        return DataUtils.toHalfFloat(parseFloat32(dataView, offset));
    }
    // https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
    function decodeFloat16(binary) {
        const exponent = (binary & 0x7c00) >> 10, fraction = binary & 0x03ff;
        return (binary >> 15 ? -1 : 1) * (exponent ? exponent === 0x1f ? fraction ? NaN : Infinity : Math.pow(2, exponent - 15) * (1 + fraction / 0x400) : 6.103515625e-5 * (fraction / 0x400));
    }
    function parseUint16(dataView, offset) {
        const Uint16 = dataView.getUint16(offset.value, true);
        offset.value += INT16_SIZE;
        return Uint16;
    }
    function parseFloat16(buffer, offset) {
        return decodeFloat16(parseUint16(buffer, offset));
    }
    function parseChlist(dataView, buffer, offset, size) {
        const startOffset = offset.value;
        const channels = [];
        while(offset.value < startOffset + size - 1){
            const name = parseNullTerminatedString(buffer, offset);
            const pixelType = parseInt32(dataView, offset);
            const pLinear = parseUint8(dataView, offset);
            offset.value += 3; // reserved, three chars
            const xSampling = parseInt32(dataView, offset);
            const ySampling = parseInt32(dataView, offset);
            channels.push({
                name: name,
                pixelType: pixelType,
                pLinear: pLinear,
                xSampling: xSampling,
                ySampling: ySampling
            });
        }
        offset.value += 1;
        return channels;
    }
    function parseChromaticities(dataView, offset) {
        const redX = parseFloat32(dataView, offset);
        const redY = parseFloat32(dataView, offset);
        const greenX = parseFloat32(dataView, offset);
        const greenY = parseFloat32(dataView, offset);
        const blueX = parseFloat32(dataView, offset);
        const blueY = parseFloat32(dataView, offset);
        const whiteX = parseFloat32(dataView, offset);
        const whiteY = parseFloat32(dataView, offset);
        return {
            redX: redX,
            redY: redY,
            greenX: greenX,
            greenY: greenY,
            blueX: blueX,
            blueY: blueY,
            whiteX: whiteX,
            whiteY: whiteY
        };
    }
    function parseCompression(dataView, offset) {
        const compressionCodes = [
            "NO_COMPRESSION",
            "RLE_COMPRESSION",
            "ZIPS_COMPRESSION",
            "ZIP_COMPRESSION",
            "PIZ_COMPRESSION",
            "PXR24_COMPRESSION",
            "B44_COMPRESSION",
            "B44A_COMPRESSION",
            "DWAA_COMPRESSION",
            "DWAB_COMPRESSION"
        ];
        const compression = parseUint8(dataView, offset);
        return compressionCodes[compression];
    }
    function parseBox2i(dataView, offset) {
        const xMin = parseInt32(dataView, offset);
        const yMin = parseInt32(dataView, offset);
        const xMax = parseInt32(dataView, offset);
        const yMax = parseInt32(dataView, offset);
        return {
            xMin: xMin,
            yMin: yMin,
            xMax: xMax,
            yMax: yMax
        };
    }
    function parseLineOrder(dataView, offset) {
        const lineOrders = [
            "INCREASING_Y",
            "DECREASING_Y",
            "RANDOM_Y"
        ];
        const lineOrder = parseUint8(dataView, offset);
        return lineOrders[lineOrder];
    }
    function parseEnvmap(dataView, offset) {
        const envmaps = [
            "ENVMAP_LATLONG",
            "ENVMAP_CUBE"
        ];
        const envmap = parseUint8(dataView, offset);
        return envmaps[envmap];
    }
    function parseTiledesc(dataView, offset) {
        const levelModes = [
            "ONE_LEVEL",
            "MIPMAP_LEVELS",
            "RIPMAP_LEVELS"
        ];
        const roundingModes = [
            "ROUND_DOWN",
            "ROUND_UP"
        ];
        const xSize = parseUint32(dataView, offset);
        const ySize = parseUint32(dataView, offset);
        const modes = parseUint8(dataView, offset);
        return {
            xSize: xSize,
            ySize: ySize,
            levelMode: levelModes[modes & 0xf],
            roundingMode: roundingModes[modes >> 4]
        };
    }
    function parseV2f(dataView, offset) {
        const x = parseFloat32(dataView, offset);
        const y = parseFloat32(dataView, offset);
        return [
            x,
            y
        ];
    }
    function parseV3f(dataView, offset) {
        const x = parseFloat32(dataView, offset);
        const y = parseFloat32(dataView, offset);
        const z = parseFloat32(dataView, offset);
        return [
            x,
            y,
            z
        ];
    }
    function parseValue(dataView, buffer, offset, type, size) {
        if (type === "string" || type === "stringvector" || type === "iccProfile") {
            return parseFixedLengthString(buffer, offset, size);
        } else if (type === "chlist") {
            return parseChlist(dataView, buffer, offset, size);
        } else if (type === "chromaticities") {
            return parseChromaticities(dataView, offset);
        } else if (type === "compression") {
            return parseCompression(dataView, offset);
        } else if (type === "box2i") {
            return parseBox2i(dataView, offset);
        } else if (type === "envmap") {
            return parseEnvmap(dataView, offset);
        } else if (type === "tiledesc") {
            return parseTiledesc(dataView, offset);
        } else if (type === "lineOrder") {
            return parseLineOrder(dataView, offset);
        } else if (type === "float") {
            return parseFloat32(dataView, offset);
        } else if (type === "v2f") {
            return parseV2f(dataView, offset);
        } else if (type === "v3f") {
            return parseV3f(dataView, offset);
        } else if (type === "int") {
            return parseInt32(dataView, offset);
        } else if (type === "rational") {
            return parseRational(dataView, offset);
        } else if (type === "timecode") {
            return parseTimecode(dataView, offset);
        } else if (type === "preview") {
            offset.value += size;
            return "skipped";
        } else {
            offset.value += size;
            return undefined;
        }
    }
    function roundLog2(x, mode) {
        const log2 = Math.log2(x);
        return mode == "ROUND_DOWN" ? Math.floor(log2) : Math.ceil(log2);
    }
    function calculateTileLevels(tiledesc, w, h) {
        let num = 0;
        switch(tiledesc.levelMode){
            case "ONE_LEVEL":
                num = 1;
                break;
            case "MIPMAP_LEVELS":
                num = roundLog2(Math.max(w, h), tiledesc.roundingMode) + 1;
                break;
            case "RIPMAP_LEVELS":
                throw new Error("EXRLoader: RIPMAP_LEVELS tiles currently unsupported.");
        }
        return num;
    }
    function calculateTiles(count, dataSize, size, roundingMode) {
        const tiles = new Array(count);
        for(let i = 0; i < count; i++){
            const b = 1 << i;
            let s = dataSize / b | 0;
            if (roundingMode == "ROUND_UP" && s * b < dataSize) s += 1;
            const l = Math.max(s, 1);
            tiles[i] = (l + size - 1) / size | 0;
        }
        return tiles;
    }
    function parseTiles(EXRDecoder) {
        const offset = EXRDecoder.offset;
        const tmpOffset = {
            value: 0
        };
        for(let tile = 0; tile < EXRDecoder.tileCount; tile++){
            const tileX = parseInt32(EXRDecoder.viewer, offset);
            const tileY = parseInt32(EXRDecoder.viewer, offset);
            offset.value += 8; // skip levels - only parsing top-level
            EXRDecoder.size = parseUint32(EXRDecoder.viewer, offset);
            const startX = tileX * EXRDecoder.blockWidth;
            const startY = tileY * EXRDecoder.blockHeight;
            EXRDecoder.columns = startX + EXRDecoder.blockWidth > EXRDecoder.width ? EXRDecoder.width - startX : EXRDecoder.blockWidth;
            EXRDecoder.lines = startY + EXRDecoder.blockHeight > EXRDecoder.height ? EXRDecoder.height - startY : EXRDecoder.blockHeight;
            const bytesBlockLine = EXRDecoder.columns * EXRDecoder.totalBytes;
            const isCompressed = EXRDecoder.size < EXRDecoder.lines * bytesBlockLine;
            const viewer = isCompressed ? EXRDecoder.uncompress(EXRDecoder) : uncompressRAW(EXRDecoder);
            offset.value += EXRDecoder.size;
            for(let line = 0; line < EXRDecoder.lines; line++){
                const lineOffset = line * EXRDecoder.columns * EXRDecoder.totalBytes;
                for(let channelID = 0; channelID < EXRDecoder.inputChannels.length; channelID++){
                    const name = EXRHeader.channels[channelID].name;
                    const lOff = EXRDecoder.channelByteOffsets[name] * EXRDecoder.columns;
                    const cOff = EXRDecoder.decodeChannels[name];
                    if (cOff === undefined) continue;
                    tmpOffset.value = lineOffset + lOff;
                    const outLineOffset = (EXRDecoder.height - (1 + startY + line)) * EXRDecoder.outLineWidth;
                    for(let x = 0; x < EXRDecoder.columns; x++){
                        const outIndex = outLineOffset + (x + startX) * EXRDecoder.outputChannels + cOff;
                        EXRDecoder.byteArray[outIndex] = EXRDecoder.getter(viewer, tmpOffset);
                    }
                }
            }
        }
    }
    function parseScanline(EXRDecoder) {
        const offset = EXRDecoder.offset;
        const tmpOffset = {
            value: 0
        };
        for(let scanlineBlockIdx = 0; scanlineBlockIdx < EXRDecoder.height / EXRDecoder.blockHeight; scanlineBlockIdx++){
            const line = parseInt32(EXRDecoder.viewer, offset) - EXRHeader.dataWindow.yMin; // line_no
            EXRDecoder.size = parseUint32(EXRDecoder.viewer, offset); // data_len
            EXRDecoder.lines = line + EXRDecoder.blockHeight > EXRDecoder.height ? EXRDecoder.height - line : EXRDecoder.blockHeight;
            const bytesPerLine = EXRDecoder.columns * EXRDecoder.totalBytes;
            const isCompressed = EXRDecoder.size < EXRDecoder.lines * bytesPerLine;
            const viewer = isCompressed ? EXRDecoder.uncompress(EXRDecoder) : uncompressRAW(EXRDecoder);
            offset.value += EXRDecoder.size;
            for(let line_y = 0; line_y < EXRDecoder.blockHeight; line_y++){
                const scan_y = scanlineBlockIdx * EXRDecoder.blockHeight;
                const true_y = line_y + EXRDecoder.scanOrder(scan_y);
                if (true_y >= EXRDecoder.height) continue;
                const lineOffset = line_y * bytesPerLine;
                const outLineOffset = (EXRDecoder.height - 1 - true_y) * EXRDecoder.outLineWidth;
                for(let channelID = 0; channelID < EXRDecoder.inputChannels.length; channelID++){
                    const name = EXRHeader.channels[channelID].name;
                    const lOff = EXRDecoder.channelByteOffsets[name] * EXRDecoder.columns;
                    const cOff = EXRDecoder.decodeChannels[name];
                    if (cOff === undefined) continue;
                    tmpOffset.value = lineOffset + lOff;
                    for(let x = 0; x < EXRDecoder.columns; x++){
                        const outIndex = outLineOffset + x * EXRDecoder.outputChannels + cOff;
                        EXRDecoder.byteArray[outIndex] = EXRDecoder.getter(viewer, tmpOffset);
                    }
                }
            }
        }
    }
    function parseHeader(dataView, buffer, offset) {
        const EXRHeader = {};
        if (dataView.getUint32(0, true) != 20000630) {
            // magic
            throw new Error("EXRLoader: Provided file doesn't appear to be in OpenEXR format.");
        }
        EXRHeader.version = dataView.getUint8(4);
        const spec = dataView.getUint8(5); // fullMask
        EXRHeader.spec = {
            singleTile: !!(spec & 2),
            longName: !!(spec & 4),
            deepFormat: !!(spec & 8),
            multiPart: !!(spec & 16)
        };
        // start of header
        offset.value = 8; // start at 8 - after pre-amble
        let keepReading = true;
        while(keepReading){
            const attributeName = parseNullTerminatedString(buffer, offset);
            if (attributeName == 0) {
                keepReading = false;
            } else {
                const attributeType = parseNullTerminatedString(buffer, offset);
                const attributeSize = parseUint32(dataView, offset);
                const attributeValue = parseValue(dataView, buffer, offset, attributeType, attributeSize);
                if (attributeValue === undefined) {
                    console.warn(`EXRLoader: Skipped unknown header attribute type \'${attributeType}\'.`);
                } else {
                    EXRHeader[attributeName] = attributeValue;
                }
            }
        }
        if ((spec & -7) != 0) {
            // unsupported deep-image, multi-part
            console.error("EXRHeader:", EXRHeader);
            throw new Error("EXRLoader: Provided file is currently unsupported.");
        }
        return EXRHeader;
    }
    function setupDecoder(EXRHeader, dataView, uInt8Array, offset, outputType) {
        const EXRDecoder = {
            size: 0,
            viewer: dataView,
            array: uInt8Array,
            offset: offset,
            width: EXRHeader.dataWindow.xMax - EXRHeader.dataWindow.xMin + 1,
            height: EXRHeader.dataWindow.yMax - EXRHeader.dataWindow.yMin + 1,
            inputChannels: EXRHeader.channels,
            channelByteOffsets: {},
            scanOrder: null,
            totalBytes: null,
            columns: null,
            lines: null,
            type: null,
            uncompress: null,
            getter: null,
            format: null,
            colorSpace: LinearSRGBColorSpace
        };
        switch(EXRHeader.compression){
            case "NO_COMPRESSION":
                EXRDecoder.blockHeight = 1;
                EXRDecoder.uncompress = uncompressRAW;
                break;
            case "RLE_COMPRESSION":
                EXRDecoder.blockHeight = 1;
                EXRDecoder.uncompress = uncompressRLE;
                break;
            case "ZIPS_COMPRESSION":
                EXRDecoder.blockHeight = 1;
                EXRDecoder.uncompress = uncompressZIP;
                break;
            case "ZIP_COMPRESSION":
                EXRDecoder.blockHeight = 16;
                EXRDecoder.uncompress = uncompressZIP;
                break;
            case "PIZ_COMPRESSION":
                EXRDecoder.blockHeight = 32;
                EXRDecoder.uncompress = uncompressPIZ;
                break;
            case "PXR24_COMPRESSION":
                EXRDecoder.blockHeight = 16;
                EXRDecoder.uncompress = uncompressPXR;
                break;
            case "DWAA_COMPRESSION":
                EXRDecoder.blockHeight = 32;
                EXRDecoder.uncompress = uncompressDWA;
                break;
            case "DWAB_COMPRESSION":
                EXRDecoder.blockHeight = 256;
                EXRDecoder.uncompress = uncompressDWA;
                break;
            default:
                throw new Error("EXRLoader.parse: " + EXRHeader.compression + " is unsupported");
        }
        const channels = {};
        for (const channel of EXRHeader.channels){
            switch(channel.name){
                case "Y":
                case "R":
                case "G":
                case "B":
                case "A":
                    channels[channel.name] = true;
                    EXRDecoder.type = channel.pixelType;
            }
        }
        // RGB images will be converted to RGBA format, preventing software emulation in select devices.
        let fillAlpha = false;
        if (channels.R && channels.G && channels.B) {
            fillAlpha = !channels.A;
            EXRDecoder.outputChannels = 4;
            EXRDecoder.decodeChannels = {
                R: 0,
                G: 1,
                B: 2,
                A: 3
            };
        } else if (channels.Y) {
            EXRDecoder.outputChannels = 1;
            EXRDecoder.decodeChannels = {
                Y: 0
            };
        } else {
            throw new Error("EXRLoader.parse: file contains unsupported data channels.");
        }
        if (EXRDecoder.type == 1) {
            // half
            switch(outputType){
                case FloatType:
                    EXRDecoder.getter = parseFloat16;
                    break;
                case HalfFloatType:
                    EXRDecoder.getter = parseUint16;
                    break;
            }
        } else if (EXRDecoder.type == 2) {
            // float
            switch(outputType){
                case FloatType:
                    EXRDecoder.getter = parseFloat32;
                    break;
                case HalfFloatType:
                    EXRDecoder.getter = decodeFloat32;
            }
        } else {
            throw new Error("EXRLoader.parse: unsupported pixelType " + EXRDecoder.type + " for " + EXRHeader.compression + ".");
        }
        EXRDecoder.columns = EXRDecoder.width;
        const size = EXRDecoder.width * EXRDecoder.height * EXRDecoder.outputChannels;
        switch(outputType){
            case FloatType:
                EXRDecoder.byteArray = new Float32Array(size);
                // Fill initially with 1s for the alpha value if the texture is not RGBA, RGB values will be overwritten
                if (fillAlpha) EXRDecoder.byteArray.fill(1, 0, size);
                break;
            case HalfFloatType:
                EXRDecoder.byteArray = new Uint16Array(size);
                if (fillAlpha) EXRDecoder.byteArray.fill(0x3c00, 0, size); // Uint16Array holds half float data, 0x3C00 is 1
                break;
            default:
                console.error("EXRLoader: unsupported type: ", outputType);
                break;
        }
        let byteOffset = 0;
        for (const channel of EXRHeader.channels){
            if (EXRDecoder.decodeChannels[channel.name] !== undefined) {
                EXRDecoder.channelByteOffsets[channel.name] = byteOffset;
            }
            byteOffset += channel.pixelType * 2;
        }
        EXRDecoder.totalBytes = byteOffset;
        EXRDecoder.outLineWidth = EXRDecoder.width * EXRDecoder.outputChannels;
        if (EXRHeader.lineOrder === "INCREASING_Y") {
            EXRDecoder.scanOrder = (y)=>y;
        } else {
            EXRDecoder.scanOrder = (y)=>EXRDecoder.height - 1 - y;
        }
        if (EXRDecoder.outputChannels == 4) {
            EXRDecoder.format = RGBAFormat;
            EXRDecoder.colorSpace = LinearSRGBColorSpace;
        } else {
            EXRDecoder.format = RedFormat;
            EXRDecoder.colorSpace = NoColorSpace;
        }
        if (EXRHeader.spec.singleTile) {
            EXRDecoder.blockHeight = EXRHeader.tiles.ySize;
            EXRDecoder.blockWidth = EXRHeader.tiles.xSize;
            const numXLevels = calculateTileLevels(EXRHeader.tiles, EXRDecoder.width, EXRDecoder.height);
            // const numYLevels = calculateTileLevels( EXRHeader.tiles, EXRDecoder.width, EXRDecoder.height );
            const numXTiles = calculateTiles(numXLevels, EXRDecoder.width, EXRHeader.tiles.xSize, EXRHeader.tiles.roundingMode);
            const numYTiles = calculateTiles(numXLevels, EXRDecoder.height, EXRHeader.tiles.ySize, EXRHeader.tiles.roundingMode);
            EXRDecoder.tileCount = numXTiles[0] * numYTiles[0];
            for(let l = 0; l < numXLevels; l++)for(let y = 0; y < numYTiles[l]; y++)for(let x = 0; x < numXTiles[l]; x++)parseInt64(dataView, offset); // tileOffset
            EXRDecoder.decode = parseTiles.bind(EXRDecoder);
        } else {
            EXRDecoder.blockWidth = EXRDecoder.width;
            const blockCount = Math.ceil(EXRDecoder.height / EXRDecoder.blockHeight);
            for(let i = 0; i < blockCount; i++)parseInt64(dataView, offset); // scanlineOffset
            EXRDecoder.decode = parseScanline.bind(EXRDecoder);
        }
        return EXRDecoder;
    }
    // start parsing file [START]
    const offset = {
        value: 0
    };
    const bufferDataView = new DataView(buffer);
    const uInt8Array = new Uint8Array(buffer);
    // get header information and validate format.
    const EXRHeader = parseHeader(bufferDataView, buffer, offset);
    // get input compression information and prepare decoding.
    const EXRDecoder = setupDecoder(EXRHeader, bufferDataView, uInt8Array, offset, type);
    // parse input data
    EXRDecoder.decode(EXRDecoder);
    return {
        header: EXRHeader,
        width: EXRDecoder.width,
        height: EXRDecoder.height,
        data: EXRDecoder.byteArray,
        format: EXRDecoder.format,
        colorSpace: EXRDecoder.colorSpace
    };
}

/**
 * @typedef ExrOptions
 * @property {number} [type=1015] Float or Half Float WebGL type. (1015 for Float)
 */ /**
 * Load an EXR file or array buffer as a texture
 * @alias module:pex-loaders.loadExr
 * @param {ctx} ctx
 * @param {string | ArrayBuffer} data
 * @param {ExrOptions} [options]
 * @param {ctx.texture2D} [texture] Optionally pass an already created texture resource.
 * @returns {Promise<ctx.texture2D>}
 */ async function loadExr(ctx, data, options, texture) {
    const outputType = options?.type || 1015;
    const isHalfFloat = outputType === 1016;
    const parsed = parseExr(data instanceof ArrayBuffer ? data : await loadArrayBuffer(data), outputType);
    texture ||= ctx.texture2D({
        width: 1,
        height: 1,
        encoding: ctx.Encoding.Linear,
        pixelFormat: ctx.PixelFormat[isHalfFloat ? "RGBA16F" : "RGBA32F"],
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear
    });
    ctx.update(texture, {
        data: parsed.data,
        width: parsed.width,
        height: parsed.height
    });
    return texture;
}

export { BasisFormat, loadBasis, loadDraco, loadExr, loadHdr, loadKtx2, loadUltraHdr };
