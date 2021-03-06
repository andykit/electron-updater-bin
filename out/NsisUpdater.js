"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NsisUpdater = void 0;

function _builderUtilRuntime() {
  const data = require("builder-util-runtime");

  _builderUtilRuntime = function () {
    return data;
  };

  return data;
}

function _child_process() {
  const data = require("child_process");

  _child_process = function () {
    return data;
  };

  return data;
}

var path = _interopRequireWildcard(require("path"));

require("source-map-support/register");

function _BaseUpdater() {
  const data = require("./BaseUpdater");

  _BaseUpdater = function () {
    return data;
  };

  return data;
}

function _FileWithEmbeddedBlockMapDifferentialDownloader() {
  const data = require("./differentialDownloader/FileWithEmbeddedBlockMapDifferentialDownloader");

  _FileWithEmbeddedBlockMapDifferentialDownloader = function () {
    return data;
  };

  return data;
}

function _GenericDifferentialDownloader() {
  const data = require("./differentialDownloader/GenericDifferentialDownloader");

  _GenericDifferentialDownloader = function () {
    return data;
  };

  return data;
}

function _main() {
  const data = require("./main");

  _main = function () {
    return data;
  };

  return data;
}

function _Provider() {
  const data = require("./providers/Provider");

  _Provider = function () {
    return data;
  };

  return data;
}

function _fsExtraP() {
  const data = require("fs-extra-p");

  _fsExtraP = function () {
    return data;
  };

  return data;
}

