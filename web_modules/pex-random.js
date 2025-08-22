import { r as require$$0, g as getDefaultExportFromCjs } from './_chunks/polyfills-Ci6ALveU.js';

var alea$2 = {exports: {}};

var alea$1 = alea$2.exports;
(function(module) {
    // A port of an algorithm by Johannes Baagøe <baagoe@baagoe.com>, 2010
    // http://baagoe.com/en/RandomMusings/javascript/
    // https://github.com/nquinlan/better-random-numbers-for-javascript-mirror
    // Original work is under MIT license -
    // Copyright (C) 2010 by Johannes Baagøe <baagoe@baagoe.org>
    //
    // Permission is hereby granted, free of charge, to any person obtaining a copy
    // of this software and associated documentation files (the "Software"), to deal
    // in the Software without restriction, including without limitation the rights
    // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    // copies of the Software, and to permit persons to whom the Software is
    // furnished to do so, subject to the following conditions:
    //
    // The above copyright notice and this permission notice shall be included in
    // all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    // THE SOFTWARE.
    (function(global, module, define) {
        function Alea(seed) {
            var me = this, mash = Mash();
            me.next = function() {
                var t = 2091639 * me.s0 + me.c * 2.3283064365386963e-10; // 2^-32
                me.s0 = me.s1;
                me.s1 = me.s2;
                return me.s2 = t - (me.c = t | 0);
            };
            // Apply the seeding algorithm from Baagoe.
            me.c = 1;
            me.s0 = mash(' ');
            me.s1 = mash(' ');
            me.s2 = mash(' ');
            me.s0 -= mash(seed);
            if (me.s0 < 0) {
                me.s0 += 1;
            }
            me.s1 -= mash(seed);
            if (me.s1 < 0) {
                me.s1 += 1;
            }
            me.s2 -= mash(seed);
            if (me.s2 < 0) {
                me.s2 += 1;
            }
            mash = null;
        }
        function copy(f, t) {
            t.c = f.c;
            t.s0 = f.s0;
            t.s1 = f.s1;
            t.s2 = f.s2;
            return t;
        }
        function impl(seed, opts) {
            var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
            prng.int32 = function() {
                return xg.next() * 0x100000000 | 0;
            };
            prng.double = function() {
                return prng() + (prng() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
            };
            prng.quick = prng;
            if (state) {
                if (typeof state == 'object') copy(state, xg);
                prng.state = function() {
                    return copy(xg, {});
                };
            }
            return prng;
        }
        function Mash() {
            var n = 0xefc8249d;
            var mash = function(data) {
                data = String(data);
                for(var i = 0; i < data.length; i++){
                    n += data.charCodeAt(i);
                    var h = 0.02519603282416938 * n;
                    n = h >>> 0;
                    h -= n;
                    h *= n;
                    n = h >>> 0;
                    h -= n;
                    n += h * 0x100000000; // 2^32
                }
                return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
            };
            return mash;
        }
        if (module && module.exports) {
            module.exports = impl;
        } else {
            this.alea = impl;
        }
    })(alea$1, module);
})(alea$2);
var aleaExports = alea$2.exports;

var xor128$2 = {exports: {}};

var xor128$1 = xor128$2.exports;
(function(module) {
    // A Javascript implementaion of the "xor128" prng algorithm by
    // George Marsaglia.  See http://www.jstatsoft.org/v08/i14/paper
    (function(global, module, define) {
        function XorGen(seed) {
            var me = this, strseed = '';
            me.x = 0;
            me.y = 0;
            me.z = 0;
            me.w = 0;
            // Set up generator function.
            me.next = function() {
                var t = me.x ^ me.x << 11;
                me.x = me.y;
                me.y = me.z;
                me.z = me.w;
                return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
            };
            if (seed === (seed | 0)) {
                // Integer seed.
                me.x = seed;
            } else {
                // String seed.
                strseed += seed;
            }
            // Mix in string seed, then discard an initial batch of 64 values.
            for(var k = 0; k < strseed.length + 64; k++){
                me.x ^= strseed.charCodeAt(k) | 0;
                me.next();
            }
        }
        function copy(f, t) {
            t.x = f.x;
            t.y = f.y;
            t.z = f.z;
            t.w = f.w;
            return t;
        }
        function impl(seed, opts) {
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
                return (xg.next() >>> 0) / 0x100000000;
            };
            prng.double = function() {
                do {
                    var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 0x100000000, result = (top + bot) / (1 << 21);
                }while (result === 0);
                return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
                if (typeof state == 'object') copy(state, xg);
                prng.state = function() {
                    return copy(xg, {});
                };
            }
            return prng;
        }
        if (module && module.exports) {
            module.exports = impl;
        } else {
            this.xor128 = impl;
        }
    })(xor128$1, module);
})(xor128$2);
var xor128Exports = xor128$2.exports;

var xorwow$2 = {exports: {}};

var xorwow$1 = xorwow$2.exports;
(function(module) {
    // A Javascript implementaion of the "xorwow" prng algorithm by
    // George Marsaglia.  See http://www.jstatsoft.org/v08/i14/paper
    (function(global, module, define) {
        function XorGen(seed) {
            var me = this, strseed = '';
            // Set up generator function.
            me.next = function() {
                var t = me.x ^ me.x >>> 2;
                me.x = me.y;
                me.y = me.z;
                me.z = me.w;
                me.w = me.v;
                return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
            };
            me.x = 0;
            me.y = 0;
            me.z = 0;
            me.w = 0;
            me.v = 0;
            if (seed === (seed | 0)) {
                // Integer seed.
                me.x = seed;
            } else {
                // String seed.
                strseed += seed;
            }
            // Mix in string seed, then discard an initial batch of 64 values.
            for(var k = 0; k < strseed.length + 64; k++){
                me.x ^= strseed.charCodeAt(k) | 0;
                if (k == strseed.length) {
                    me.d = me.x << 10 ^ me.x >>> 4;
                }
                me.next();
            }
        }
        function copy(f, t) {
            t.x = f.x;
            t.y = f.y;
            t.z = f.z;
            t.w = f.w;
            t.v = f.v;
            t.d = f.d;
            return t;
        }
        function impl(seed, opts) {
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
                return (xg.next() >>> 0) / 0x100000000;
            };
            prng.double = function() {
                do {
                    var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 0x100000000, result = (top + bot) / (1 << 21);
                }while (result === 0);
                return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
                if (typeof state == 'object') copy(state, xg);
                prng.state = function() {
                    return copy(xg, {});
                };
            }
            return prng;
        }
        if (module && module.exports) {
            module.exports = impl;
        } else {
            this.xorwow = impl;
        }
    })(xorwow$1, module);
})(xorwow$2);
var xorwowExports = xorwow$2.exports;

