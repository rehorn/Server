const Router = require('koa-router');
const router = new Router();
const authAjax = require('../utils/middleware').authAjax;

const player = require('./api/player');
const chat = require('./api/chat');
const group = require('./api/group');
const system = require('./api/system');
const systemV2 = require('./api/v2/system');
const notifyV2 = require('./api/v2/notify');
router.use('/api/system', system.routes(), system.allowedMethods());
router.use('/api/v2/system', systemV2.routes(), systemV2.allowedMethods());
router.use('/api/*', authAjax);
router.use('/api/player', player.routes(), player.allowedMethods());
router.use('/api/chat', chat.routes(), chat.allowedMethods());
router.use('/api/group', group.routes(), group.allowedMethods());
router.use('/api/v2/notify', notifyV2.routes(), notifyV2.allowedMethods());

module.exports = router;
