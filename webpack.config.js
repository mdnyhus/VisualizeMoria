const path = require('path');
// const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackPluginConfig = new HtmlWebpackPlugin({
  template: './src/index.html',
  filename: 'index.html',
  inject: 'body'
})
module.exports = { 
  entry: ['./src/index.js', './src/main.scss'], 
  output: { 
    path: path.resolve('dist'), 
    filename: 'index_bundle.js',
    publicPath: '/dist'
  }, 
  module: { 
    rules: [
      {
        test: /\.js$/, 
        loader: 'babel-loader', 
        exclude: /node_modules/
      },
      {
        test: /\.css$/, 
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.scss$/,
        // use: MiniCssExtractPlugin.extract({
          // fallback: 'style-loader',
          // use: ['css-loader', 'sass-loader']
        // })
        use: [
          "style-loader",
          "css-loader",
          "sass-loader"
        ]
      },
      {
        test: /\.png$/,
        use: [
          'file-loader'
        ]
      }
    ]
  }, 
  plugins: [HtmlWebpackPluginConfig],
  resolve: {
    alias: {
      'crossfilter': 'crossfilter2'
    }
  }
}


  