var xorshift7$2 = {exports: {}};

var xorshift7$1 = xorshift7$2.exports;
(function(module) {
    // A Javascript implementaion of the "xorshift7" algorithm by
    // François Panneton and Pierre L'ecuyer:
    // "On the Xorgshift Random Number Generators"
    // http://saluc.engr.uconn.edu/refs/crypto/rng/panneton05onthexorshift.pdf
    (function(global, module, define) {
        function XorGen(seed) {
            var me = this;
            // Set up generator function.
            me.next = function() {
                // Update xor generator.
                var X = me.x, i = me.i, t, v;
                t = X[i];
                t ^= t >>> 7;
                v = t ^ t << 24;
                t = X[i + 1 & 7];
                v ^= t ^ t >>> 10;
                t = X[i + 3 & 7];
                v ^= t ^ t >>> 3;
                t = X[i + 4 & 7];
                v ^= t ^ t << 7;
                t = X[i + 7 & 7];
                t = t ^ t << 13;
                v ^= t ^ t << 9;
                X[i] = v;
                me.i = i + 1 & 7;
                return v;
            };
            function init(me, seed) {
                var j, X = [];
                if (seed === (seed | 0)) {
                    // Seed state array using a 32-bit integer.
                    X[0] = seed;
                } else {
                    // Seed state using a string.
                    seed = '' + seed;
                    for(j = 0; j < seed.length; ++j){
                        X[j & 7] = X[j & 7] << 15 ^ seed.charCodeAt(j) + X[j + 1 & 7] << 13;
                    }
                }
                // Enforce an array length of 8, not all zeroes.
                while(X.length < 8)X.push(0);
                for(j = 0; j < 8 && X[j] === 0; ++j);
                if (j == 8) X[7] = -1;
                else X[j];
                me.x = X;
                me.i = 0;
                // Discard an initial 256 values.
                for(j = 256; j > 0; --j){
                    me.next();
                }
            }
            init(me, seed);
        }
        function copy(f, t) {
            t.x = f.x.slice();
            t.i = f.i;
            return t;
        }
        function impl(seed, opts) {
            if (seed == null) seed = +new Date;
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
                return (xg.next() >>> 0) / 0x100000000;
            };
            prng.double = function() {
                do {
                    var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 0x100000000, result = (top + bot) / (1 << 21);
                }while (result === 0);
                return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
                if (state.x) copy(state, xg);
                prng.state = function() {
                    return copy(xg, {});
                };
            }
            return prng;
        }
        if (module && module.exports) {
            module.exports = impl;
        } else {
            this.xorshift7 = impl;
        }
    })(xorshift7$1, module);
})(xorshift7$2);
var xorshift7Exports = xorshift7$2.exports;

var xor4096$2 = {exports: {}};

var xor4096$1 = xor4096$2.exports;
(function(module) {
    // A Javascript implementaion of Richard Brent's Xorgens xor4096 algorithm.
    //
    // This fast non-cryptographic random number generator is designed for
    // use in Monte-Carlo algorithms. It combines a long-period xorshift
    // generator with a Weyl generator, and it passes all common batteries
    // of stasticial tests for randomness while consuming only a few nanoseconds
    // for each prng generated.  For background on the generator, see Brent's
    // paper: "Some long-period random number generators using shifts and xors."
    // http://arxiv.org/pdf/1004.3115v1.pdf
    //
    // Usage:
    //
    // var xor4096 = require('xor4096');
    // random = xor4096(1);                        // Seed with int32 or string.
    // assert.equal(random(), 0.1520436450538547); // (0, 1) range, 53 bits.
    // assert.equal(random.int32(), 1806534897);   // signed int32, 32 bits.
    //
    // For nonzero numeric keys, this impelementation provides a sequence
    // identical to that by Brent's xorgens 3 implementaion in C.  This
    // implementation also provides for initalizing the generator with
    // string seeds, or for saving and restoring the state of the generator.
    //
    // On Chrome, this prng benchmarks about 2.1 times slower than
    // Javascript's built-in Math.random().
    (function(global, module, define) {
        function XorGen(seed) {
            var me = this;
            // Set up generator function.
            me.next = function() {
                var w = me.w, X = me.X, i = me.i, t, v;
                // Update Weyl generator.
                me.w = w = w + 0x61c88647 | 0;
                // Update xor generator.
                v = X[i + 34 & 127];
                t = X[i = i + 1 & 127];
                v ^= v << 13;
                t ^= t << 17;
                v ^= v >>> 15;
                t ^= t >>> 12;
                // Update Xor generator array state.
                v = X[i] = v ^ t;
                me.i = i;
                // Result is the combination.
                return v + (w ^ w >>> 16) | 0;
            };
            function init(me, seed) {
                var t, v, i, j, w, X = [], limit = 128;
                if (seed === (seed | 0)) {
                    // Numeric seeds initialize v, which is used to generates X.
                    v = seed;
                    seed = null;
                } else {
                    // String seeds are mixed into v and X one character at a time.
                    seed = seed + '\0';
                    v = 0;
                    limit = Math.max(limit, seed.length);
                }
                // Initialize circular array and weyl value.
                for(i = 0, j = -32; j < limit; ++j){
                    // Put the unicode characters into the array, and shuffle them.
                    if (seed) v ^= seed.charCodeAt((j + 32) % seed.length);
                    // After 32 shuffles, take v as the starting w value.
                    if (j === 0) w = v;
                    v ^= v << 10;
                    v ^= v >>> 15;
                    v ^= v << 4;
                    v ^= v >>> 13;
                    if (j >= 0) {
                        w = w + 0x61c88647 | 0; // Weyl.
                        t = X[j & 127] ^= v + w; // Combine xor and weyl to init array.
                        i = 0 == t ? i + 1 : 0; // Count zeroes.
                    }
                }
                // We have detected all zeroes; make the key nonzero.
                if (i >= 128) {
                    X[(seed && seed.length || 0) & 127] = -1;
                }
                // Run the generator 512 times to further mix the state before using it.
                // Factoring this as a function slows the main generator, so it is just
                // unrolled here.  The weyl generator is not advanced while warming up.
                i = 127;
                for(j = 4 * 128; j > 0; --j){
                    v = X[i + 34 & 127];
                    t = X[i = i + 1 & 127];
                    v ^= v << 13;
                    t ^= t << 17;
                    v ^= v >>> 15;
                    t ^= t >>> 12;
                    X[i] = v ^ t;
                }
                // Storing state as object members is faster than using closure variables.
                me.w = w;
                me.X = X;
                me.i = i;
            }
            init(me, seed);
        }
        function copy(f, t) {
            t.i = f.i;
            t.w = f.w;
            t.X = f.X.slice();
            return t;
        }
        function impl(seed, opts) {
            if (seed == null) seed = +new Date;
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
                return (xg.next() >>> 0) / 0x100000000;
            };
            prng.double = function() {
                do {
                    var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 0x100000000, result = (top + bot) / (1 << 21);
                }while (result === 0);
                return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
                if (state.X) copy(state, xg);
                prng.state = function() {
                    return copy(xg, {});
                };
            }
            return prng;
        }
        if (module && module.exports) {
            module.exports = impl;
        } else {
            this.xor4096 = impl;
        }
    })(xor4096$1, module);
})(xor4096$2);
var xor4096Exports = xor4096$2.exports;

