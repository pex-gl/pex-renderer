const path = require("path");
const MinifyPlugin = require("babel-minify-webpack-plugin");

const src = "./";
const dist = "./";

const NODE_ENV = process.env.NODE_ENV;

module.exports = {
  entry: src + "/index.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, dist)
  },
  mode: ["production", "development"].includes(NODE_ENV)
    ? NODE_ENV
    : "production",
  devServer: {
    contentBase: dist
  },
  devtool: NODE_ENV !== "production" ? "source-map" : false,
  plugins: [
    NODE_ENV === "production"
      ? new MinifyPlugin(
          {},
          {
            comments: false
          }
        )
      : undefined
  ].filter(Boolean),
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|pex-renderer)/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            presets: [
              [
                "@babel/preset-env",
                {
                  modules: false,
                  useBuiltIns: false,
                  debug: false,
                  targets: {
                    browsers: "last 2 versions"
                  }
                }
              ]
            ]
          }
        }
      }
    ]
  }
};
