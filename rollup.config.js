import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import nodeGlobals from 'rollup-plugin-node-globals'
import builtins from 'rollup-plugin-node-builtins'
import babel from 'rollup-plugin-babel'
import glslify from 'rollup-plugin-glslify'
import { uglify } from 'rollup-plugin-uglify'

import pkg from './package.json'

const isDev = process.env.NODE_ENV === 'development'

const input = 'index.js'

const plugins = [
  resolve(),
  commonjs(),
  nodeGlobals(),
  builtins(),
  glslify(),
  babel({
    presets: [
      [
        '@babel/preset-env',
        {
          modules: false
          // targets: {
          //   node: '6.10'
          // }
        }
      ]
    ]
  })
]

const external = Object.keys(pkg.dependencies) || {}

export default [
  // IIFE: bundle including all dependencies in a single file.
  // Usage: directly in browser as a <script> tag
  {
    input,
    output: {
      name: 'PexRenderer',
      file: 'dist/pex-renderer.bundle.js',
      format: 'iife',
      sourcemap: false
    },
    plugins: [...plugins, isDev ? 0 : uglify()].filter(Boolean)
  },
  // CJS: for node js pre ES modules era (using CJS require syntax).
  // Usage: nodejs and browserify
  {
    input,
    external,
    output: { file: pkg.main, format: 'cjs', sourcemap: true },
    plugins
  },
  // ES: for modern bundler/services resolving the "module" field
  // Usage: webpack, unpkg
  {
    input,
    external,
    output: { file: pkg.module, format: 'es', sourcemap: true },
    plugins
  }
]