var tychei$2 = {exports: {}};

var tychei$1 = tychei$2.exports;
(function(module) {
    // A Javascript implementaion of the "Tyche-i" prng algorithm by
    // Samuel Neves and Filipe Araujo.
    // See https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf
    (function(global, module, define) {
        function XorGen(seed) {
            var me = this, strseed = '';
            // Set up generator function.
            me.next = function() {
                var b = me.b, c = me.c, d = me.d, a = me.a;
                b = b << 25 ^ b >>> 7 ^ c;
                c = c - d | 0;
                d = d << 24 ^ d >>> 8 ^ a;
                a = a - b | 0;
                me.b = b = b << 20 ^ b >>> 12 ^ c;
                me.c = c = c - d | 0;
                me.d = d << 16 ^ c >>> 16 ^ a;
                return me.a = a - b | 0;
            };
            /* The following is non-inverted tyche, which has better internal
	   * bit diffusion, but which is about 25% slower than tyche-i in JS.
	  me.next = function() {
	    var a = me.a, b = me.b, c = me.c, d = me.d;
	    a = (me.a + me.b | 0) >>> 0;
	    d = me.d ^ a; d = d << 16 ^ d >>> 16;
	    c = me.c + d | 0;
	    b = me.b ^ c; b = b << 12 ^ d >>> 20;
	    me.a = a = a + b | 0;
	    d = d ^ a; me.d = d = d << 8 ^ d >>> 24;
	    me.c = c = c + d | 0;
	    b = b ^ c;
	    return me.b = (b << 7 ^ b >>> 25);
	  }
	  */ me.a = 0;
            me.b = 0;
            me.c = 2654435769 | 0;
            me.d = 1367130551;
            if (seed === Math.floor(seed)) {
                // Integer seed.
                me.a = seed / 0x100000000 | 0;
                me.b = seed | 0;
            } else {
                // String seed.
                strseed += seed;
            }
            // Mix in string seed, then discard an initial batch of 64 values.
            for(var k = 0; k < strseed.length + 20; k++){
                me.b ^= strseed.charCodeAt(k) | 0;
                me.next();
            }
        }
        function copy(f, t) {
            t.a = f.a;
            t.b = f.b;
            t.c = f.c;
            t.d = f.d;
            return t;
        }
        function impl(seed, opts) {
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
                return (xg.next() >>> 0) / 0x100000000;
            };
            prng.double = function() {
                do {
                    var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 0x100000000, result = (top + bot) / (1 << 21);
                }while (result === 0);
                return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
                if (typeof state == 'object') copy(state, xg);
                prng.state = function() {
                    return copy(xg, {});
                };
            }
            return prng;
        }
        if (module && module.exports) {
            module.exports = impl;
        } else {
            this.tychei = impl;
        }
    })(tychei$1, module);
})(tychei$2);
var tycheiExports = tychei$2.exports;

var seedrandom$3 = {exports: {}};

