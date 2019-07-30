import events from 'events';
import Debug from 'debug';
const debug = Debug('trpg:application');
import schedule, { JobCallback, Job } from 'node-schedule';
import fs from 'fs-extra';
import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import _ from 'lodash';
import { IOSessionMiddleware } from './utils/iosession';
import Storage, { TRPGDbOptions } from './storage';
import { Cache, RedisCache, ICache } from './cache';
const ReportService = require('./report');
import WebService from './webservice';
import SocketService, { EventFunc } from './socket';
import { getLogger } from './logger';
const logger = getLogger();
const appLogger = getLogger('application');
import xss from 'xss';
import BasePackage from 'lib/package';

type AppSettings = {
  [key: string]: string | number | {};
};

type InternalEventFunc = (...args: any) => Promise<void>;
type InternalEvents = {
  [eventName: string]: Array<InternalEventFunc>;
};

type ScheduleJob = {
  name: string;
  job: Job;
};

class Application extends events.EventEmitter {
  settings: AppSettings = {}; // 设置配置列表
  storage: Storage = null; // 数据库服务列表
  cache: ICache = null; // 缓存服务
  reportservice = null; // 汇报服务
  webservice: WebService = null; // 网页服务
  socketservice: SocketService = null; // websocket服务
  components: BasePackage[] | Function[] = []; // 组件列表
  events: InternalEvents = {}; // 内部事件列表
  timers = []; // 计时器列表
  webApi = {}; // 网页服务api
  statInfoJob = []; // 统计信息任务
  job = null; // node-schedule定时任务(每日凌晨2点)
  scheduleJob: ScheduleJob[] = []; // 计划任务列表
  testcase = [];
  [packageInject: string]: any; // 包注入的方法

  run() {
    // TODO 启动检测，如果为第一次启动则初始化。如果非第一次启动则重新开启（保留之前配置）
    this.init();
  }

  init() {
    this.setMaxListeners(20); // 设置事件监听数量
    this.initReportService();
    this.initWebService();
    this.initSocketService();
    this.initStorage();
    this.initCache();
    this.initStatJob();
    this.initComponents();

    applog('init completed!');
    this.emit('initCompleted', this);
    this.webservice.listen();
  }

  initReportService() {
    try {
      this.reportservice = new ReportService(this.get('report'));
      applog('create report service success!');
    } catch (err) {
      console.error('create report error:');
      throw err;
    }
  }

  initWebService() {
    try {
      let port = Number(this.set('port'));
      this.webservice = new WebService({
        app: this,
        port,
        webApi: this.webApi,
        homepage: this.get('webserviceHomepage'),
      });
      applog('create webservice(%d) success!', port);
    } catch (err) {
      console.error('create webservice error:');
      throw err;
    }
  }

  initSocketService() {
    const socketservice = new SocketService(this);
    socketservice.use(
      IOSessionMiddleware(this.webservice.app, this.webservice.sessionOpt)
    );
    socketservice.initIOEvent();
    // TODO: 增加一个定时任务，定期记录事件平均耗时

    this.socketservice = socketservice;
    this.on('disconnect', (socket) => {
      // 离线时移除之前的iosession
      socket.iosession.destroy();
    });
  }

  initStorage() {
    const dbconfig = this.get('db') as TRPGDbOptions;
    this.storage = new Storage(dbconfig);
  }
  initCache() {
    const redisUrl = this.get('redisUrl').toString();
    if (redisUrl) {
      this.cache = new RedisCache({ url: redisUrl });
    } else {
      this.cache = new Cache();
    }
  }
  initStatJob() {
    let run = async () => {
      try {
        applog('start statistics project info...');
        let info: any = {};
        for (let job of this.statInfoJob) {
          let name = job.name;
          let fn = job.fn;
          let res = await fn();
          applog('|- [%s]:%o', name, res);
          if (res) {
            info[name] = res;
          }
        }
        info._updated = new Date().getTime();
        await fs.writeJson(path.resolve(process.cwd(), './stat.json'), info, {
          spaces: 2,
        });
        applog('statistics completed!');
      } catch (e) {
        console.error('statistics error:', e);
        this.error(e);
      }
    };

    // 每天凌晨2点统计一遍
    this.job = schedule.scheduleJob('0 0 2 * * *', run);
    // schedule.scheduleJob('1 * * * * *', run); // just for test
  }

  initComponents() {
    for (let component of this.components) {
      try {
        const isNewPackage = component instanceof BasePackage; // 检测是否为新版包
        if (!isNewPackage) {
          // 旧版包处理
          applog('initing ...%o', component);
          let componentInfo = (component as Function).call(this, this);
          applog('component info:', componentInfo);
        } else {
          // 新版包处理
          const instance = component as BasePackage;
          const componentName = instance.name;
          applog('initing ...%s', componentName);
          instance.onInit();
          instance.onInitCompleted();
          applog('component info:', {
            name: componentName,
            require: instance.require,
          });
        }
      } catch (e) {
        console.warn(`component init error when ${component}:\n`);
        throw e;
      }
    }
  }

  // eventFn is async/await fn
  register(appEventName: string, eventFn: InternalEventFunc) {
    if (!!this.events[appEventName]) {
      this.events[appEventName].push(eventFn);
    } else {
      this.events[appEventName] = [eventFn];
    }
  }

