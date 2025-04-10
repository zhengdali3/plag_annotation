// config.js
const path = require('path');

const config = {
  server: {
    port: 3001
  },
  database: {
    path: path.join(__dirname, 'annotations.db')
  },
  paths: {
    dataDirectory: path.join(__dirname, '..', 'data', 'assignment-3-jplag'),
    sourceFilesDirectory: path.join(__dirname, '..', 'data', 'assignment-3-jplag', 'files')
  }
};

module.exports = config;