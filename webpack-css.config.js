const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackPluginConfig = new HtmlWebpackPlugin({
  template: './src/index.html',
  filename: 'index.html',
  inject: 'body'
})
module.exports = { 
  entry: ['./src/index.js', './src/main.css'], 
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


  