const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    main: path.resolve(__dirname, 'src/js/app.js'),
    landing: path.resolve(__dirname, 'src/js/landing.js'),
    customers: path.resolve(__dirname, 'src/js/customers.js'),
    invoices: path.resolve(__dirname, 'src/js/invoices.js'),
    vessels: path.resolve(__dirname, 'src/js/vessels.js')
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.[contenthash:8].js'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    // Landing page (public, no auth required)
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/landing.html'),
      filename: 'index.html',
      chunks: ['landing'],
      favicon: path.resolve(__dirname, 'src/assets/favicon.png')
    }),
    // Main app (auth required)
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
      filename: 'app.html',
      chunks: ['main'],
      favicon: path.resolve(__dirname, 'src/assets/favicon.png')
    }),
    // Customers page (auth required)
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/customers.html'),
      filename: 'customers.html',
      chunks: ['customers'],
      favicon: path.resolve(__dirname, 'src/assets/favicon.png')
    }),
    // Invoices page (auth required)
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/invoices.html'),
      filename: 'invoices.html',
      chunks: ['invoices'],
      favicon: path.resolve(__dirname, 'src/assets/favicon.png')
    }),
    // Vessels page (auth required)
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/vessels.html'),
      filename: 'vessels.html',
      chunks: ['vessels'],
      favicon: path.resolve(__dirname, 'src/assets/favicon.png')
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'src/assets/favicon.png'), to: 'assets/favicon.png' },
        { from: path.resolve(__dirname, 'src/master'), to: 'master' }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    compress: true,
    port: 3000,
    hot: true,
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:3001',
        changeOrigin: true,
        logLevel: 'debug'
      }
    ]
  }
};// Cache bust: 1756107818
