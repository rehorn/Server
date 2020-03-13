const Raven = require('raven');
import { getLogger } from './logger';
const logger = getLogger();
const appLogger = getLogger('application');

interface ReportConfig {
  enable: boolean;
  logger: boolean;
  sentry: boolean | string;
}

type ReportErrorType = Error | string;

// 默认设置
const defaultConfig: ReportConfig = {
  enable: true,
  logger: true,
  sentry: false, // 如果有则为Sentry DSN http://xxxxxxx@sentry.xxxxx.com/x 格式
};

class ReportService {
  private _setting: ReportConfig;
  installed = false;

  constructor(reportSetting: ReportConfig) {
    this._setting = Object.assign({}, defaultConfig, reportSetting);
    if (this._setting.sentry) {
      Raven.config(this._setting.sentry).install();
      this.installed = true;
    }
  }

  reportError(err: ReportErrorType, options = null) {
    console.error(err); // 在终端里输出一遍

    const setting = this._setting;
    if (!this._setting.enable) {
      // 未开启汇报系统
      return;
    }

    if (setting.logger) {
      logger.error(
        {
          tags: ['app'],
        },
        err
      );
    }

    if (this.installed) {
      let errorFn;
      if (typeof err === 'string') {
        // 如果不是一个错误类型的。提交错误文本信息到sentry
        errorFn = Raven.captureMessage.bind(Raven);
      } else {
        errorFn = Raven.captureException.bind(Raven);
      }
      errorFn(err, options, function(err, eventId) {
        console.log('[Sentry] Reported error: ' + eventId);
        appLogger.info('[Sentry] Reported error: ' + eventId);
      });
    }
  }

  reportErrorWithContext(err: ReportErrorType, context = {}) {
    if (!this.installed) {
      return;
    }

    Raven.context(() => {
      Raven.setContext(context);
      this.reportError(err);
    });
  }
}

export default ReportService;
