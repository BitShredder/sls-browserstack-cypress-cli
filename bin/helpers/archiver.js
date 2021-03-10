const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const Constants = require('../helpers/constants');
const logger = require("./logger").console();
const utils = require('../helpers/utils');


function getFilesToIgnore (runSettings, excludeFiles) {

    let ignoreFiles = Constants.filesToIgnoreWhileUploading;

    // exclude files asked by the user
    // args will take precedence over config file
    if (!utils.isUndefined(excludeFiles)) {
      let excludePatterns = utils.fixCommaSeparatedString(excludeFiles).split(',');
      ignoreFiles = ignoreFiles.concat(excludePatterns);
      logger.info(`Excluding files matching: ${JSON.stringify(excludePatterns)}`);
    } else if (!utils.isUndefined(runSettings.exclude) && runSettings.exclude.length) {
      ignoreFiles = ignoreFiles.concat(runSettings.exclude);
      logger.info(`Excluding files matching: ${JSON.stringify(runSettings.exclude)}`);
    }

    return ignoreFiles;
}

module.exports = (runSettings, excludeFiles) => {

    const packageJSON = {};
    const cypressFolderPath = path.dirname(runSettings.cypressConfigFilePath);
    const ignoreFiles = getFilesToIgnore(runSettings, excludeFiles);

    logger.info(`Creating tests.zip with files in ${cypressFolderPath}`);

    const archive = archiver('zip', {
        zlib: {level: 9}, // Sets the compression level.
    });

    archive.on('warning', function (err) {
        logger.info(err);
    });

    archive.on('error', function (err) {
        logger.error(err);
    });

    if (typeof runSettings.package_config_options === 'object') {
        Object.assign(packageJSON, runSettings.package_config_options);
    }

    if (typeof runSettings.npm_dependencies === 'object') {
        Object.assign(packageJSON, {
            devDependencies: runSettings.npm_dependencies,
        });
    }

    archive.glob(`**/*.+(${Constants.allowedFileTypes.join("|")})`, {
        cwd: cypressFolderPath,
        matchBase: true,
        ignore: ignoreFiles,
        dot: true,
    });

    if (Object.keys(packageJSON).length > 0) {
        let packageJSONString = JSON.stringify(packageJSON, null, 4);
        archive.append(packageJSONString, { name: 'browserstack-package.json' });
    }

    const cypressJSON = JSON.parse(fs.readFileSync(runSettings.cypressConfigFilePath));
    const cypressJSONString = JSON.stringify(cypressJSON, null, 4);

    archive.append(cypressJSONString, { name: 'cypress.json' });
    archive.finalize();

    return archive;

}
