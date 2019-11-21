import config from 'config';
import getPort from 'get-port';
import { sleep } from './utils';
import Debug from 'debug';
import _ from 'lodash';
import { TRPGApplication } from 'trpg/core';
import io from 'socket.io-client';

require('iconv-lite').encodingExists('foo'); // https://stackoverflow.com/questions/46227783/encoding-not-recognized-in-jest-js
const loadModules = require('../../loader/standard');
const debug = Debug('trpg:test:app');

interface TRPGAppInstanceContext {
  app: TRPGApplication;
  port: number;
  socket: SocketIOClient.Socket;
  emitEvent: (eventName: string, data?: {}) => Promise<any>;
}

/**
 * 创建一个APP测试上下文
 * Usage: const context = buildAppContext();
 * context.xxx
 * NOTICE: 不要结构他。因为他初始值是么有数据的，是通过beforeAll的方式加载进来的
 */
export const buildAppContext = (): TRPGAppInstanceContext => {
  let context: TRPGAppInstanceContext = {
    app: null,
    port: config.get<number>('port'),
    socket: null,
    emitEvent: null,
  };
  beforeAll(async () => {
    debug('beforeAll');

    // 创建应用
    const port = await getPort({ port: Number(context.port) });
    const app = require('../../packages/Core/')({
      ...config,
      port, // 分配一个端口以保证不会重复
    });

    loadModules(app);

    app.run();
    debug('app start in %d', port);
    context.app = app;

    // 创建socket客户端连接
    const socket = io(`ws://127.0.0.1:${port}`, { autoConnect: false });
    socket.open();
    const emitEvent = (eventName: string, data?: {}) => {
      // 发送信息测试
      return new Promise((resolve) => {
        socket.emit(eventName, data, function(_res) {
          resolve(_res);
        });
      });
    };
    context.socket = socket;
    context.emitEvent = emitEvent;

    // TODO: 要想办法弄掉
    await sleep(1000); // 强行sleep以保证app能正常加载完毕
  }, 20000);

  afterAll(async () => {
    debug('afterAll');

    await _.invoke(context, 'app.close');
    _.invoke(context, 'socket.close');

    debug('app close success');
  });

  return context;
};