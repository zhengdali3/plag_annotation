// config.js
const path = require('path');
module.exports = {
  server: { port: 3001 },
  database: { path: path.join(__dirname, 'annotations.db') },
  paths: {
    // The one true parent of all your datasets:
    dataRoot:            path.resolve(__dirname, '../data'),
    sourceFilesDirectory:path.resolve(__dirname, '../data')
  }
};