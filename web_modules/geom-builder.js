import { t as typedArrayConstructor } from './_chunks/index-CcviitTA.js';

// TODO
// change index to offset so it's always up to date?
class GeomBuilder {
    static{
        this.indicesProps = [
            "cells",
            "indices"
        ];
    }
    static formatIndexKey(attributeName) {
        return `${attributeName}Index`;
    }
    static formatFunctionName(attributeName) {
        return `${attributeName[0].toUpperCase()}${attributeName.slice(1, -1)}`;
    }
    static expandFloatArray(a) {
        const biggerArray = new Float32Array(a.length * 2);
        biggerArray.set(a);
        return biggerArray;
    }
    static expandUintArray(a) {
        const biggerArray = new a.constructor(a.length * 2);
        biggerArray.set(a);
        return biggerArray;
    }
    get indexCount() {
        for (let attributeName of GeomBuilder.indicesProps){
            const attributeIndexKey = GeomBuilder.formatIndexKey(attributeName);
            const indexCount = this[attributeIndexKey];
            if (indexCount !== undefined) return indexCount;
        }
        return undefined;
    }
    constructor({ size = 32, ...attributes }){
        this.count = 0;
        attributes ||= {};
        attributes.positions ??= 3;
        this.attributes = attributes;
        for (let [attributeName, attributeSize] of Object.entries(attributes)){
            const isIndices = GeomBuilder.indicesProps.includes(attributeName);
            const attributeIndexKey = GeomBuilder.formatIndexKey(attributeName);
            const addFnName = `add${GeomBuilder.formatFunctionName(attributeName)}`;
            // Adds this.cellsIndex, this.positionsIndex...
            this[attributeIndexKey] = 0;
            if (isIndices) {
                // Adds this.cells...
                const UintTypedArray = typedArrayConstructor(Math.max(256, size)); // Ensure Uint16Array at minimum
                this[attributeName] = new UintTypedArray(size * attributeSize);
            } else {
                // Adds this.positions, this.normals, this.uvs, this.vertexColors...
                this[attributeName] = new Float32Array(size * attributeSize);
            }
            // Adds this.addCell, this.addPosition, this.addNormal...
            this[addFnName] = (value)=>{
                // Resize indices
                if (isIndices && Math.max(...value) > 65535 && this[attributeName].constructor !== Uint32Array) {
                    this[attributeName] = new Uint32Array(this[attributeName]);
                }
                // Expand typed array exponentially
                if (this[attributeIndexKey] + value.length >= this[attributeName].length) {
                    this[attributeName] = isIndices ? GeomBuilder.expandUintArray(this[attributeName]) : GeomBuilder.expandFloatArray(this[attributeName]);
                }
                // Update typed array
                for(let i = 0; i < value.length; i++){
                    this[attributeName][this[attributeIndexKey]++] = value[i];
                }
                // Increment count for positions
                if (attributeName === "positions") this.count++;
            };
        }
    }
    reset() {
        for (let attributeName of Object.keys(this.attributes)){
            const attributeIndexKey = GeomBuilder.formatIndexKey(attributeName);
            this[attributeIndexKey] = 0;
        }
        this.count = 0;
    }
}
function createGeomBuilder(opts) {
    return new GeomBuilder(opts);
}

export { createGeomBuilder as default };