  registerEvent(eventName: string, eventFn: EventFunc) {
    this.socketservice.registerIOEvent(eventName, eventFn);
  }

  // loopNum 循环次数,不传则为无限循环
  registerTimer(fn: () => void, millisec: number, loopNum: number) {
    var indexNum = 0;
    let timer = setInterval(function() {
      fn();
      indexNum++;
      if (!!loopNum && loopNum >= indexNum) {
        clearInterval(timer);
      }
    }, millisec);

    this.timers.push(timer);
  }

  // 只执行一次的计时器
  // 用于替代系统默认的setTimeout
  registerTimerOnce(fn: () => void, millisec: number) {
    this.registerTimer(fn, millisec, 1);
  }

  registerWebApi(path, fn) {
    this.webApi[path] = fn;
  }

  registerStatJob(statName, statCb) {
    for (let s of this.statInfoJob) {
      if (s.name === statName) {
        applog(`stat info [${statName}] has been registered`);
        return;
      }
    }

    applog('register stat job [%s]', statName);
    this.statInfoJob.push({
      name: statName,
      fn: statCb,
    });
  }

  /**
   * 注册计划任务
   * @param name 计划任务名
   * @param rule 计划任务执行规则
   * @param fn 计划任务方法
   */
  registerScheduleJob(name: string, rule: string, fn: JobCallback) {
    for (let s of this.statInfoJob) {
      if (s.name === name) {
        applog(`schedule job [${name}] has been registered`);
        return;
      }
    }

    applog('register schedule job [%s]', name);
    this.scheduleJob.push({
      name,
      job: schedule.scheduleJob(name, rule, fn),
    });
  }

  request = {
    get(url: string, query: any, config: AxiosRequestConfig) {
      return axios({
        url,
        method: 'get',
        params: query,
        ...config,
      }).then((res) => {
        applog('[request GET]', url, query, res.status);
        appLogger.info('\t[request res detail]:', res);
        return res.data;
      });
    },
    post(url: string, data: any, config: AxiosRequestConfig) {
      return axios({
        url,
        method: 'post',
        data,
        ...config,
      }).then((res) => {
        applog('[request POST]', url, data, res.status);
        appLogger.info('\t[request res detail]:', res);
        return res.data;
      });
    },
  };

  // 记录错误
  error(err) {
    console.error('Error', err);
    this.reportservice.reportError(err);
  }

  errorWithContext(err, context) {
    console.error('Error', err);
    this.reportservice.reportErrorWithContext(err, context);
  }

  async close() {
    debug('closing....');
    await this.storage.close();
    await this.socketservice.close();
    // 清理timer
    for (let timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    this.job.cancel();
    this.cache.close(); // 关闭redis连接
    this.emit('close');
    debug('close completed!');
  }

  set(setting, val?) {
    if (arguments.length === 1) {
      return this.settings[setting];
    }

    applog('set "%s" to %o', setting, val);

    this.settings[setting] = val;

    return this;
  }

  // 支持get('xxx.xxx')获取
  get<T = string | number | any>(path: string, defaultValue: any = ''): T {
    return _.get<any, any, T>(this.settings, path, defaultValue);
  }

  enabled(setting: string) {
    return Boolean(this.set(setting));
  }

  disabled(setting: string) {
    return !this.set(setting);
  }

  enable(setting: string) {
    return this.set(setting, true);
  }

  disable(setting: string) {
    return this.set(setting, false);
  }

  onconnect(cb) {
    if (cb) {
      throw new TypeError(`param must be a Function. this is a ${typeof cb}`);
    }

    if (!this.socketservice) {
      throw new Error('socketservice is not initialized');
    }

    this.socketservice.on('connection', cb);
  }

  load(component) {
    let app = this;
    if (!!component && typeof component === 'function') {
      if (BasePackage.isPrototypeOf(component)) {
        // 新包onLoad处理
        component = new component(this);
        (component as BasePackage).onLoad();
        applog(
          'load component into components list(index: %d). %s',
          this.components.length,
          component.name
        );
      } else {
        // 旧包处理
        applog(
          'load component into components list(index: %d). %o',
          this.components.length,
          component
        );
      }
      this.components.push(component);
    } else {
      applog(`component must be a Function not a ${typeof component}`);
      throw new Error('Component load failed. Component must be a Function.');
    }
  }

  async reset({ force = false } = {}) {
    const app = this;
    const storage = app.storage;
    if (storage) {
      applog('start resetStorage');
      await storage.reset(force);
      let db = storage.db;
      try {
        if (!!app.events['resetStorage']) {
          for (let fn of app.events['resetStorage']) {
            await fn(storage, db);
          }
          applog('registered reset event completed!');
        }
      } catch (err) {
        console.error('reset storage error', err);
        throw err;
      }
    }
  }

  log = applog;
  xss = xss;

  jwtSign = (payload: any) => this.webservice.jwtSign(payload);
  jwtVerify = (token: string) => this.webservice.jwtVerify(token);
}
export default Application;

function applog(formatter, ...others) {
  debug(formatter, ...others);
  appLogger.info(formatter, ...others);
}
