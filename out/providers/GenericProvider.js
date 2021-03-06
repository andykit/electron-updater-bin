"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GenericProvider = void 0;

function _builderUtilRuntime() {
  const data = require("builder-util-runtime");

  _builderUtilRuntime = function () {
    return data;
  };

  return data;
}

function _main() {
  const data = require("../main");

  _main = function () {
    return data;
  };

  return data;
}

function _Provider() {
  const data = require("./Provider");

  _Provider = function () {
    return data;
  };

  return data;
}

class GenericProvider extends _main().Provider {
  constructor(configuration, updater, useMultipleRangeRequest = true) {
    super(updater.httpExecutor, useMultipleRangeRequest);
    this.configuration = configuration;
    this.updater = updater;
    this.baseUrl = (0, _main().newBaseUrl)(this.configuration.url);
  }

  get channel() {
    const result = this.updater.channel || this.configuration.channel;
    return result == null ? (0, _main().getDefaultChannelName)() : (0, _main().getCustomChannelName)(result);
  }

  async getLatestVersion() {
    let result;
    const channelFile = (0, _main().getChannelFilename)(this.channel);
    const channelUrl = (0, _main().newUrlFromBase)(channelFile, this.baseUrl, this.updater.isAddNoCacheQuery);

    for (let attemptNumber = 0;; attemptNumber++) {
      try {
        result = (0, _Provider().parseUpdateInfo)((await this.httpRequest(channelUrl)), channelFile, channelUrl);
        break;
      } catch (e) {
        if (e instanceof _builderUtilRuntime().HttpError && e.statusCode === 404) {
          throw (0, _builderUtilRuntime().newError)(`Cannot find channel "${channelFile}" update info: ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        } else if (e.code === "ECONNREFUSED") {
          if (attemptNumber < 3) {
            await new Promise((resolve, reject) => {
              try {
                setTimeout(resolve, 1000 * attemptNumber);
              } catch (e) {
                reject(e);
              }
            });
            continue;
          }
        }

        throw e;
      }
    }

    if ((0, _main().isUseOldMacProvider)()) {
      result.releaseJsonUrl = channelUrl.href;
    }

    return result;
  }

  resolveFiles(updateInfo) {
    return (0, _Provider().resolveFiles)(updateInfo, this.baseUrl);
  }

} exports.GenericProvider = GenericProvider;
//# sourceMappingURL=GenericProvider.js.map