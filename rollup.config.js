import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import nodeGlobals from 'rollup-plugin-node-globals'
import builtins from 'rollup-plugin-node-builtins'
import babel from 'rollup-plugin-babel'
import glslify from 'rollup-plugin-glslify'
import pkg from './package.json'

const input = 'index.js'

const plugins = [
  resolve(),
  commonjs(),
  nodeGlobals(),
  builtins(),
  glslify(),
  babel({
    exclude: ['node_modules/**'],
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

export default [
  {
    input,
    output: {
      name: 'PexRenderer',
      file: pkg.browser,
      format: 'umd',
      sourcemap: true
    },
    plugins
  },
  {
    input,
    external: Object.keys(pkg.dependencies) || {},
    output: [
      { file: pkg.main, format: 'cjs', sourcemap: true },
      { file: pkg.module, format: 'es', sourcemap: true }
    ],
    plugins
  }
]