var seedrandom$2 = seedrandom$3.exports;
(function(module) {
    (function(global, pool, math) {
        //
        // The following constants are related to IEEE 754 limits.
        //
        var width = 256, chunks = 6, digits = 52, rngname = 'random', startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto; // node.js crypto module, initialized at the bottom.
        //
        // seedrandom()
        // This is the seedrandom function described above.
        //
        function seedrandom(seed, options, callback) {
            var key = [];
            options = options == true ? {
                entropy: true
            } : options || {};
            // Flatten the seed string or build one from local entropy if needed.
            var shortseed = mixkey(flatten(options.entropy ? [
                seed,
                tostring(pool)
            ] : seed == null ? autoseed() : seed, 3), key);
            // Use the seed to initialize an ARC4 generator.
            var arc4 = new ARC4(key);
            // This function returns a random double in [0, 1) that contains
            // randomness in every bit of the mantissa of the IEEE 754 value.
            var prng = function() {
                var n = arc4.g(chunks), d = startdenom, x = 0; //   and no 'extra last byte'.
                while(n < significance){
                    n = (n + x) * width; //   shifting numerator and
                    d *= width; //   denominator and generating a
                    x = arc4.g(1); //   new least-significant-byte.
                }
                while(n >= overflow){
                    n /= 2; //   last byte, shift everything
                    d /= 2; //   right using integer math until
                    x >>>= 1; //   we have exactly the desired bits.
                }
                return (n + x) / d; // Form the number within [0, 1).
            };
            prng.int32 = function() {
                return arc4.g(4) | 0;
            };
            prng.quick = function() {
                return arc4.g(4) / 0x100000000;
            };
            prng.double = prng;
            // Mix the randomness into accumulated entropy.
            mixkey(tostring(arc4.S), pool);
            // Calling convention: what to return as a function of prng, seed, is_math.
            return (options.pass || callback || function(prng, seed, is_math_call, state) {
                if (state) {
                    // Load the arc4 state from the given state if it has an S array.
                    if (state.S) {
                        copy(state, arc4);
                    }
                    // Only provide the .state method if requested via options.state.
                    prng.state = function() {
                        return copy(arc4, {});
                    };
                }
                // If called as a method of Math (Math.seedrandom()), mutate
                // Math.random because that is how seedrandom.js has worked since v1.0.
                if (is_math_call) {
                    math[rngname] = prng;
                    return seed;
                } else return prng;
            })(prng, shortseed, 'global' in options ? options.global : this == math, options.state);
        }
        //
        // ARC4
        //
        // An ARC4 implementation.  The constructor takes a key in the form of
        // an array of at most (width) integers that should be 0 <= x < (width).
        //
        // The g(count) method returns a pseudorandom integer that concatenates
        // the next (count) outputs from ARC4.  Its return value is a number x
        // that is in the range 0 <= x < (width ^ count).
        //
        function ARC4(key) {
            var t, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
            // The empty key [] is treated as [0].
            if (!keylen) {
                key = [
                    keylen++
                ];
            }
            // Set up S using the standard key scheduling algorithm.
            while(i < width){
                s[i] = i++;
            }
            for(i = 0; i < width; i++){
                s[i] = s[j = mask & j + key[i % keylen] + (t = s[i])];
                s[j] = t;
            }
            // The "g" method returns the next (count) outputs as one number.
            (me.g = function(count) {
                // Using instance members instead of closure state nearly doubles speed.
                var t, r = 0, i = me.i, j = me.j, s = me.S;
                while(count--){
                    t = s[i = mask & i + 1];
                    r = r * width + s[mask & (s[i] = s[j = mask & j + t]) + (s[j] = t)];
                }
                me.i = i;
                me.j = j;
                return r;
            // For robust unpredictability, the function call below automatically
            // discards an initial batch of values.  This is called RC4-drop[256].
            // See http://google.com/search?q=rsa+fluhrer+response&btnI
            })(width);
        }
        //
        // copy()
        // Copies internal state of ARC4 to or from a plain object.
        //
        function copy(f, t) {
            t.i = f.i;
            t.j = f.j;
            t.S = f.S.slice();
            return t;
        }
        //
        // flatten()
        // Converts an object tree to nested arrays of strings.
        //
        function flatten(obj, depth) {
            var result = [], typ = typeof obj, prop;
            if (depth && typ == 'object') {
                for(prop in obj){
                    try {
                        result.push(flatten(obj[prop], depth - 1));
                    } catch (e) {}
                }
            }
            return result.length ? result : typ == 'string' ? obj : obj + '\0';
        }
        //
        // mixkey()
        // Mixes a string seed into a key that is an array of integers, and
        // returns a shortened string seed that is equivalent to the result key.
        //
        function mixkey(seed, key) {
            var stringseed = seed + '', smear, j = 0;
            while(j < stringseed.length){
                key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
            }
            return tostring(key);
        }
        //
        // autoseed()
        // Returns an object for autoseeding, using window.crypto and Node crypto
        // module if available.
        //
        function autoseed() {
            try {
                var out;
                if (nodecrypto && (out = nodecrypto.randomBytes)) {
                    // The use of 'out' to remember randomBytes makes tight minified code.
                    out = out(width);
                } else {
                    out = new Uint8Array(width);
                    (global.crypto || global.msCrypto).getRandomValues(out);
                }
                return tostring(out);
            } catch (e) {
                var browser = global.navigator, plugins = browser && browser.plugins;
                return [
                    +new Date,
                    global,
                    plugins,
                    global.screen,
                    tostring(pool)
                ];
            }
        }
        //
        // tostring()
        // Converts an array of charcodes to a string
        //
        function tostring(a) {
            return String.fromCharCode.apply(0, a);
        }
        //
        // When seedrandom.js is loaded, we immediately mix a few bits
        // from the built-in RNG into the entropy pool.  Because we do
        // not want to interfere with deterministic PRNG state later,
        // seedrandom will not call math.random on its own again after
        // initialization.
        //
        mixkey(math.random(), pool);
        //
        // Nodejs and AMD support: export the implementation as a module using
        // either convention.
        //
        if (module.exports) {
            module.exports = seedrandom;
            // When in node.js, try using crypto package for autoseeding.
            try {
                nodecrypto = require$$0;
            } catch (ex) {}
        } else {
            // When included as a plain script, set up Math.seedrandom global.
            math['seed' + rngname] = seedrandom;
        }
    // End anonymous scope, and pass initial values.
    })(// global: `self` in browsers (including strict mode and web workers),
    // otherwise `this` in Node and other environments
    typeof self !== 'undefined' ? self : seedrandom$2, [], Math // math: package containing random, pow, and seedrandom
    );
})(seedrandom$3);
var seedrandomExports = seedrandom$3.exports;

// A library of seedable RNGs implemented in Javascript.
//
// Usage:
//
// var seedrandom = require('seedrandom');
// var random = seedrandom(1); // or any seed.
// var x = random();       // 0 <= x < 1.  Every bit is random.
// var x = random.quick(); // 0 <= x < 1.  32 bits of randomness.
// alea, a 53-bit multiply-with-carry generator by Johannes Baagøe.
// Period: ~2^116
// Reported to pass all BigCrush tests.
var alea = aleaExports;
// xor128, a pure xor-shift generator by George Marsaglia.
// Period: 2^128-1.
// Reported to fail: MatrixRank and LinearComp.
var xor128 = xor128Exports;
// xorwow, George Marsaglia's 160-bit xor-shift combined plus weyl.
// Period: 2^192-2^32
// Reported to fail: CollisionOver, SimpPoker, and LinearComp.
var xorwow = xorwowExports;
// xorshift7, by François Panneton and Pierre L'ecuyer, takes
// a different approach: it adds robustness by allowing more shifts
// than Marsaglia's original three.  It is a 7-shift generator
// with 256 bits, that passes BigCrush with no systmatic failures.
// Period 2^256-1.
// No systematic BigCrush failures reported.
var xorshift7 = xorshift7Exports;
// xor4096, by Richard Brent, is a 4096-bit xor-shift with a
// very long period that also adds a Weyl generator. It also passes
// BigCrush with no systematic failures.  Its long period may
// be useful if you have many generators and need to avoid
// collisions.
// Period: 2^4128-2^32.
// No systematic BigCrush failures reported.
var xor4096 = xor4096Exports;
// Tyche-i, by Samuel Neves and Filipe Araujo, is a bit-shifting random
// number generator derived from ChaCha, a modern stream cipher.
// https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf
// Period: ~2^127
// No systematic BigCrush failures reported.
var tychei = tycheiExports;
// The original ARC4-based prng included in this library.
// Period: ~2^1600
var sr = seedrandomExports;
sr.alea = alea;
sr.xor128 = xor128;
sr.xorwow = xorwow;
sr.xorshift7 = xorshift7;
sr.xor4096 = xor4096;
sr.tychei = tychei;
var seedrandom = sr;
var seedrandom$1 = /*@__PURE__*/ getDefaultExportFromCjs(seedrandom);

