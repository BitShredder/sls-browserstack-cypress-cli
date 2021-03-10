# Serverless BrowserStack Cypress CLI

The `serverless-browserstack-cypress-cli` is a fork of BrowserStack's command-line interface (CLI) which
allows you to run your Cypress tests on BrowserStack. Can be invoked
from a serverless environment like AWS Lambda, which has a read-only filesystem, without needing a CI environment.

## Features
- Uses streams to pipe zipped test suite files directly to the BrowserStack Automate API endpoint (no need for slow disc IO)
- Logs all output to the console
- No reporting
- Callback config from CLI

## License

This project is released under MIT License. Please refer the
[LICENSE.md](LICENSE.md) for more details.
