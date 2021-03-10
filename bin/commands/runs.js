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
const reportGenerator = require('../helpers/reporterHTML').reportGenerator;

module.exports = async function run(args) {

    let bsConfigPath = utils.getConfigPath(args.cf);
    let bsConfig;
    let zip;
    let upload;

    try {

        utils.deleteResults();
        bsConfig = await utils.validateBstackJson(bsConfigPath);

        utils.setUsageReportingFlag(bsConfig, args.disableUsageReporting);
        utils.setDefaults(bsConfig, args);
        utils.setUsername(bsConfig, args);
        utils.setAccessKey(bsConfig, args);
        utils.setBuildName(bsConfig, args);
        utils.setCypressConfigFilename(bsConfig, args);
        utils.setUserSpecs(bsConfig, args);
        utils.setTestEnvs(bsConfig, args);

        utils.setLocal(bsConfig);
        utils.setLocalIdentifier(bsConfig);

    } catch (err) {

        console.error(err);
        utils.setUsageReportingFlag(null, args.disableUsageReporting);
        utils.sendUsageReport(null, args, err.message, Constants.messageTypes.ERROR, utils.getErrorCodeFromErr(err));
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

        zip = archive(bsConfig.run_settings, args.exclude);
        upload = await zipUploader.zipUpload(bsConfig, zip);

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

        //utils.exportResults(buildData.build_id, `${config.dashboardUrl}${buildData.build_id}`);

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

            // Generate custom report!
            reportGenerator(bsConfig, buildData.build_id, args, function() {
                utils.sendUsageReport(bsConfig, args, `${message}\n${dashboardLink}`, Constants.messageTypes.SUCCESS, null);
                utils.handleSyncExit(exitCode, buildData.dashboard_url);
            });

        }

        logger.info(message);
        logger.info(dashboardLink);

        if (!args.sync) {
            logger.info(Constants.userMessages.EXIT_SYNC_CLI_MESSAGE.replace("<build-id>", buildData.build_id));
        }

        utils.sendUsageReport(bsConfig, args, `${message}\n${dashboardLink}`, Constants.messageTypes.SUCCESS, null);

    } catch (err) {

        logger.error(err);
        utils.sendUsageReport(bsConfig, args, err, Constants.messageTypes.ERROR, 'build_failed');

        return;

    }

}
