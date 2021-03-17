const { promisify } = require("util");
const archive = require("../helpers/archiver");
const zipUploader = require("../helpers/zipUpload");
const build = require("../helpers/build");
const logger = require("../helpers/logger").console();
const config = require("../helpers/config");
const capabilityHelper = require("../helpers/capabilityHelper");
const Constants = require("../helpers/constants");
const utils = require("../helpers/utils");
const fileHelpers = require("../helpers/fileHelpers");
const syncRunner = require("../helpers/syncRunner");

module.exports = async function run(args) {

    let bsConfigPath = utils.getConfigPath(args.cf);
    let bsConfig;
    let zipstream;
    let upload;

    try {

        bsConfig = await utils.validateBstackJson(bsConfigPath);

        utils.setDefaults(bsConfig, args);
        utils.setUsername(bsConfig, args);
        utils.setAccessKey(bsConfig, args);
        utils.setBuildName(bsConfig, args);
        utils.setCypressConfigFilename(bsConfig, args);
        utils.setUserSpecs(bsConfig, args);
        utils.setTestEnvs(bsConfig, args);
        utils.setCallbackUrl(bsConfig, args);

    } catch (err) {

        console.error(err);
        return;
    }

    try {

        const cypressJson = await capabilityHelper.validate(bsConfig, args);
        const specFiles = utils.getNumberOfSpecFiles(bsConfig, args, cypressJson);

        utils.setParallels(bsConfig, args, specFiles.length);

    } catch (err) {

        logger.error(err);

        // display browserstack.json is not valid only if validation of browserstack.json field has failed, otherwise display just the error message
        // If parallels specified in arguments are invalid do not display browserstack.json is invalid message
        if (!(err === Constants.validationMessages.INVALID_PARALLELS_CONFIGURATION && !utils.isUndefined(args.parallels))) {
            logger.error(Constants.validationMessages.NOT_VALID);
        }

        const error_code = utils.getErrorCodeFromMsg(err);
        utils.sendUsageReport(bsConfig, args, `${err}\n${Constants.validationMessages.NOT_VALID}`, Constants.messageTypes.ERROR, error_code);

        return;
    }

    try {

        // get zip from fs or generate from files
        if (args['zip-file'] && fileHelpers.fileExists(args['zip-file'])) {
            zipstream = fs.createReadStream(bsConfig.run_settings.zipFile);
        } else {
            zipstream = archive(bsConfig.run_settings, args.exclude);
        }

        upload = await zipUploader.zipUpload(bsConfig, zipstream);

    } catch (err) {

        logger.error(err);
        logger.error(Constants.userMessages.ZIP_UPLOAD_FAILED);

        utils.sendUsageReport(bsConfig, args, `${err}\n${Constants.userMessages.ZIP_UPLOAD_FAILED}`, Constants.messageTypes.ERROR, 'zip_upload_failed');

        return;

    }

    try {

        const buildData = await build.createBuild(bsConfig, upload);
        let message = `${buildData.message}! ${Constants.userMessages.BUILD_CREATED} with build id: ${buildData.build_id}`;
        let dashboardLink = `${Constants.userMessages.VISIT_DASHBOARD} ${buildData.dashboard_url}`;

        if ((utils.isUndefined(bsConfig.run_settings.parallels) && utils.isUndefined(args.parallels)) || (!utils.isUndefined(bsConfig.run_settings.parallels) && bsConfig.run_settings.parallels == Constants.cliMessages.RUN.DEFAULT_PARALLEL_MESSAGE)) {
            logger.warn(Constants.userMessages.NO_PARALLELS);
        }

        if (bsConfig.run_settings.cypress_version && bsConfig.run_settings.cypress_version !== buildData.cypress_version) {
            let versionMessage = utils.versionChangedMessage(bsConfig.run_settings.cypress_version, buildData.cypress_version)
            logger.warn(versionMessage);
        }

        if (!args.disableNpmWarning && bsConfig.run_settings.npm_dependencies && Object.keys(bsConfig.run_settings.npm_dependencies).length <= 0) {
            logger.warn(Constants.userMessages.NO_NPM_DEPENDENCIES);
            logger.warn(Constants.userMessages.NO_NPM_DEPENDENCIES_READ_MORE);
        }

        if (args.sync) {

            const exitCode = await syncRunner.pollBuildStatus(bsConfig, buildData);
            utils.handleSyncExit(exitCode, buildData.dashboard_url);

        } else {
            logger.info(Constants.userMessages.EXIT_SYNC_CLI_MESSAGE.replace("<build-id>", buildData.build_id));
        }

        logger.info(message);
        logger.info(dashboardLink);

        utils.sendUsageReport(bsConfig, args, `${message}\n${dashboardLink}`, Constants.messageTypes.SUCCESS, null);

    } catch (err) {

        logger.error(err);
        utils.sendUsageReport(bsConfig, args, err, Constants.messageTypes.ERROR, 'build_failed');

        return;

    }

}