/*
 * A fast javascript implementation of simplex noise by Jonas Wagner

Based on a speed-improved simplex noise algorithm for 2D, 3D and 4D in Java.
Which is based on example code by Stefan Gustavson (stegu@itn.liu.se).
With Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
Better rank ordering method by Stefan Gustavson in 2012.

 Copyright (c) 2024 Jonas Wagner

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */ // these __PURE__ comments help uglifyjs with dead code removal
//
const SQRT3 = /*#__PURE__*/ Math.sqrt(3.0);
const SQRT5 = /*#__PURE__*/ Math.sqrt(5.0);
const F2 = 0.5 * (SQRT3 - 1.0);
const G2 = (3.0 - SQRT3) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;
const F4 = (SQRT5 - 1.0) / 4.0;
const G4 = (5.0 - SQRT5) / 20.0;
// I'm really not sure why this | 0 (basically a coercion to int)
// is making this faster but I get ~5 million ops/sec more on the
// benchmarks across the board or a ~10% speedup.
const fastFloor = (x)=>Math.floor(x) | 0;
const grad2 = /*#__PURE__*/ new Float64Array([
    1,
    1,
    -1,
    1,
    1,
    -1,
    -1,
    -1,
    1,
    0,
    -1,
    0,
    1,
    0,
    -1,
    0,
    0,
    1,
    0,
    -1,
    0,
    1,
    0,
    -1
]);
// double seems to be faster than single or int's
// probably because most operations are in double precision
const grad3 = /*#__PURE__*/ new Float64Array([
    1,
    1,
    0,
    -1,
    1,
    0,
    1,
    -1,
    0,
    -1,
    -1,
    0,
    1,
    0,
    1,
    -1,
    0,
    1,
    1,
    0,
    -1,
    -1,
    0,
    -1,
    0,
    1,
    1,
    0,
    -1,
    1,
    0,
    1,
    -1,
    0,
    -1,
    -1
]);
// double is a bit quicker here as well
const grad4 = /*#__PURE__*/ new Float64Array([
    0,
    1,
    1,
    1,
    0,
    1,
    1,
    -1,
    0,
    1,
    -1,
    1,
    0,
    1,
    -1,
    -1,
    0,
    -1,
    1,
    1,
    0,
    -1,
    1,
    -1,
    0,
    -1,
    -1,
    1,
    0,
    -1,
    -1,
    -1,
    1,
    0,
    1,
    1,
    1,
    0,
    1,
    -1,
    1,
    0,
    -1,
    1,
    1,
    0,
    -1,
    -1,
    -1,
    0,
    1,
    1,
    -1,
    0,
    1,
    -1,
    -1,
    0,
    -1,
    1,
    -1,
    0,
    -1,
    -1,
    1,
    1,
    0,
    1,
    1,
    1,
    0,
    -1,
    1,
    -1,
    0,
    1,
    1,
    -1,
    0,
    -1,
    -1,
    1,
    0,
    1,
    -1,
    1,
    0,
    -1,
    -1,
    -1,
    0,
    1,
    -1,
    -1,
    0,
    -1,
    1,
    1,
    1,
    0,
    1,
    1,
    -1,
    0,
    1,
    -1,
    1,
    0,
    1,
    -1,
    -1,
    0,
    -1,
    1,
    1,
    0,
    -1,
    1,
    -1,
    0,
    -1,
    -1,
    1,
    0,
    -1,
    -1,
    -1,
    0
]);
/**
 * Creates a 2D noise function
 * @param random the random function that will be used to build the permutation table
 * @returns {NoiseFunction2D}
 */ function createNoise2D(random = Math.random) {
    const perm = buildPermutationTable(random);
    // precalculating this yields a little ~3% performance improvement.
    const permGrad2x = new Float64Array(perm).map((v)=>grad2[v % 12 * 2]);
    const permGrad2y = new Float64Array(perm).map((v)=>grad2[v % 12 * 2 + 1]);
    return function noise2D(x, y) {
        // if(!isFinite(x) || !isFinite(y)) return 0;
        let n0 = 0; // Noise contributions from the three corners
        let n1 = 0;
        let n2 = 0;
        // Skew the input space to determine which simplex cell we're in
        const s = (x + y) * F2; // Hairy factor for 2D
        const i = fastFloor(x + s);
        const j = fastFloor(y + s);
        const t = (i + j) * G2;
        const X0 = i - t; // Unskew the cell origin back to (x,y) space
        const Y0 = j - t;
        const x0 = x - X0; // The x,y distances from the cell origin
        const y0 = y - Y0;
        // For the 2D case, the simplex shape is an equilateral triangle.
        // Determine which simplex we are in.
        let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        } // upper triangle, YX order: (0,0)->(0,1)->(1,1)
        // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
        // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
        // c = (3-sqrt(3))/6
        const x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
        const y2 = y0 - 1.0 + 2.0 * G2;
        // Work out the hashed gradient indices of the three simplex corners
        const ii = i & 255;
        const jj = j & 255;
        // Calculate the contribution from the three corners
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            const gi0 = ii + perm[jj];
            const g0x = permGrad2x[gi0];
            const g0y = permGrad2y[gi0];
            t0 *= t0;
            // n0 = t0 * t0 * (grad2[gi0] * x0 + grad2[gi0 + 1] * y0); // (x,y) of grad3 used for 2D gradient
            n0 = t0 * t0 * (g0x * x0 + g0y * y0);
        }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            const gi1 = ii + i1 + perm[jj + j1];
            const g1x = permGrad2x[gi1];
            const g1y = permGrad2y[gi1];
            t1 *= t1;
            // n1 = t1 * t1 * (grad2[gi1] * x1 + grad2[gi1 + 1] * y1);
            n1 = t1 * t1 * (g1x * x1 + g1y * y1);
        }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            const gi2 = ii + 1 + perm[jj + 1];
            const g2x = permGrad2x[gi2];
            const g2y = permGrad2y[gi2];
            t2 *= t2;
            // n2 = t2 * t2 * (grad2[gi2] * x2 + grad2[gi2 + 1] * y2);
            n2 = t2 * t2 * (g2x * x2 + g2y * y2);
        }
        // Add contributions from each corner to get the final noise value.
        // The result is scaled to return values in the interval [-1,1].
        return 70.0 * (n0 + n1 + n2);
    };
}
/**
 * Creates a 3D noise function
 * @param random the random function that will be used to build the permutation table
 * @returns {NoiseFunction3D}
 */ function createNoise3D(random = Math.random) {
    const perm = buildPermutationTable(random);
    // precalculating these seems to yield a speedup of over 15%
    const permGrad3x = new Float64Array(perm).map((v)=>grad3[v % 12 * 3]);
    const permGrad3y = new Float64Array(perm).map((v)=>grad3[v % 12 * 3 + 1]);
    const permGrad3z = new Float64Array(perm).map((v)=>grad3[v % 12 * 3 + 2]);
    return function noise3D(x, y, z) {
        let n0, n1, n2, n3; // Noise contributions from the four corners
        // Skew the input space to determine which simplex cell we're in
        const s = (x + y + z) * F3; // Very nice and simple skew factor for 3D
        const i = fastFloor(x + s);
        const j = fastFloor(y + s);
        const k = fastFloor(z + s);
        const t = (i + j + k) * G3;
        const X0 = i - t; // Unskew the cell origin back to (x,y,z) space
        const Y0 = j - t;
        const Z0 = k - t;
        const x0 = x - X0; // The x,y,z distances from the cell origin
        const y0 = y - Y0;
        const z0 = z - Z0;
        // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
        // Determine which simplex we are in.
        let i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
        let i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1;
                j1 = 0;
                k1 = 0;
                i2 = 1;
                j2 = 1;
                k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1;
                j1 = 0;
                k1 = 0;
                i2 = 1;
                j2 = 0;
                k2 = 1;
            } else {
                i1 = 0;
                j1 = 0;
                k1 = 1;
                i2 = 1;
                j2 = 0;
                k2 = 1;
            } // Z X Y order
        } else {
            if (y0 < z0) {
                i1 = 0;
                j1 = 0;
                k1 = 1;
                i2 = 0;
                j2 = 1;
                k2 = 1;
            } else if (x0 < z0) {
                i1 = 0;
                j1 = 1;
                k1 = 0;
                i2 = 0;
                j2 = 1;
                k2 = 1;
            } else {
                i1 = 0;
                j1 = 1;
                k1 = 0;
                i2 = 1;
                j2 = 1;
                k2 = 0;
            } // Y X Z order
        }
        // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
        // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
        // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
        // c = 1/6.
        const x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
        const y1 = y0 - j1 + G3;
        const z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
        const y2 = y0 - j2 + 2.0 * G3;
        const z2 = z0 - k2 + 2.0 * G3;
        const x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
        const y3 = y0 - 1.0 + 3.0 * G3;
        const z3 = z0 - 1.0 + 3.0 * G3;
        // Work out the hashed gradient indices of the four simplex corners
        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;
        // Calculate the contribution from the four corners
        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 < 0) n0 = 0.0;
        else {
            const gi0 = ii + perm[jj + perm[kk]];
            t0 *= t0;
            n0 = t0 * t0 * (permGrad3x[gi0] * x0 + permGrad3y[gi0] * y0 + permGrad3z[gi0] * z0);
        }
        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 < 0) n1 = 0.0;
        else {
            const gi1 = ii + i1 + perm[jj + j1 + perm[kk + k1]];
            t1 *= t1;
            n1 = t1 * t1 * (permGrad3x[gi1] * x1 + permGrad3y[gi1] * y1 + permGrad3z[gi1] * z1);
        }
        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 < 0) n2 = 0.0;
        else {
            const gi2 = ii + i2 + perm[jj + j2 + perm[kk + k2]];
            t2 *= t2;
            n2 = t2 * t2 * (permGrad3x[gi2] * x2 + permGrad3y[gi2] * y2 + permGrad3z[gi2] * z2);
        }
        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 < 0) n3 = 0.0;
        else {
            const gi3 = ii + 1 + perm[jj + 1 + perm[kk + 1]];
            t3 *= t3;
            n3 = t3 * t3 * (permGrad3x[gi3] * x3 + permGrad3y[gi3] * y3 + permGrad3z[gi3] * z3);
        }
        // Add contributions from each corner to get the final noise value.
        // The result is scaled to stay just inside [-1,1]
        return 32.0 * (n0 + n1 + n2 + n3);
    };
}
/**
 * Creates a 4D noise function
 * @param random the random function that will be used to build the permutation table
 * @returns {NoiseFunction4D}
 */ function createNoise4D(random = Math.random) {
    const perm = buildPermutationTable(random);
    // precalculating these leads to a ~10% speedup
    const permGrad4x = new Float64Array(perm).map((v)=>grad4[v % 32 * 4]);
    const permGrad4y = new Float64Array(perm).map((v)=>grad4[v % 32 * 4 + 1]);
    const permGrad4z = new Float64Array(perm).map((v)=>grad4[v % 32 * 4 + 2]);
    const permGrad4w = new Float64Array(perm).map((v)=>grad4[v % 32 * 4 + 3]);
    return function noise4D(x, y, z, w) {
        let n0, n1, n2, n3, n4; // Noise contributions from the five corners
        // Skew the (x,y,z,w) space to determine which cell of 24 simplices we're in
        const s = (x + y + z + w) * F4; // Factor for 4D skewing
        const i = fastFloor(x + s);
        const j = fastFloor(y + s);
        const k = fastFloor(z + s);
        const l = fastFloor(w + s);
        const t = (i + j + k + l) * G4; // Factor for 4D unskewing
        const X0 = i - t; // Unskew the cell origin back to (x,y,z,w) space
        const Y0 = j - t;
        const Z0 = k - t;
        const W0 = l - t;
        const x0 = x - X0; // The x,y,z,w distances from the cell origin
        const y0 = y - Y0;
        const z0 = z - Z0;
        const w0 = w - W0;
        // For the 4D case, the simplex is a 4D shape I won't even try to describe.
        // To find out which of the 24 possible simplices we're in, we need to
        // determine the magnitude ordering of x0, y0, z0 and w0.
        // Six pair-wise comparisons are performed between each possible pair
        // of the four coordinates, and the results are used to rank the numbers.
        let rankx = 0;
        let ranky = 0;
        let rankz = 0;
        let rankw = 0;
        if (x0 > y0) rankx++;
        else ranky++;
        if (x0 > z0) rankx++;
        else rankz++;
        if (x0 > w0) rankx++;
        else rankw++;
        if (y0 > z0) ranky++;
        else rankz++;
        if (y0 > w0) ranky++;
        else rankw++;
        if (z0 > w0) rankz++;
        else rankw++;
        // simplex[c] is a 4-vector with the numbers 0, 1, 2 and 3 in some order.
        // Many values of c will never occur, since e.g. x>y>z>w makes x<z, y<w and x<w
        // impossible. Only the 24 indices which have non-zero entries make any sense.
        // We use a thresholding to set the coordinates in turn from the largest magnitude.
        // Rank 3 denotes the largest coordinate.
        // Rank 2 denotes the second largest coordinate.
        // Rank 1 denotes the second smallest coordinate.
        // The integer offsets for the second simplex corner
        const i1 = rankx >= 3 ? 1 : 0;
        const j1 = ranky >= 3 ? 1 : 0;
        const k1 = rankz >= 3 ? 1 : 0;
        const l1 = rankw >= 3 ? 1 : 0;
        // The integer offsets for the third simplex corner
        const i2 = rankx >= 2 ? 1 : 0;
        const j2 = ranky >= 2 ? 1 : 0;
        const k2 = rankz >= 2 ? 1 : 0;
        const l2 = rankw >= 2 ? 1 : 0;
        // The integer offsets for the fourth simplex corner
        const i3 = rankx >= 1 ? 1 : 0;
        const j3 = ranky >= 1 ? 1 : 0;
        const k3 = rankz >= 1 ? 1 : 0;
        const l3 = rankw >= 1 ? 1 : 0;
        // The fifth corner has all coordinate offsets = 1, so no need to compute that.
        const x1 = x0 - i1 + G4; // Offsets for second corner in (x,y,z,w) coords
        const y1 = y0 - j1 + G4;
        const z1 = z0 - k1 + G4;
        const w1 = w0 - l1 + G4;
        const x2 = x0 - i2 + 2.0 * G4; // Offsets for third corner in (x,y,z,w) coords
        const y2 = y0 - j2 + 2.0 * G4;
        const z2 = z0 - k2 + 2.0 * G4;
        const w2 = w0 - l2 + 2.0 * G4;
        const x3 = x0 - i3 + 3.0 * G4; // Offsets for fourth corner in (x,y,z,w) coords
        const y3 = y0 - j3 + 3.0 * G4;
        const z3 = z0 - k3 + 3.0 * G4;
        const w3 = w0 - l3 + 3.0 * G4;
        const x4 = x0 - 1.0 + 4.0 * G4; // Offsets for last corner in (x,y,z,w) coords
        const y4 = y0 - 1.0 + 4.0 * G4;
        const z4 = z0 - 1.0 + 4.0 * G4;
        const w4 = w0 - 1.0 + 4.0 * G4;
        // Work out the hashed gradient indices of the five simplex corners
        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;
        const ll = l & 255;
        // Calculate the contribution from the five corners
        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
        if (t0 < 0) n0 = 0.0;
        else {
            const gi0 = ii + perm[jj + perm[kk + perm[ll]]];
            t0 *= t0;
            n0 = t0 * t0 * (permGrad4x[gi0] * x0 + permGrad4y[gi0] * y0 + permGrad4z[gi0] * z0 + permGrad4w[gi0] * w0);
        }
        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
        if (t1 < 0) n1 = 0.0;
        else {
            const gi1 = ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll + l1]]];
            t1 *= t1;
            n1 = t1 * t1 * (permGrad4x[gi1] * x1 + permGrad4y[gi1] * y1 + permGrad4z[gi1] * z1 + permGrad4w[gi1] * w1);
        }
        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
        if (t2 < 0) n2 = 0.0;
        else {
            const gi2 = ii + i2 + perm[jj + j2 + perm[kk + k2 + perm[ll + l2]]];
            t2 *= t2;
            n2 = t2 * t2 * (permGrad4x[gi2] * x2 + permGrad4y[gi2] * y2 + permGrad4z[gi2] * z2 + permGrad4w[gi2] * w2);
        }
        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
        if (t3 < 0) n3 = 0.0;
        else {
            const gi3 = ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll + l3]]];
            t3 *= t3;
            n3 = t3 * t3 * (permGrad4x[gi3] * x3 + permGrad4y[gi3] * y3 + permGrad4z[gi3] * z3 + permGrad4w[gi3] * w3);
        }
        let t4 = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
        if (t4 < 0) n4 = 0.0;
        else {
            const gi4 = ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]];
            t4 *= t4;
            n4 = t4 * t4 * (permGrad4x[gi4] * x4 + permGrad4y[gi4] * y4 + permGrad4z[gi4] * z4 + permGrad4w[gi4] * w4);
        }
        // Sum up and scale the result to cover the range [-1,1]
        return 27.0 * (n0 + n1 + n2 + n3 + n4);
    };
}
/**
 * Builds a random permutation table.
 * This is exported only for (internal) testing purposes.
 * Do not rely on this export.
 * @private
 */ function buildPermutationTable(random) {
    const tableSize = 512;
    const p = new Uint8Array(tableSize);
    for(let i = 0; i < tableSize / 2; i++){
        p[i] = i;
    }
    for(let i = 0; i < tableSize / 2 - 1; i++){
        const r = i + ~~(random() * (256 - i));
        const aux = p[i];
        p[i] = p[r];
        p[r] = aux;
    }
    for(let i = 256; i < tableSize; i++){
        p[i] = p[i - 256];
    }
    return p;
}

