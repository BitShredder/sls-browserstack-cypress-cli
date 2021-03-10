const https = require("https");
const { URL } = require('url');
const fs = require("fs");
const formstream = require('formstream');
const logger = require("./logger").console();
const Constants = require("./constants");
const utils = require("./utils");
const config = require('./config');

const uploadCypressZip = (bsConfig, zipStream) => {

    return new Promise((resolve, reject) => {

        logger.info(Constants.userMessages.UPLOADING_TESTS);

        const form = formstream();

        form.stream('file', zipStream, 'tests.zip', 'application/zip');

        const { username, access_key } = bsConfig.auth;
        const auth = 'Basic ' + Buffer.from(username + ':' + access_key).toString('base64');
        const url = new URL(config.uploadUrl);
        const options = {
            host: url.host,
            path: url.pathname,
            method: 'POST',
            headers: {
                ...form.headers(),
                'User-Agent': utils.getUserAgent(),
                'Authorization': auth,
            },
        };

        const data = [];

        const post = https.request(options, (res) => {

            res.setEncoding('utf-8');
            res.on('data', (chunk) => {
                if (chunk) {
                    data.push(chunk);
                }
            });

            res.on('end', () => {

                let responseData;

                post.end();

                try {
                    responseData = JSON.parse(data.join(''));
                } catch (e) {
                    responseData = null;
                }

                if (res.statusCode != 200) {
                    if (responseData && responseData["error"]) {
                        reject(responseData["error"]);
                    } else {
                        reject(Constants.userMessages.ZIP_UPLOADER_NOT_REACHABLE);
                    }
                } else {
                    logger.info(`Uploaded tests successfully (${responseData.zip_url})`);
                    resolve(responseData);
                }

            });
        });

        form.pipe(post);

    });
}

exports.zipUpload = uploadCypressZip;
