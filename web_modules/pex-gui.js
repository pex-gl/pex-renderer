import { r as remap, c as clamp } from './_chunks/utils-B1Ghr_dy.js';
import { t as toHex, a as toHSL, f as fromHSL } from './_chunks/hsl-Cxyv9U6e.js';
import { w as width, h as height, c as containsPoint } from './_chunks/rect-Dy6qG5eq.js';
import './_chunks/vec2-CAYY_f5d.js';

function rectSet4(a, x, y, w, h) {
    a[0][0] = x;
    a[0][1] = y;
    a[1][0] = x + w;
    a[1][1] = y + h;
    return a;
}
function makePaletteImage(item, w, img) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = w * img.height / img.width;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    item.options.paletteImage = canvas;
    item.options.paletteImage.data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    item.options.paletteImage.aspectRatio = canvas.height / canvas.width;
    item.dirty = true;
}
class CanvasRenderer {
    constructor({ width, height, pixelRatio = devicePixelRatio, theme }){
        this.pixelRatio = pixelRatio;
        this.theme = theme;
        this.canvas = document.createElement("canvas");
        this.canvas.width = width * this.pixelRatio;
        this.canvas.height = height * this.pixelRatio;
        this.ctx = this.canvas.getContext("2d");
        this.dirty = true;
    }
    draw(items) {
        this.dirty = false;
        const { fontFamily, fontSize, capHeight, leftOffset, topOffset, columnWidth, tabHeight, headerSize, titleHeight, itemHeight, graphHeight, padding, textPadding } = this.theme;
        const sliderHeight = 0.7 * itemHeight;
        const buttonHeight = 1.2 * itemHeight;
        const ctx = this.ctx;
        ctx.save();
        ctx.scale(this.pixelRatio, this.pixelRatio);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const fontCapOffset = capHeight * fontSize;
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textBaseline = "middle";
        let dx = leftOffset;
        let dy = topOffset;
        let w = columnWidth;
        const gap = padding;
        let cellSize = 0;
        let numRows = 0;
        let columnIndex = 0;
        const tabs = items.filter(({ type })=>type === "tab");
        const defaultDy = tabs.length ? topOffset + tabHeight + padding * 3 : topOffset;
        tabs.forEach((tab)=>{
            ctx.fillStyle = this.theme.background;
            ctx.fillRect(dx, dy, w, tabHeight + padding * 2);
            ctx.fillStyle = tab.current ? this.theme.tabBackgroundActive : this.theme.tabBackground;
            const x = dx + padding;
            const y = dy + padding;
            const width = w - padding * 2;
            ctx.fillRect(x, y, width, tabHeight);
            if (!tab.current) {
                ctx.fillStyle = this.theme.background;
                ctx.fillRect(x, dy + tabHeight + padding / 2, width, padding / 2);
            }
            ctx.fillStyle = tab.current ? this.theme.tabColorActive : this.theme.tabColor;
            ctx.fillText(tab.title, x + textPadding, y + tabHeight / 2 + fontCapOffset);
            rectSet4(tab.activeArea, x, y, width, tabHeight);
            dx += w + gap;
        });
        dx = leftOffset;
        let maxWidth = 0;
        let maxHeight = 0;
        let needInitialDy = true;
        for(let i = 0; i < items.length; i++){
            const item = items[i];
            if (Number.isFinite(item.x)) dx = item.x;
            if (Number.isFinite(item.y)) dy = item.y;
            let eh = itemHeight;
            if (item.type === "tab") continue;
            if (tabs.length > 0) {
                const prevTabs = items.filter(({ type }, index)=>index < i && type === "tab");
                const parentTab = prevTabs[prevTabs.length - 1];
                if (parentTab && !parentTab.current) {
                    continue;
                } else {
                    if (needInitialDy && item.type !== "column") {
                        needInitialDy = false;
                        dy += tabHeight + padding * 3;
                    }
                }
                needInitialDy = false;
            }
            const x = dx + padding;
            const width = w - padding * 2;
            const textY = titleHeight / 2 + fontCapOffset;
            // Compute item height
            if (item.type === "column") {
                dx = leftOffset + columnIndex * (w + gap);
                dy = defaultDy;
                w = item.width;
                columnIndex++;
                continue;
            } else if (item.type === "slider") {
                eh = titleHeight + sliderHeight;
            } else if (item.type === "toggle") {
                eh = padding + itemHeight;
            } else if (item.type === "multislider") {
                const numSliders = item.getValue().length;
                eh = titleHeight + numSliders * sliderHeight + (numSliders - 1) * padding;
            } else if (item.type === "color") {
                const numSliders = item.options.alpha ? 4 : 3;
                const sliderGap = item.options.paletteImage ? 0 : 1;
                eh = titleHeight + numSliders * sliderHeight + (numSliders - sliderGap) * padding;
                if (item.options.paletteImage) {
                    eh += width * item.options.paletteImage.aspectRatio;
                }
            } else if (item.type === "button") {
                eh = padding + buttonHeight;
            } else if (item.type === "texture2D") {
                eh = titleHeight + item.texture.height * width / item.texture.width;
            } else if (item.type === "textureCube") {
                eh = titleHeight + width / 2;
            } else if (item.type === "radiolist") {
                eh = titleHeight + item.items.length * itemHeight + (item.items.length - 1) * padding * 2;
            } else if (item.type === "texturelist") {
                cellSize = Math.floor(width / item.itemsPerRow);
                numRows = Math.ceil(item.items.length / item.itemsPerRow);
                eh = titleHeight + numRows * cellSize;
            } else if (item.type === "header") {
                eh = padding + headerSize;
            } else if (item.type === "text") {
                eh = titleHeight + buttonHeight;
            } else if (item.type === "graph") {
                eh = titleHeight + graphHeight;
            } else if (item.type === "stats") {
                eh = Object.values(item.stats).map((value)=>String(value).split("\n").length).reduce((a, b)=>a + b, 0) * itemHeight;
                if (item.title !== "") eh += titleHeight;
            } else if (item.type === "label") {
                eh = item.title.split("\n").length * itemHeight + padding * 0.5;
            }
            const needsPadding = item.type !== "column";
            // Draw background
            if (item.type === "separator") {
                eh /= 2;
            } else {
                ctx.fillStyle = this.theme.background;
                ctx.fillRect(dx, dy, w, eh + (needsPadding ? padding : 0));
            }
            // Draw item
            if (item.type === "slider") {
                const y = dy + titleHeight;
                const height = eh - titleHeight;
                ctx.fillStyle = this.theme.color;
                ctx.fillText(`${item.title}: ${item.getStrValue()}`, x + textPadding, dy + textY);
                ctx.fillStyle = this.theme.input;
                ctx.fillRect(x, y, width, height);
                ctx.fillStyle = this.theme.accent;
                ctx.fillRect(x, y, width * item.getNormalizedValue(), height);
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "multislider" || item.type === "color") {
                const isColor = item.type === "color";
                const y = dy + titleHeight;
                const height = eh - titleHeight;
                const numSliders = isColor ? item.options.alpha ? 4 : 3 : item.getValue().length;
                ctx.fillStyle = this.theme.color;
                ctx.fillText(`${item.title}: ${item.getStrValue()}`, x + textPadding, dy + textY);
                for(let j = 0; j < numSliders; j++){
                    const sliderY = y + j * (sliderHeight + padding);
                    ctx.fillStyle = this.theme.input;
                    ctx.fillRect(x, sliderY, width, sliderHeight);
                    ctx.fillStyle = this.theme.accent;
                    ctx.fillRect(x, sliderY, width * item.getNormalizedValue(j), sliderHeight);
                }
                if (isColor) {
                    const sqSize = titleHeight * 0.6;
                    ctx.fillStyle = toHex(item.contextObject[item.attributeName]);
                    ctx.fillRect(dx + w - sqSize - padding, dy + titleHeight * 0.2, sqSize, sqSize);
                    if (item.options?.palette && !item.options.paletteImage) {
                        if (item.options.palette.width) {
                            makePaletteImage(item, w, item.options.palette);
                        } else {
                            const img = new Image();
                            img.onload = ()=>{
                                makePaletteImage(item, w, img);
                            };
                            img.src = item.options.palette;
                        }
                    }
                    if (item.options.paletteImage) {
                        ctx.drawImage(item.options.paletteImage, x, y + (sliderHeight + padding) * numSliders, width, width * item.options.paletteImage.aspectRatio);
                    }
                }
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "button") {
                const y = dy + padding;
                const height = buttonHeight;
                ctx.fillStyle = item.active ? this.theme.accent : this.theme.input;
                ctx.fillRect(x, y, width, height);
                ctx.fillStyle = item.active ? this.theme.input : this.theme.color;
                ctx.fillText(item.title, x + textPadding * 2, y + height / 2 + fontCapOffset);
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "toggle") {
                const y = dy + padding;
                const height = itemHeight;
                ctx.fillStyle = item.contextObject[item.attributeName] ? this.theme.accent : this.theme.input;
                ctx.fillRect(x, y, height, height);
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.title, x + itemHeight + textPadding * 2, dy + padding + itemHeight / 2 + fontCapOffset);
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "radiolist") {
                const y = dy + titleHeight;
                const height = item.items.length * itemHeight + (item.items.length - 1) * 2 * padding;
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.title, x + textPadding, dy + textY);
                for(let j = 0; j < item.items.length; j++){
                    const i = item.items[j];
                    const radioY = j * (itemHeight + padding * 2);
                    ctx.fillStyle = item.contextObject[item.attributeName] === i.value ? this.theme.accent : this.theme.input;
                    ctx.fillRect(x, y + radioY, itemHeight, itemHeight);
                    ctx.fillStyle = this.theme.color;
                    ctx.fillText(i.name, x + itemHeight + textPadding * 2, titleHeight + radioY + dy + itemHeight / 2 + fontCapOffset);
                }
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "texturelist") {
                const y = dy + titleHeight;
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.title, x + textPadding, dy + textY);
                for(let j = 0; j < item.items.length; j++){
                    const col = j % item.itemsPerRow;
                    const row = Math.floor(j / item.itemsPerRow);
                    const itemX = x + col * cellSize;
                    const itemY = dy + titleHeight + row * cellSize;
                    let shrink = 0;
                    if (item.items[j].value === item.contextObject[item.attributeName]) {
                        ctx.fillStyle = "none";
                        ctx.strokeStyle = this.theme.accent;
                        ctx.lineWidth = padding;
                        ctx.strokeRect(itemX + padding * 0.5, itemY + padding * 0.5, cellSize - 1 - padding, cellSize - 1 - padding);
                        ctx.lineWidth = 1;
                        shrink = padding;
                    }
                    item.items[j].activeArea ||= [
                        [
                            0,
                            0
                        ],
                        [
                            0,
                            0
                        ]
                    ];
                    rectSet4(item.items[j].activeArea, itemX + shrink, itemY + shrink, cellSize - 1 - 2 * shrink, cellSize - 1 - 2 * shrink);
                }
                rectSet4(item.activeArea, x, y, width, cellSize * numRows);
            } else if (item.type === "texture2D") {
                const y = dy + titleHeight;
                const height = eh - titleHeight;
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.title, x + textPadding, dy + textY);
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "textureCube") {
                const y = dy + titleHeight;
                const height = eh - titleHeight;
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.title, x + textPadding, dy + textY);
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "header") {
                ctx.fillStyle = this.theme.headerBackground;
                ctx.fillRect(x, dy + padding, width, eh - padding);
                ctx.fillStyle = this.theme.headerColor;
                ctx.fillText(item.title, x + textPadding, dy + padding + headerSize / 2 + fontCapOffset);
            } else if (item.type === "text") {
                const y = dy + titleHeight;
                const height = eh - titleHeight;
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.title, x + textPadding, dy + textY);
                ctx.fillStyle = this.theme.input;
                ctx.fillRect(x, y, item.activeArea[1][0] - item.activeArea[0][0], item.activeArea[1][1] - item.activeArea[0][1]);
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.contextObject[item.attributeName], x + textPadding * 2, y + buttonHeight / 2 + fontCapOffset);
                if (item.focus) {
                    ctx.strokeStyle = this.theme.accent;
                    ctx.strokeRect(item.activeArea[0][0] - 0.5, item.activeArea[0][1] - 0.5, item.activeArea[1][0] - item.activeArea[0][0], item.activeArea[1][1] - item.activeArea[0][1]);
                }
                rectSet4(item.activeArea, x, y, width, height);
            } else if (item.type === "graph") {
                const y = dy + titleHeight;
                const height = eh - titleHeight;
                if (item.values.length > width) item.values = item.values.slice(-width);
                if (item.values.length) {
                    item.max = item.options.max ?? Math.max(...item.values);
                }
                if (item.values.length) {
                    item.min = item.options.min ?? Math.min(...item.values);
                }
                ctx.fillStyle = this.theme.graphBackground;
                ctx.fillRect(x, y, width, height);
                ctx.strokeStyle = this.theme.background;
                ctx.beginPath();
                ctx.moveTo(x, y + padding);
                ctx.lineTo(x + width, y + padding);
                ctx.closePath();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y + height - padding);
                ctx.lineTo(x + width, y + height - padding);
                ctx.closePath();
                ctx.stroke();
                ctx.fillStyle = this.theme.color;
                ctx.save();
                ctx.font = `${fontSize * 0.5}px ${fontFamily}`;
                ctx.textAlign = "right";
                const textX = x + width - padding;
                if (item.max !== undefined) {
                    ctx.fillText(item.options.format(item.max), textX, y + padding * 2.5);
                }
                if (item.min !== undefined) {
                    ctx.fillText(item.options.format(item.min), textX, y + height - padding * 2.5);
                }
                ctx.restore();
                ctx.strokeStyle = this.theme.color;
                ctx.beginPath();
                for(let j = 0; j < item.values.length; j++){
                    const v = remap(item.values[j], item.min, item.max, 0, 1);
                    ctx[j === 0 ? "moveTo" : "lineTo"](x + j, y + height - v * (height - padding * 2) - padding);
                }
                ctx.stroke();
                ctx.fillText(`${item.title}: ${item.options.format(item.values[item.values.length - 1])}`, x + textPadding, dy + textY);
            } else if (item.type === "stats") {
                ctx.fillStyle = this.theme.color;
                let lineIndex = 0;
                if (item.title) {
                    ctx.fillText(item.title, x + textPadding, dy + textY);
                    lineIndex++;
                }
                for (let [name, value] of Object.entries(item.stats)){
                    const lines = String(value).split("\n");
                    for(let j = 0; j < lines.length; j++){
                        const lineValue = lines[j];
                        ctx.fillText(j === 0 ? `${name}: ${lineValue}` : lineValue, x + textPadding * 2, dy + textY + itemHeight * lineIndex);
                        lineIndex++;
                    }
                }
            } else if (item.type === "label") {
                ctx.fillStyle = this.theme.color;
                const lines = item.title.split("\n");
                for(let i = 0; i < lines.length; i++){
                    ctx.fillText(lines[i], x + textPadding, dy + textY + itemHeight * i);
                }
            } else if (item.type === "separator") ; else {
                ctx.fillStyle = this.theme.color;
                ctx.fillText(item.title, x + textPadding, dy + textY);
            }
            dy += eh + (needsPadding ? padding : 0) + gap;
            maxWidth = Math.max(maxWidth, dx + w + leftOffset);
            maxHeight = Math.max(maxHeight, dy + topOffset);
        }
        this.afterDraw();
        ctx.restore();
        maxWidth = Math.max(maxWidth, tabs.length * (w + gap));
        if (maxWidth && maxHeight) {
            maxWidth = maxWidth * this.pixelRatio | 0;
            maxHeight = maxHeight * this.pixelRatio | 0;
            if (this.canvas.width !== maxWidth) {
                this.canvas.width = maxWidth;
                this.dirty = true;
            }
            if (this.canvas.height !== maxHeight) {
                this.canvas.height = maxHeight;
                this.dirty = true;
            }
            if (this.dirty) {
                this.draw(items);
            }
        }
    }
    afterDraw() {}
    getTexture() {
        return this.canvas;
    }
    dispose() {
        this.canvas.remove();
    }
}