/**
 * @alias pex-random
 */ class Random {
    /**
   * @private
   */ static #instanceCount = 0;
    static{
        /**
   * @private
   * @property {number} NOW Runtime performance.now() value.
   */ this.NOW = performance.now();
    }
    /**
   * Creates an instance of Random.
   * @param {string|number} [seed=Random.NOW + Random.#instanceCount]
   */ constructor(seed = Random.NOW + Random.#instanceCount){
        /**
   * Create an instance of Random.
   * @param {string|number} [seed] If omitted, the global PRNG seed will be used and incremented for each local PRNG.
   * @returns {Random}
   */ this.create = (seed)=>new Random(seed);
        this.seed(seed);
        Random.#instanceCount++;
    }
    /**
   * Set the seed for the random number generator.
   * @param {string} s Seed value
   */ seed(s) {
        this.rng = seedrandom$1(s);
        this.simplex = {
            noise2D: createNoise2D(this.rng),
            noise3D: createNoise3D(this.rng),
            noise4D: createNoise4D(this.rng)
        };
    }
    /**
   * Get a float between min and max. Defaults to:
   * - `0 <= x < 1` if no argument supplied
   * - `0 <= x < max` if only one argument supplied
   * @param {number} [min]
   * @param {number} [max]
   * @returns {number}
   */ float(min, max) {
        if (arguments.length == 0) {
            min = 0;
            max = 1;
        } else if (arguments.length == 1) {
            max = min;
            min = 0;
        }
        return min + (max - min) * this.rng();
    }
    /**
   * Get an int between min and max. Defaults to:
   * - `0 <= x < Number.MAX_SAFE_INTEGER` if no argument supplied
   * - `0 <= x < max` if only one argument supplied
   * @param {number} [min]
   * @param {number} [max]
   * @returns {number}
   */ int(min, max) {
        if (arguments.length == 0) {
            min = 0;
            max = Number.MAX_SAFE_INTEGER;
        } else if (arguments.length == 1) {
            max = min;
            min = 0;
        }
        return Math.floor(this.float(min, max));
    }
    /**
   * Get a vec2 included in a radius.
   * @param {number} [r=1] radius
   * @returns {import("./types.js").vec2}
   */ vec2(r = 1) {
        const x = 2 * this.rng() - 1;
        const y = 2 * this.rng() - 1;
        const rr = this.rng() * r;
        const len = Math.sqrt(x * x + y * y);
        return [
            rr * x / len,
            rr * y / len
        ];
    }
    /**
   * Get a vec3 included in a radius.
   * @param {number} [r=1] radius
   * @returns {import("./types.js").vec3}
   */ vec3(r = 1) {
        const x = 2 * this.rng() - 1;
        const y = 2 * this.rng() - 1;
        const z = 2 * this.rng() - 1;
        const rr = this.rng() * r;
        const len = Math.sqrt(x * x + y * y + z * z);
        return [
            rr * x / len,
            rr * y / len,
            rr * z / len
        ];
    }
    /**
   * Get a vec2 included in a rectangle.
   * @param {number} rect rectangle
   * @returns {import("./types.js").vec2}
   */ vec2InRect(rect) {
        return [
            rect[0][0] + this.rng() * (rect[1][0] - rect[0][0]),
            rect[0][1] + this.rng() * (rect[1][1] - rect[0][1])
        ];
    }
    /**
   * Get a vec3 included in a rectangle bbox.
   * @param {number} bbox rectangle bbox
   * @returns {import("./types.js").vec3}
   */ vec3InAABB(bbox) {
        return [
            bbox[0][0] + this.rng() * (bbox[1][0] - bbox[0][0]),
            bbox[0][1] + this.rng() * (bbox[1][1] - bbox[0][1]),
            bbox[0][2] + this.rng() * (bbox[1][2] - bbox[0][2])
        ];
    }
    /**
   * Get a random quaternion.
   * @see [Graphics Gems III, Edited by David Kirk, III.6 UNIFORM RANDOM ROTATIONS]
   * @see [Steve LaValle]{@link https://web.archive.org/web/20211105205926/http://planning.cs.uiuc.edu/node198.html}
   * @returns {import("./types.js").quat}
   */ quat() {
        // Let X0, X1, and X2 be three independent random variables that are uniformly distributed between 0 and 1.
        const x0 = this.rng();
        // Compute two uniformly distributed angles, θ1 = 2πX1 and θ2 = 2πX2, and their sines and cosines, s1, c1, s2, c2
        const theta1 = 2 * Math.PI * this.rng();
        const theta2 = 2 * Math.PI * this.rng();
        // Also compute r1 = sqrt(1 – X0) and r2 = sqrt(X0)
        const r1 = Math.sqrt(1 - x0);
        const r2 = Math.sqrt(x0);
        // Then return the unit quaternion with components [s1 r1, c1 r1, s2 r2, c2 r2]
        return [
            Math.sin(theta1) * r1,
            Math.cos(theta1) * r1,
            Math.sin(theta2) * r2,
            Math.cos(theta2) * r2
        ];
    }
    /**
   * Returns a chance of an event occuring according to a given probability between 0 and 1.
   * @param {number} [probability=0.5] Float between 0 and 1.
   * @returns {boolean}
   */ chance(probability = 0.5) {
        return this.rng() <= probability;
    }
    /**
   * Gets a random element from a list.
   * @param {Array} list
   * @returns {*}
   */ element(list) {
        return list[Math.floor(this.rng() * list.length)];
    }
    /**
   * Samples the noise field in 2 dimensions.
   * @param {number} x
   * @param {number} y
   * @returns {number} in the interval [-1, 1]
   */ noise2(x, y) {
        return this.simplex.noise2D(x, y);
    }
    /**
   * Samples the noise field in 3 dimensions.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number} in the interval [-1, 1]
   */ noise3(x, y, z) {
        return this.simplex.noise3D(x, y, z);
    }
    /**
   * Samples the noise field in 4 dimensions.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} w
   * @returns {number} in the interval [-1, 1]
   */ noise4(x, y, z, w) {
        return this.simplex.noise4D(x, y, z, w);
    }
    /**
   * Fractional Brownian motion (also called fractal Brownian motion) noise. Default to 1/f noise with 8 octaves.
   * @param {import("./types.js").FBMOptions} options
   * @param  {...number} d x, y, z?, w?
   * @returns {number} in the interval [-1, 1]
   */ fbm({ octaves = 8, lacunarity = 2, gain = 0.5, frequency = 1, amplitude = gain, noise }, ...d) {
        let value = 0;
        noise ||= this[`noise${d.length}`].bind(this);
        for(let i = 0; i < octaves; i++){
            value += noise(...d.map((n)=>n * frequency)) * amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        return value;
    }
}
/**
 * @module pex-random
 *
 * @summary
 * Export a Random instance using the global PRNG:
 * - The instance is seeded by `performance.now()`
 * - Call `random.seed("seed")` to overwrite the global PRNG: all other calls to `random.float()` will derive from the new seeded state.
 * - Call `random.create()` to create a local instance of Random with a separate unpredictable PRNG.
 * - Call `random.create("seed")` to create a local instance of Random with a separate predictable PRNG: all other calls to `random.float()` will derive from the new seeded state.
 */ var index = new Random();

export { index as default };
