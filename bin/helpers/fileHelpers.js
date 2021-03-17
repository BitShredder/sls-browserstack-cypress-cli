const fs = require('fs-extra');
const path = require('path');

const logger = require('./logger').console();
const Constants = require('../helpers/constants');
const config = require('../helpers/config');

exports.fileExists = function (filePath, cb) {
  fs.access(filePath, fs.F_OK, (err) => {
    let exists = true;
    if (err) {
      exists = false;
    }
    cb && cb(exists);
  });
};

exports.dirExists = function (filePath, cb) {
  let exists = false;
  if (fs.existsSync(path.dirname(filePath), cb)) {
    exists = true;
  }
  cb && cb(exists);
};