function _windowsExecutableCodeSignatureVerifier() {
  const data = require("./windowsExecutableCodeSignatureVerifier");

  _windowsExecutableCodeSignatureVerifier = function () {
    return data;
  };

  return data;
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

class NsisUpdater extends _BaseUpdater().BaseUpdater {
  constructor(options, app) {
    super(options, app);
  }
  /*** @private */


  async doDownloadUpdate(downloadUpdateOptions) {
    const provider = await this.provider;
    const fileInfo = (0, _Provider().findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfo), "exe");
    return await this.executeDownload({
      fileExtension: "exe",
      downloadUpdateOptions,
      fileInfo,
      task: async (destinationFile, downloadOptions, packageFile, removeTempDirIfAny) => {
        const packageInfo = fileInfo.packageInfo;
        const isWebInstaller = packageInfo != null && packageFile != null;

        if (isWebInstaller || (await this.differentialDownloadInstaller(fileInfo, downloadUpdateOptions, destinationFile, downloadUpdateOptions.requestHeaders, provider))) {
          await this.httpExecutor.download(fileInfo.url.href, destinationFile, downloadOptions);
        }

        const signatureVerificationStatus = await this.verifySignature(destinationFile);

        if (signatureVerificationStatus != null) {
          await removeTempDirIfAny(); // noinspection ThrowInsideFinallyBlockJS

          throw (0, _builderUtilRuntime().newError)(`New version ${downloadUpdateOptions.updateInfo.version} is not signed by the application owner: ${signatureVerificationStatus}`, "ERR_UPDATER_INVALID_SIGNATURE");
        }

        if (isWebInstaller) {
          if (await this.differentialDownloadWebPackage(packageInfo, packageFile, provider)) {
            try {
              await this.httpExecutor.download(packageInfo.path, packageFile, {
                skipDirCreation: true,
                headers: downloadUpdateOptions.requestHeaders,
                cancellationToken: downloadUpdateOptions.cancellationToken,
                sha512: packageInfo.sha512
              });
            } catch (e) {
              try {
                await (0, _fsExtraP().unlink)(packageFile);
              } catch (ignored) {// ignore
              }

              throw e;
            }
          }
        }
      }
    });
  } // $certificateInfo = (Get-AuthenticodeSignature 'xxx\yyy.exe'
  // | where {$_.Status.Equals([System.Management.Automation.SignatureStatus]::Valid) -and $_.SignerCertificate.Subject.Contains("CN=siemens.com")})
  // | Out-String ; if ($certificateInfo) { exit 0 } else { exit 1 }


  async verifySignature(tempUpdateFile) {
    let publisherName;

    try {
      publisherName = (await this.configOnDisk.value).publisherName;

      if (publisherName == null) {
        return null;
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        // no app-update.yml
        return null;
      }

      throw e;
    }

    return await (0, _windowsExecutableCodeSignatureVerifier().verifySignature)(Array.isArray(publisherName) ? publisherName : [publisherName], tempUpdateFile, this._logger);
  }

  async doInstall(installerPath, isSilent, isForceRunAfter) {
    const args = ["--updated"];

    if (isSilent) {
      args.push("/S");
    }

    if (isForceRunAfter) {
      args.push("--force-run");
    }

    const packagePath = this.downloadedUpdateHelper.packageFile;

    if (packagePath != null) {
      // only = form is supported
      args.push(`--package-file="${packagePath}"`);
    }

    const spawnOptions = {
      detached: true,
      stdio: "ignore"
    };

    try {
      await this._spawn(installerPath, args, spawnOptions);
    } catch (e) {
      // yes, such errors dispatched not as error event
      // https://github.com/electron-userland/electron-builder/issues/1129
      if (e.code === "UNKNOWN" || e.code === "EACCES") {
        // Node 8 sends errors: https://nodejs.org/dist/latest-v8.x/docs/api/errors.html#errors_common_system_errors
        this._logger.info("Access denied or UNKNOWN error code on spawn, will be executed again using elevate");

        try {
          await this._spawn(path.join(process.resourcesPath, "elevate.exe"), [installerPath].concat(args), spawnOptions);
        } catch (e) {
          this.dispatchError(e);
        }
      } else {
        this.dispatchError(e);
      }
    }

    return true;
  }
  /**
   * This handles both node 8 and node 10 way of emitting error when spawing a process
   *   - node 8: Throws the error
   *   - node 10: Emit the error(Need to listen with on)
   */


  async _spawn(exe, args, options) {
    return new Promise((resolve, reject) => {
      try {
        const process = (0, _child_process().spawn)(exe, args, options);
        process.on("error", error => {
          reject(error);
        });
        process.unref();

        if (process.pid !== undefined) {
          resolve(true);
        }
      } catch (error) {
        reject(error);
      }
    });
  } // private downloadBlockMap(provider: Provider<any>) {
  //   await provider.getBytes(newBlockMapUrl, cancellationToken)
  // }


  async differentialDownloadInstaller(fileInfo, downloadUpdateOptions, installerPath, requestHeaders, provider) {
    try {
      const newBlockMapUrl = (0, _main().newUrlFromBase)(`${fileInfo.url.pathname}.blockmap`, fileInfo.url);
      const oldBlockMapUrl = (0, _main().newUrlFromBase)(`${fileInfo.url.pathname.replace(new RegExp(downloadUpdateOptions.updateInfo.version, "g"), this.currentVersion.version)}.blockmap`, fileInfo.url);

      this._logger.info(`Download block maps (old: "${oldBlockMapUrl.href}", new: ${newBlockMapUrl.href})`);

      const downloadBlockMap = async url => {
        const requestOptions = (0, _Provider().configureRequestOptionsFromUrl)(url, {
          headers: downloadUpdateOptions.requestHeaders
        });
        requestOptions.gzip = true;
        const data = await this.httpExecutor.request(requestOptions, downloadUpdateOptions.cancellationToken);

        if (data == null) {
          throw new Error(`Blockmap "${url.href}" is empty`);
        }

        try {
          return JSON.parse(data);
        } catch (e) {
          throw new Error(`Cannot parse blockmap "${url.href}", error: ${e}, raw data: ${data}`);
        }
      };

      const blockMapData = await downloadBlockMap(newBlockMapUrl);
      const oldBlockMapData = await downloadBlockMap(oldBlockMapUrl);
      await new (_GenericDifferentialDownloader().GenericDifferentialDownloader)(fileInfo.info, this.httpExecutor, {
        newUrl: fileInfo.url.href,
        oldFile: path.join(this.app.getPath("userData"), _builderUtilRuntime().CURRENT_APP_INSTALLER_FILE_NAME),
        logger: this._logger,
        newFile: installerPath,
        useMultipleRangeRequest: provider.useMultipleRangeRequest,
        requestHeaders
      }).download(oldBlockMapData, blockMapData);
    } catch (e) {
      this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`);

      return true;
    }

    return false;
  }

  async differentialDownloadWebPackage(packageInfo, packagePath, provider) {
    if (packageInfo.blockMapSize == null) {
      return true;
    }

    try {
      await new (_FileWithEmbeddedBlockMapDifferentialDownloader().FileWithEmbeddedBlockMapDifferentialDownloader)(packageInfo, this.httpExecutor, {
        newUrl: packageInfo.path,
        oldFile: path.join(this.app.getPath("userData"), _builderUtilRuntime().CURRENT_APP_PACKAGE_FILE_NAME),
        logger: this._logger,
        newFile: packagePath,
        requestHeaders: this.requestHeaders,
        useMultipleRangeRequest: provider.useMultipleRangeRequest
      }).download();
    } catch (e) {
      this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`); // during test (developer machine mac or linux) we must throw error


      return process.platform === "win32";
    }

    return false;
  }

} exports.NsisUpdater = NsisUpdater;
//# sourceMappingURL=NsisUpdater.js.map