class PexContextRenderer extends CanvasRenderer {
    #ctx;
    constructor(opts){
        super(opts);
        const { ctx } = opts;
        this.#ctx = ctx;
        this.rendererTexture = ctx.texture2D({
            width: opts[0],
            height: opts[1],
            pixelFormat: ctx.PixelFormat.RGBA8,
            encoding: ctx.Encoding.SRGB
        });
    }
    draw(items) {
        super.draw(items);
    }
    afterDraw() {
        this.#ctx.update(this.rendererTexture, {
            data: this.canvas,
            width: this.canvas.width,
            height: this.canvas.height,
            flipY: true
        });
    }
    getTexture() {
        return this.rendererTexture;
    }
    dispose() {
        super.dispose();
        this.#ctx.dispose(this.rendererTexture);
    }
}

class DebugRenderer extends CanvasRenderer {
    constructor(opts){
        super(opts);
    }
    draw(items) {
        this.items = items;
        super.draw(items);
    }
    afterDraw() {
        this.items.forEach((item)=>{
            this.ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
            this.ctx.strokeRect(item.activeArea[0][0], item.activeArea[0][1], width(item.activeArea), height(item.activeArea));
        });
    }
}

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  CanvasRenderer: CanvasRenderer,
  DebugRenderer: DebugRenderer,
  PexContextRenderer: PexContextRenderer
});

class GUIControl {
    constructor(options){
        Object.assign(this, options);
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    getNormalizedValue(idx) {
        if (!this.contextObject) return 0;
        let val = this.contextObject[this.attributeName];
        if (this.options && this.options.min !== undefined && this.options.max !== undefined) {
            if (this.type === "multislider") {
                val = (val[idx] - this.options.min) / (this.options.max - this.options.min);
            } else if (this.type === "color") {
                const hsl = toHSL(val);
                if (idx === 0) val = hsl[0];
                if (idx === 1) val = hsl[1];
                if (idx === 2) val = hsl[2];
                if (idx === 3) val = val[3];
            } else {
                val = (val - this.options.min) / (this.options.max - this.options.min);
            }
        }
        return val;
    }
    setNormalizedValue(val, idx) {
        if (!this.contextObject) return;
        if (this.options && this.options.min !== undefined && this.options.max !== undefined) {
            if (this.type === "multislider") {
                const a = this.contextObject[this.attributeName];
                if (idx >= a.length) {
                    return;
                }
                a[idx] = this.options.min + val * (this.options.max - this.options.min);
                val = a;
            } else if (this.type === "color") {
                const c = this.contextObject[this.attributeName];
                if (idx === 3) {
                    c[3] = val;
                } else {
                    const hsl = toHSL(c);
                    if (idx === 0) hsl[0] = val;
                    if (idx === 1) hsl[1] = val;
                    if (idx === 2) hsl[2] = val;
                    fromHSL(c, ...hsl);
                }
                val = c;
            } else {
                val = this.options.min + val * (this.options.max - this.options.min);
            }
            if (this.options && this.options.step) {
                val = val - val % this.options.step;
            }
        }
        this.contextObject[this.attributeName] = val;
    }
    getSerializedValue() {
        return this.contextObject ? this.contextObject[this.attributeName] : "";
    }
    setSerializedValue(value) {
        if (this.type === "slider") {
            this.contextObject[this.attributeName] = value;
        } else if (this.type === "multislider") {
            this.contextObject[this.attributeName] = value;
        } else if (this.type === "color") {
            this.contextObject[this.attributeName].r = value.r;
            this.contextObject[this.attributeName].g = value.g;
            this.contextObject[this.attributeName].b = value.b;
            this.contextObject[this.attributeName].a = value.a;
        } else if (this.type === "toggle") {
            this.contextObject[this.attributeName] = value;
        } else if (this.type === "radiolist") {
            this.contextObject[this.attributeName] = value;
        }
    }
    getValue() {
        if (this.type === "slider") {
            return this.contextObject[this.attributeName];
        } else if (this.type === "multislider") {
            return this.contextObject[this.attributeName];
        } else if (this.type === "color") {
            return this.contextObject[this.attributeName];
        } else if (this.type === "toggle") {
            return this.contextObject[this.attributeName];
        } else {
            return 0;
        }
    }
    getStrValue() {
        if (this.type === "slider") {
            const str = `${this.contextObject[this.attributeName]}`;
            let dotPos = str.indexOf(".") + 1;
            if (dotPos === 0) return `${str}.0`;
            while(str.charAt(dotPos) === "0"){
                dotPos++;
            }
            return str.substr(0, dotPos + 2);
        } else if (this.type === "color") {
            return this.options.alpha ? "HSLA" : "HSL";
        } else if (this.type === "toggle") {
            return this.contextObject[this.attributeName];
        } else {
            return "";
        }
    }
}

var DEFAULT_THEME = {
    fontFamily: `"Monaco", monospace`,
    fontSize: 10,
    capHeight: 0.09,
    leftOffset: 10,
    topOffset: 10,
    columnWidth: 160,
    tabHeight: 22,
    headerSize: 18,
    titleHeight: 20,
    itemHeight: 16,
    graphHeight: 40,
    padding: 3,
    textPadding: 2,
    color: "rgba(255, 255, 255, 1)",
    background: "rgba(0, 0, 0, 0.56)",
    input: "rgba(150, 150, 150, 1)",
    accent: "rgba(255, 255, 0, 1)",
    tabBackground: "rgba(75, 75, 75, 1)",
    tabColor: "rgba(175, 175, 175, 1)",
    tabBackgroundActive: "rgba(46, 204, 113, 1)",
    tabColorActive: "rgba(0, 0, 0, 1)",
    headerBackground: "rgba(255, 255, 255, 1)",
    headerColor: "rgba(0, 0, 0, 1)",
    graphBackground: "rgba(50, 50, 50, 1)"
};

var VERT = /* glsl */ `
attribute vec2 aPosition;
attribute vec2 aTexCoord0;

uniform vec4 uViewport;
uniform vec4 uRect;

varying vec2 vTexCoord0;

void main() {
  vTexCoord0 = vec2(aTexCoord0.x, 1.0 - aTexCoord0.y);
  vec2 vertexPos = aPosition * 0.5 + 0.5;

  vec2 pos = vec2(0.0, 0.0); // window pos
  vec2 windowSize = vec2(uViewport.z - uViewport.x, uViewport.w - uViewport.y);
  pos.x = uRect.x / windowSize.x + vertexPos.x * (uRect.z - uRect.x) / windowSize.x;
  pos.y = uRect.y / windowSize.y + vertexPos.y * (uRect.w - uRect.y) / windowSize.y;
  pos.y = 1.0 - pos.y;
  pos = pos * 2.0 - 1.0;

  gl_Position = vec4(pos, 0.0, 1.0);
}`;

var GAMMA = /* glsl */ `
const float gamma = 2.2;

// Linear
float toLinear(float v) {
  return pow(v, gamma);
}

vec2 toLinear(vec2 v) {
  return pow(v, vec2(gamma));
}

vec3 toLinear(vec3 v) {
  return pow(v, vec3(gamma));
}

vec4 toLinear(vec4 v) {
  return vec4(toLinear(v.rgb), v.a);
}

// Gamma
float toGamma(float v) {
  return pow(v, 1.0 / gamma);
}

vec2 toGamma(vec2 v) {
  return pow(v, vec2(1.0 / gamma));
}

vec3 toGamma(vec3 v) {
  return pow(v, vec3(1.0 / gamma));
}

vec4 toGamma(vec4 v) {
  return vec4(toGamma(v.rgb), v.a);
}
`;

var RGBM = /* glsl */ `
vec3 decodeRGBM (vec4 rgbm) {
  vec3 r = rgbm.rgb * (7.0 * rgbm.a);
  return r * r;
}

vec4 encodeRGBM (vec3 rgb_0) {
  vec4 r;
  r.xyz = (1.0 / 7.0) * sqrt(rgb_0);
  r.a = max(max(r.x, r.y), r.z);
  r.a = clamp(r.a, 1.0 / 255.0, 1.0);
  r.a = ceil(r.a * 255.0) / 255.0;
  r.xyz /= r.a;
  return r;
}
`;

var DECODE_ENCODE = /* glsl */ `
#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

vec4 decode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toLinear(pixel);
  if (encoding == SRGB) return toLinear(pixel);
  if (encoding == RGBM) return vec4(decodeRGBM(pixel), 1.0);
  return pixel;
}

vec4 encode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toGamma(pixel);
  if (encoding == SRGB) return toGamma(pixel);
  if (encoding == RGBM) return encodeRGBM(pixel.rgb);
  return pixel;
}
`;

var TEXTURE_CUBE_FRAG = /* glsl */ `#version 100
precision highp float;

${GAMMA}
${RGBM}
${DECODE_ENCODE}

const float PI = 3.1415926;

varying vec2 vTexCoord0;

uniform samplerCube uTexture;
uniform int uTextureEncoding;
uniform float uLevel;
uniform float uFlipEnvMap;

void main() {
  float theta = PI * (vTexCoord0.x * 2.0);
  float phi = PI * (1.0 - vTexCoord0.y);

  float x = sin(phi) * sin(theta);
  float y = -cos(phi);
  float z = -sin(phi) * cos(theta);

  vec3 N = normalize(vec3(uFlipEnvMap * x, y, z));
  vec4 color = textureCube(uTexture, N, uLevel);
  color = decode(color, uTextureEncoding);
  // if LINEAR || RGBM then tonemap
  if (uTextureEncoding == LINEAR || uTextureEncoding == RGBM) {
    color.rgb = color.rgb / (color.rgb + 1.0);
  }
  gl_FragColor = encode(color, 2); // to gamma
}`;

var TEXTURE_2D_FRAG = /* glsl */ `#version 100
precision highp float;

${GAMMA}
${RGBM}
${DECODE_ENCODE}

uniform sampler2D uTexture;
uniform int uTextureEncoding;
varying vec2 vTexCoord0;

void main() {
  vec4 color = texture2D(uTexture, vTexCoord0);
  color = decode(color, uTextureEncoding);
  // if LINEAR || RGBM then tonemap
  if (uTextureEncoding == LINEAR || uTextureEncoding == RGBM) {
    color.rgb = color.rgb / (color.rgb + 1.0);
  }
  gl_FragColor = encode(color, 2); // to gamma
}`;

const isArrayLike = (value)=>Array.isArray(value) || ArrayBuffer.isView(value);
/**
 * GUI controls for PEX.
 * @property {boolean} [enabled=true] Enable/disable pointer interaction and drawing.
 */ class GUI {
    #pixelRatio;
    #scale;
    get size() {
        return this.ctx.gl ? [
            this.ctx.gl.drawingBufferWidth,
            this.ctx.gl.drawingBufferHeight
        ] : [
            this.ctx.canvas.width,
            this.ctx.canvas.height
        ];
    }
    get canvas() {
        return this.ctx.gl ? this.ctx.gl.canvas : this.ctx.canvas;
    }
    set pixelRatio(ratio) {
        if (this.renderer) this.renderer.pixelRatio = ratio;
        this.#pixelRatio = ratio;
    }
    /**
   * Creates an instance of GUI.
   * @param {ctx | CanvasRenderingContext2D} ctx
   * @param {import("./types.js").GUIOptions} opts
   */ constructor(ctx, { pixelRatio = devicePixelRatio, theme = {}, scale = 1, responsive = true, overlay = false, renderer } = {}){
        this.ctx = ctx;
        this.#pixelRatio = pixelRatio;
        this.theme = {
            ...DEFAULT_THEME,
            ...theme
        };
        this.scale = scale;
        this.#scale = scale;
        this.responsive = responsive;
        this.enabled = true;
        const [W, H] = this.size;
        this.viewport = [
            0,
            0,
            W,
            H
        ];
        this.x = 0;
        this.y = 0;
        this.pointerOffset = [
            0,
            0
        ];
        this.items = [];
        // Create renderer
        const isPexContext = this.ctx.gl;
        const [rendererWidth, rendererHeight] = [
            W / 3,
            H / 3
        ];
        this.renderer = renderer || new (isPexContext ? PexContextRenderer : CanvasRenderer)({
            ctx: this.ctx,
            width: rendererWidth,
            height: rendererHeight,
            pixelRatio: this.#pixelRatio,
            theme: this.theme
        });
        if (isPexContext) {
            const attributes = {
                aPosition: {
                    buffer: ctx.vertexBuffer([
                        [
                            -1,
                            -1
                        ],
                        [
                            1,
                            -1
                        ],
                        [
                            1,
                            1
                        ],
                        [
                            -1,
                            1
                        ]
                    ])
                },
                aTexCoord0: {
                    buffer: ctx.vertexBuffer([
                        [
                            0,
                            0
                        ],
                        [
                            1,
                            0
                        ],
                        [
                            1,
                            1
                        ],
                        [
                            0,
                            1
                        ]
                    ])
                }
            };
            const indices = {
                buffer: ctx.indexBuffer([
                    [
                        0,
                        1,
                        2
                    ],
                    [
                        0,
                        2,
                        3
                    ]
                ])
            };
            const pipelineOptions = {
                depthTest: false,
                depthWrite: false,
                blend: true,
                blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
                blendSrcAlphaFactor: ctx.BlendFactor.One,
                blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
                blendDstAlphaFactor: ctx.BlendFactor.One
            };
            const drawTexture2dCmd = {
                name: "gui_drawTexture2d",
                pipeline: ctx.pipeline({
                    vert: VERT,
                    frag: TEXTURE_2D_FRAG,
                    ...pipelineOptions
                }),
                attributes,
                indices
            };
            const drawTextureCubeCmd = {
                name: "gui_drawTextureCube",
                pipeline: ctx.pipeline({
                    vert: VERT,
                    frag: TEXTURE_CUBE_FRAG,
                    ...pipelineOptions
                }),
                attributes,
                indices,
                uniforms: {
                    uFlipEnvMap: 1
                }
            };
            this.drawTexture2d = ({ texture, rect, flipY })=>{
                if (flipY) [rect[1], rect[3]] = [
                    rect[3],
                    rect[1]
                ];
                ctx.submit(drawTexture2dCmd, {
                    viewport: this.viewport,
                    uniforms: {
                        uTexture: texture,
                        uTextureEncoding: texture.encoding,
                        uViewport: this.viewport,
                        uRect: rect
                    }
                });
            };
            this.drawTextureCube = ({ texture, rect, level, flipEnvMap })=>{
                ctx.submit(drawTextureCubeCmd, {
                    viewport: this.viewport,
                    uniforms: {
                        uTexture: texture,
                        uTextureEncoding: texture.encoding,
                        uViewport: this.viewport,
                        uRect: rect,
                        uLevel: level,
                        uFlipEnvMap: flipEnvMap || 1
                    }
                });
            };
        } else {
            this.drawTexture2d = ({ texture, rect, flipY })=>{
                const x = rect[0] + this.x * pixelRatio;
                const y = rect[1] + this.y * pixelRatio;
                const width = rect[2] - rect[0];
                const height = rect[3] - rect[1];
                ctx.save();
                ctx.translate(x + width / 2, y + height / 2);
                if (flipY) ctx.scale(1, -1);
                ctx.drawImage(texture, -width / 2, -height / 2, width, height);
                ctx.restore();
            };
        }
        if (overlay) {
            this.overlay = {
                container: document.createElement("div"),
                initialPointerEvents: this.canvas.style.pointerEvents
            };
            this.canvas.style.pointerEvents = "none";
            this.canvas.after(this.overlay.container);
        } else {
            this.canvas.addEventListener("pointerdown", this.onPointerDown.bind(this));
            this.canvas.addEventListener("pointermove", this.onPointerMove.bind(this));
            this.canvas.addEventListener("pointerup", this.onPointerUp.bind(this));
        }
        window.addEventListener("keydown", this.onKeyDown.bind(this));
    }
    // Helpers
    setControlValue(value) {
        if (isArrayLike(value)) {
            value.forEach((v, index)=>this.activeControl.contextObject[this.activeControl.attributeName][index] = value[index]);
        } else {
            this.activeControl.contextObject[this.activeControl.attributeName] = value;
        }
        if (this.activeControl.onChange) {
            this.activeControl.onChange(this.activeControl.contextObject[this.activeControl.attributeName]);
        }
    }
    getImageColor({ data, width }, x, y) {
        return [
            data[(x + y * width) * 4 + 0] / 255,
            data[(x + y * width) * 4 + 1] / 255,
            data[(x + y * width) * 4 + 2] / 255
        ];
    }
    checkPalette(image, aa, aaWidth, aaHeight, mx, my) {
        const iw = image.width;
        const ih = image.height;
        let y = my - aa[0][1];
        const renderedImageHeight = aaWidth * image.aspectRatio;
        const imageStartY = aaHeight - renderedImageHeight;
        if (y > imageStartY && isNaN(this.activeControl.clickedSlider)) {
            const u = (mx - aa[0][0]) / aaWidth;
            const v = (y - imageStartY) / renderedImageHeight;
            const x = Math.floor(iw * u);
            y = Math.floor(ih * v);
            const color = this.getImageColor(image, clamp(x, 0, iw - 1), clamp(y, 0, ih - 1));
            this.setControlValue(color);
            return {
                imageStartY,
                clicked: true
            };
        }
        return {
            imageStartY
        };
    }
    setPointerOffset(event, target = event.currentTarget || event.srcElement) {
        const { left, top } = target.getBoundingClientRect();
        this.pointerOffset[0] = event.clientX - left - this.x;
        this.pointerOffset[1] = event.clientY - top - this.y;
    }
    // Event handlers
    onPointerDown(event) {
        if (!this.enabled) return;
        this.items.forEach((item)=>{
            if (item.type === "text" && item.focus) {
                item.focus = false;
                item.dirty = true;
            }
        });
        this.activeControl = null;
        this.setPointerOffset(event, this.canvas, this.pointerOffset);
        for(let i = 0; i < this.items.length; i++){
            const prevTabs = this.items.filter(({ type }, index)=>index < i && type === "tab");
            const parentTab = prevTabs[prevTabs.length - 1];
            if (parentTab && !parentTab.current && this.items[i].type !== "tab") {
                continue;
            }
            const aa = this.getScaledActiveArea(this.items[i].activeArea);
            if (containsPoint(aa, this.pointerOffset)) {
                this.activeControl = this.items[i];
                this.activeControl.active = true;
                this.activeControl.dirty = true;
                const aaWidth = width(aa);
                const aaHeight = height(aa);
                if (this.activeControl.type === "button") {
                    if (this.activeControl.onClick) this.activeControl.onClick();
                } else if (this.activeControl.type === "tab") {
                    this.activeControl.setActive(true);
                } else if (this.activeControl.type === "toggle") {
                    this.setControlValue(!this.activeControl.contextObject[this.activeControl.attributeName]);
                } else if (this.activeControl.type === "radiolist") {
                    const hitY = this.pointerOffset[1] - aa[0][1];
                    const hitItemIndex = Math.floor(this.activeControl.items.length * hitY / aaHeight);
                    if (hitItemIndex < 0 || hitItemIndex >= this.activeControl.items.length) {
                        continue;
                    }
                    this.setControlValue(this.activeControl.items[hitItemIndex].value);
                } else if (this.activeControl.type === "texturelist") {
                    let clickedItem = null;
                    this.activeControl.items.forEach((item)=>{
                        if (containsPoint(this.getScaledActiveArea(item.activeArea), this.pointerOffset)) {
                            clickedItem = item;
                        }
                    });
                    if (!clickedItem) continue;
                    this.setControlValue(clickedItem.value);
                } else if (this.activeControl.type === "color") {
                    if (this.activeControl.options.palette) {
                        const paletteResult = this.checkPalette(this.activeControl.options.paletteImage, aa, aaWidth, aaHeight, this.pointerOffset[0], this.pointerOffset[1]);
                        if (paletteResult.clicked) {
                            this.activeControl.clickedPalette = true;
                            continue;
                        }
                    }
                } else if (this.activeControl.type === "text") {
                    this.activeControl.focus = true;
                }
                event.stopPropagation();
                this.onPointerMove(event);
                break;
            }
        }
    }
    onPointerMove(event) {
        if (!this.enabled) return;
        this.setPointerOffset(event, this.canvas, this.pointerOffset);
        if (this.activeControl) {
            const aa = this.getScaledActiveArea(this.activeControl.activeArea);
            let value = 0;
            let index = 0;
            const isSlider = this.activeControl.type === "slider";
            const isMultiSlider = this.activeControl.type === "multislider";
            const isColor = this.activeControl.type === "color";
            if (isSlider || isMultiSlider || isColor) {
                const aaWidth = width(aa);
                const aaHeight = height(aa);
                value = (this.pointerOffset[0] - aa[0][0]) / aaWidth;
                value = clamp(value, 0, 1);
                let slidersHeight = aaHeight;
                const numSliders = isMultiSlider ? this.activeControl.getValue().length : this.activeControl.options.alpha ? 4 : 3;
                if (isColor) {
                    if (this.activeControl.options.palette) {
                        const paletteResult = this.checkPalette(this.activeControl.options.paletteImage, aa, aaWidth, aaHeight, this.pointerOffset[0], this.pointerOffset[1]);
                        slidersHeight = paletteResult.imageStartY;
                        if (paletteResult.clicked) {
                            this.activeControl.dirty = true;
                            event.stopPropagation();
                            return;
                        }
                    }
                    if (this.activeControl.clickedPalette) {
                        event.stopPropagation();
                        return;
                    }
                }
                if (isMultiSlider || isColor) {
                    index = Math.floor(numSliders * (this.pointerOffset[1] - aa[0][1]) / slidersHeight);
                    if (!isNaN(this.activeControl.clickedSlider)) {
                        index = this.activeControl.clickedSlider;
                    } else {
                        this.activeControl.clickedSlider = index;
                    }
                }
                this.activeControl.setNormalizedValue(value, index);
                if (this.activeControl.onChange) {
                    this.activeControl.onChange(this.activeControl.contextObject[this.activeControl.attributeName]);
                }
                this.activeControl.dirty = true;
            }
            event.stopPropagation();
        }
    }
    onPointerUp() {
        if (this.activeControl) {
            this.activeControl.active = false;
            this.activeControl.dirty = true;
            this.activeControl.clickedSlider = undefined;
            this.activeControl.clickedPalette = undefined;
            this.activeControl = null;
        }
    }
    onKeyDown(event) {
        const focusedItem = this.items.filter(({ type, focus })=>type === "text" && focus)[0];
        if (!focusedItem) return;
        switch(event.key){
            case "Backspace":
                {
                    const str = focusedItem.contextObject[focusedItem.attributeName];
                    focusedItem.contextObject[focusedItem.attributeName] = str.substr(0, Math.max(0, str.length - 1));
                    focusedItem.dirty = true;
                    if (focusedItem.onChange) {
                        focusedItem.onChange(focusedItem.contextObject[focusedItem.attributeName]);
                    }
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    break;
                }
        }
        const c = event.key.charCodeAt(0);
        if (event.key.length === 1 && c >= 32 && c <= 126) {
            focusedItem.contextObject[focusedItem.attributeName] += event.key;
            focusedItem.dirty = true;
            if (focusedItem.onChange) {
                focusedItem.onChange(focusedItem.contextObject[focusedItem.attributeName]);
            }
            event.stopImmediatePropagation();
            event.preventDefault();
        }
    }
    // Public API
    /**
   * Add a tab control.
   * @param {string} title
   * @param {object} contextObject
   * @param {string} attributeName
   * @param {import("./types.js").GUIControlOptions} [options={}]
   * @param {Function} onChange
   * @returns {GUIControl}
   */ addTab(title, contextObject, attributeName, options = {}, onChange) {
        const gui = this;
        const tab = new GUIControl({
            type: "tab",
            title,
            current: this.items.filter(({ type })=>type === "tab").length === 0,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            contextObject,
            attributeName,
            options,
            onChange,
            setActive () {
                gui.items.filter(({ type })=>type === "tab").forEach((item)=>item.current = item === this);
                let prevValue = null;
                if (contextObject) {
                    prevValue = contextObject[attributeName];
                    contextObject[attributeName] = this.value;
                }
                if (this.onChange) this.onChange(prevValue, this.value);
            }
        });
        this.items.push(tab);
        return tab;
    }
    /**
   * Add a column control with a header.
   * @param {string} title
   * @param {number} [width=this.theme.columnWidth]
   * @returns {GUIControl}
   */ addColumn(title, width = this.theme.columnWidth) {
        const column = new GUIControl({
            width,
            type: "column",
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ]
        });
        this.items.push(column);
        if (title) {
            const ctrl = new GUIControl({
                type: "header",
                title,
                dirty: true,
                activeArea: [
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ]
                ],
                setTitle (title) {
                    this.title = title;
                    this.dirty = true;
                }
            });
            this.items.push(ctrl);
        }
        return column;
    }
    /**
   * Add a header control.
   * @param {string} title
   * @returns {GUIControl}
   */ addHeader(title) {
        const ctrl = new GUIControl({
            type: "header",
            title,
            dirty: true,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            setTitle (title) {
                this.title = title;
                this.dirty = true;
            }
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add some breathing space between controls.
   * @returns {GUIControl}
   */ addSeparator() {
        const ctrl = new GUIControl({
            type: "separator",
            dirty: true,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ]
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a text label. Can be multiple line.
   * @param {string} title
   * @param {import("./types.js").GUIControlOptions} [options={}]
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addLabel("Multiline\nLabel");
   * ```
   */ addLabel(title, options) {
        const ctrl = new GUIControl({
            type: "label",
            title,
            dirty: true,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            setTitle (title) {
                this.title = title;
                this.dirty = true;
            },
            options
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a generic parameter control.
   * @param {string} title
   * @param {object} contextObject
   * @param {string} attributeName
   * @param {import("./types.js").GUIControlOptions} [options={}]
   * @param {Function} onChange
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addParam("Checkbox", State, "rotate");
   *
   * gui.addParam("Text message", State, "text", {}, function (value) {
   *   console.log(value);
   * });
   *
   * gui.addParam("Slider", State, "range", {
   *   min: -Math.PI / 2,
   *   max: Math.PI / 2,
   * });
   *
   * gui.addParam("Multi Slider", State, "position", {
   *   min: 0,
   *   max: 10,
   * });
   *
   * gui.addParam("Color [RGBA]", State, "color");
   *
   * gui.addParam("Texture", State, "texture");
   * gui.addParam("Texture Cube", State, "textureCube");
   * ```
   */ addParam(title, contextObject, attributeName, options = {}, onChange) {
        let ctrl = null;
        options ??= {};
        if (options.min === undefined) options.min = 0;
        if (options.max === undefined) options.max = 1;
        // Check for class property
        const isPexContextParam = hasOwnProperty.call(contextObject[attributeName], "class");
        if (isPexContextParam && contextObject[attributeName].class === "texture") {
            const texture = contextObject[attributeName];
            if (texture.target === this.ctx.gl.TEXTURE_CUBE_MAP) {
                ctrl = new GUIControl({
                    type: "textureCube",
                    title,
                    contextObject,
                    attributeName,
                    texture,
                    options: options || {
                        flipEnvMap: 1
                    },
                    activeArea: [
                        [
                            0,
                            0
                        ],
                        [
                            0,
                            0
                        ]
                    ],
                    dirty: true
                });
            } else {
                ctrl = new GUIControl({
                    type: "texture2D",
                    title,
                    contextObject,
                    attributeName,
                    texture,
                    options,
                    activeArea: [
                        [
                            0,
                            0
                        ],
                        [
                            0,
                            0
                        ]
                    ],
                    dirty: true
                });
            }
            this.items.push(ctrl);
            return ctrl;
        } else if (contextObject[attributeName] === false || contextObject[attributeName] === true) {
            ctrl = new GUIControl({
                type: "toggle",
                title,
                contextObject,
                attributeName,
                activeArea: [
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ]
                ],
                options,
                onChange,
                dirty: true
            });
            this.items.push(ctrl);
            return ctrl;
        } else if (!isNaN(contextObject[attributeName])) {
            ctrl = new GUIControl({
                type: "slider",
                title,
                contextObject,
                attributeName,
                activeArea: [
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ]
                ],
                options,
                onChange,
                dirty: true
            });
            this.items.push(ctrl);
            return ctrl;
        } else if (isArrayLike(contextObject[attributeName]) && options && options.type === "color") {
            ctrl = new GUIControl({
                type: "color",
                title,
                contextObject,
                attributeName,
                colorSpace: options.colorSpace || "HSL",
                activeArea: [
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ]
                ],
                options,
                onChange,
                dirty: true
            });
            this.items.push(ctrl);
            return ctrl;
        } else if (isArrayLike(contextObject[attributeName])) {
            ctrl = new GUIControl({
                type: "multislider",
                title,
                contextObject,
                attributeName,
                activeArea: [
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ]
                ],
                options,
                onChange,
                dirty: true
            });
            this.items.push(ctrl);
            return ctrl;
        } else if (typeof contextObject[attributeName] === "string") {
            ctrl = new GUIControl({
                type: "text",
                title,
                contextObject,
                attributeName,
                activeArea: [
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ]
                ],
                options,
                onChange,
                dirty: true
            });
            this.items.push(ctrl);
            return ctrl;
        }
    }
    /**
   * Add a clickable button.
   * @param {string} title
   * @param {Function} onClick
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addButton("Button", () => {
   *   console.log("Called back");
   * });
   * ```
   */ addButton(title, onClick) {
        const ctrl = new GUIControl({
            type: "button",
            title,
            onClick,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            dirty: true,
            options: {}
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a radio list with options.
   * @param {string} title
   * @param {object} contextObject
   * @param {string} attributeName
   * @param {Array.<{ name: string, value: number }>} items
   * @param {Function} onChange
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addRadioList(
   *   "Radio list",
   *   State,
   *   "currentRadioListChoice",
   *   ["Choice 1", "Choice 2", "Choice 3"].map((name, value) => ({
   *     name,
   *     value,
   *   }))
   * );
   * ```
   */ addRadioList(title, contextObject, attributeName, items, onChange) {
        const ctrl = new GUIControl({
            type: "radiolist",
            title,
            contextObject,
            attributeName,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            items,
            onChange,
            dirty: true
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a texture visualiser and selector for multiple textures (from pex-context) or images.
   * @param {string} title
   * @param {object} contextObject
   * @param {string} attributeName
   * @param {Array.<{ texture: import("pex-context").texture | CanvasImageSource, value: number}>} items
   * @param {number} [itemsPerRow=4]
   * @param {Function} onChange
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addTexture2DList("List", State, "currentTexture", textures.map((texture, value) = > ({ texture, value })));
   * ```
   */ addTexture2DList(title, contextObject, attributeName, items, itemsPerRow, onChange) {
        const ctrl = new GUIControl({
            type: "texturelist",
            title,
            contextObject,
            attributeName,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            items,
            itemsPerRow: itemsPerRow || 4,
            onChange,
            dirty: true
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a texture (from pex-context) or image visualiser.
   * Notes: texture cannot be updated once created.
   * @param {string} title
   * @param {import("pex-context").texture | CanvasImageSource} texture
   * @param {import("./types.js").GUIControlOptions} options
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addTexture2D("Single", image);
   * ```
   */ addTexture2D(title, texture, options) {
        const ctrl = new GUIControl({
            type: "texture2D",
            title,
            texture,
            options,
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            dirty: true
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a cube texture visualiser (from pex-context).
   * Notes: texture cannot be updated once created.
   * @param {string} title
   * @param {import("pex-context").textureCube} texture
   * @param {{ flipEnvMap: number, level: number }} options
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addTextureCube("Cube", State.cubeTexture, { level: 2 });
   * ```
   */ addTextureCube(title, texture, options) {
        const ctrl = new GUIControl({
            type: "textureCube",
            title,
            texture,
            options: options || {
                flipEnvMap: 1
            },
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            dirty: true
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a XY graph visualiser from the control values.
   * @param {string} title
   * @param {import("./types.js").GUIControlOptions} options
   * @returns {GUIControl}
   *
   * @example
   * ```js
   * gui.addGraph("Sin", {
   *   interval: 500,
   *   t: 0,
   *   update(item) {
   *     item.options.t += 0.01;
   *   },
   *   redraw(item) {
   *     item.values.push(+Math.sin(item.options.t).toFixed(3));
   *   },
   * });
   * ```
   */ addGraph(title, options) {
        const ctrl = new GUIControl({
            type: "graph",
            title,
            options: {
                format: (value)=>value,
                ...options
            },
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            dirty: true,
            prev: 0,
            values: []
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Add a FPS counter. Need "gui.draw()" to be called on frame.
   * @returns {GUIControl}
   */ addFPSMeeter() {
        const ctrl = this.addGraph("FPS", {
            time: {
                now: 0,
                frames: -1,
                fps: 0,
                fpsTime: 0,
                fpsFrames: 0,
                update (now) {
                    const delta = now - this.now;
                    this.now = now;
                    this.frames++;
                    if (this.fpsTime > 1000) {
                        this.fps = Math.floor(this.fpsFrames / (this.fpsTime / 1000) * 10) / 10;
                        this.fpsTime = 0;
                        this.fpsFrames = 0;
                    } else {
                        this.fpsTime += delta;
                        this.fpsFrames++;
                    }
                }
            },
            interval: 1000,
            min: 0,
            update (item, now) {
                item.options.time.update(now);
            },
            redraw (item) {
                item.values.push(item.options.time.fps);
            },
            format: (value)=>Number.isFinite(value) ? Math.round(value) : ""
        });
        return ctrl;
    }
    /**
   * Add an updatable object stats visualiser.
   * @param {string} title
   * @param {object} [options] An object with an update() function to update control.stats.
   * @returns {GUIControl}
   */ addStats(title, options) {
        const ctrl = new GUIControl({
            type: "stats",
            title: title ?? "STATS",
            activeArea: [
                [
                    0,
                    0
                ],
                [
                    0,
                    0
                ]
            ],
            dirty: true,
            ctx: this.ctx,
            stats: {},
            prev: 0,
            options: options || {
                update (item) {
                    Object.assign(item.stats, Object.fromEntries(Object.entries(item.ctx?.stats || {}).map(([k, v])=>[
                            k,
                            `${v.alive} / ${v.total}`
                        ])));
                }
            }
        });
        this.items.push(ctrl);
        return ctrl;
    }
    /**
   * Remove controls
   * @param {GUIControl | GUIControl[]} items
   */ remove(items) {
        items = Array.isArray(items) ? items : [
            items
        ];
        this.items = this.items.filter((item)=>{
            const itemToRemove = items.find((i)=>i === item);
            if (itemToRemove) itemToRemove.dispose?.();
            return !itemToRemove;
        });
    }
    /**
   * Move a control after another
   * @param {GUIControl} item
   * @param {GUIControl} targetItem
   */ moveAfter(item, targetItem) {
        const fromIndex = this.items.findIndex((i)=>i === item);
        const toIndex = this.items.findIndex((i)=>i === targetItem);
        if (fromIndex !== -1 && toIndex !== -1) {
            const [item] = this.items.splice(fromIndex, 1);
            this.items.splice(toIndex + 1, 0, item);
        }
    }
    // Update
    isAnyItemDirty(items) {
        let dirty = false;
        items.forEach((item)=>{
            if (item.dirty) {
                item.dirty = false;
                dirty = true;
            }
        });
        return dirty;
    }
    getScaledActiveArea(activeArea) {
        return activeArea.map((a)=>a.map((b)=>b * this.#scale));
    }
    update() {
        const now = performance.now();
        for(let i = 0; i < this.items.length; i++){
            const item = this.items[i];
            if (item.options && (item.options.update || Number.isFinite(item.options.interval))) {
                item.prev ??= 0;
                item.options.update?.(item, now);
                const dt = now - item.prev;
                if (dt > (item.options.interval ?? 2000)) {
                    item.prev = now;
                    item.options.redraw?.(item);
                    item.dirty = true;
                }
            }
        }
    }
    // Draw
    getScale() {
        return this.canvas.height / this.canvas.clientHeight;
    }
    initOverlayItem(item) {
        const overlayItem = document.createElement("div");
        Object.assign(overlayItem.style, {
            position: "absolute",
            pointerEvents: "all"
        });
        overlayItem.addEventListener("pointerdown", this.onPointerDown.bind(this));
        overlayItem.addEventListener("pointermove", this.onPointerMove.bind(this));
        overlayItem.addEventListener("pointerup", this.onPointerUp.bind(this));
        item.dispose = ()=>{
            overlayItem.removeEventListener("pointerdown", this.onPointerDown);
            overlayItem.removeEventListener("pointermove", this.onPointerMove);
            overlayItem.removeEventListener("pointerup", this.onPointerUp);
            overlayItem.remove();
        };
        this.overlay.container.appendChild(overlayItem);
        item.overlayItem = overlayItem;
    }
    updateOverlayItem({ activeArea, overlayItem }) {
        const scaledActiveArea = this.getScaledActiveArea(activeArea);
        Object.assign(overlayItem.style, {
            left: `${this.x + scaledActiveArea[0][0]}px`,
            top: `${this.y + scaledActiveArea[0][1]}px`,
            width: `${width(scaledActiveArea)}px`,
            height: `${height(scaledActiveArea)}px`
        });
    }
    /**
   * Renders the GUI. Should be called at the end of the frame.
   */ draw() {
        if (!this.enabled || this.items.length === 0) return;
        this.update();
        const [W, H] = this.size;
        let resized = false;
        if (W !== this.viewport[2] || H !== this.viewport[3]) {
            this.viewport[2] = W;
            this.viewport[3] = H;
            resized = true;
        }
        const texture = this.renderer.getTexture();
        const canvasScale = this.getScale();
        const rendererWidth = texture.width / this.renderer.pixelRatio;
        const rendererHeight = texture.height / this.renderer.pixelRatio;
        if (this.isAnyItemDirty(this.items) || resized || this.renderer.dirty) {
            this.renderer.draw(this.items);
            if (this.responsive) {
                this.#scale = Math.min(Math.min(this.canvas.clientWidth / rendererWidth, this.canvas.clientHeight / rendererHeight), this.scale);
            } else {
                this.#scale = this.scale;
            }
            if (this.overlay) {
                const { left, top, width: width$1, height: height$1 } = this.canvas.getBoundingClientRect();
                Object.assign(this.overlay.container.style, {
                    position: "fixed",
                    pointerEvents: "none",
                    left: `${this.x + left + window.scrollX}px`,
                    top: `${this.y + top + window.scrollY}px`,
                    width: `${width$1}px`,
                    height: `${height$1}px`
                });
                for(let i = 0; i < this.items.length; i++){
                    const item = this.items[i];
                    if (item.activeArea && width(item.activeArea) && height(item.activeArea)) {
                        if (!item.overlayItem) this.initOverlayItem(item);
                        this.updateOverlayItem(item);
                    }
                }
            }
        }
        this.drawTexture2d({
            texture,
            rect: [
                0,
                0,
                canvasScale * this.#scale * rendererWidth || 2,
                canvasScale * this.#scale * rendererHeight || 2
            ]
        });
        this.drawTextures();
    }
    drawTextures() {
        const items = this.items;
        const tabs = items.filter(({ type })=>type === "tab");
        for(let i = 0; i < this.items.length; i++){
            const item = this.items[i];
            if (tabs.length > 0) {
                const prevTabs = items.filter(({ type }, index)=>index < i && type === "tab");
                const parentTab = prevTabs[prevTabs.length - 1];
                if (parentTab && !parentTab.current) {
                    continue;
                }
            }
            const scale = this.#scale * this.getScale();
            let bounds = [];
            const drawTexture = ({ activeArea, texture })=>{
                // we are trying to match flipped gui texture which 0,0 starts at the top with window coords that have 0,0 at the bottom
                bounds = [
                    activeArea[0][0] * scale,
                    activeArea[1][1] * scale,
                    activeArea[1][0] * scale,
                    activeArea[0][1] * scale
                ];
                const flipY = item.options?.flipY;
                if (texture.flipY) {
                    [bounds[1], bounds[3]] = [
                        bounds[3],
                        bounds[1]
                    ];
                }
                this.drawTexture2d({
                    texture,
                    rect: bounds,
                    flipY
                });
            };
            if (item.type === "texture2D") {
                drawTexture(item);
            } else if (item.type === "texturelist") {
                item.items.forEach(drawTexture);
            } else if (item.type === "textureCube") {
                bounds = [
                    item.activeArea[0][0] * scale,
                    item.activeArea[1][1] * scale,
                    item.activeArea[1][0] * scale,
                    item.activeArea[0][1] * scale
                ];
                this.drawTextureCube({
                    texture: item.contextObject ? item.contextObject[item.attributeName] : item.texture,
                    rect: bounds,
                    level: item.options && item.options.level !== undefined ? item.options.level : 0,
                    flipEnvMap: item.options.flipEnvMap
                });
            }
        }
    }
    /**
   * Retrieve a serialized value of the current GUI's state.
   * @returns {object}
   */ serialize() {
        return Object.fromEntries(this.items.map((item)=>[
                item.title,
                item.getSerializedValue()
            ]));
    }
    /**
   * Deserialize a previously serialized data state GUI's state.
   * @param {object} data
   */ deserialize(data) {
        this.items.forEach((item)=>{
            if (data[item.title] !== undefined) {
                item.setSerializedValue(data[item.title]);
                item.dirty = true;
            }
        });
    }
    /**
   * Remove events listeners, empty list of controls and dispose of the gui's resources.
   */ dispose() {
        if (this.overlay) {
            this.canvas.style.pointerEvents = this.overlay.initialPointerEvents;
            this.overlay.container.remove();
        } else {
            this.canvas.removeEventListener("pointerdown", this.onPointerDown);
            this.canvas.removeEventListener("pointermove", this.onPointerMove);
            this.canvas.removeEventListener("pointerup", this.onPointerUp);
            window.removeEventListener("keydown", this.onKeyDown);
        }
        for(let i = 0; i < this.items.length; i++){
            this.items[i].dispose?.();
        }
        this.items = [];
        this.renderer.dispose();
    }
}
/**
 * @alias module:pex-gui.default
 * @param {import("./types.js").ctx | CanvasRenderingContext2D} ctx
 * @param {import("./types.js").GUIOptions} opts
 * @returns {GUI}
 */ function createGUI(ctx, opts) {
    return new GUI(ctx, opts);
}

export { DEFAULT_THEME, index as Renderers, createGUI as default };
