import Debug from 'debug';
import { EventFunc } from 'trpg/core';
import _ from 'lodash';
import { ActorTemplate } from './models/template';
import { PlayerUser } from 'packages/Player/lib/models/user';
const debug = Debug('trpg:component:actor:event');

export const getTemplate: EventFunc<{
  uuid: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  const player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }

  const uuid = data.uuid;
  if (!uuid || typeof uuid !== 'string') {
    // 返回个人所有的模板
    const user = await db.models.player_user.findOne({
      where: {
        uuid: player.uuid,
      },
    });
    const templates = await user.getTemplates();
    return { templates };
  } else {
    // 返回指定模板信息
    const template = await db.models.actor_template.findOne({
      where: {
        uuid,
      },
    });
    return { template };
  }
};

/**
 * 获取推荐角色模板
 */
export const getSuggestTemplate: EventFunc<{}> = async function(data, cb, db) {
  const templates = await ActorTemplate.findAll({
    where: {
      built_in: true,
      is_public: true,
    },
  });

  return { templates };
};

export const findTemplate: EventFunc<{
  name: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  const player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }

  let nameFragment = data.name;
  if (!nameFragment) {
    throw '缺少必要参数';
  }

  let templates = await (db.models.actor_template as any).findTemplateAsync(
    nameFragment
  );
  for (let template of templates) {
    let creator = await template.getCreator();
    if (creator) {
      template.dataValues.creator_name = creator.getName();
    }
  }
  return { templates };
};

export const createTemplate: EventFunc<{
  name: string;
  desc?: string;
  avatar?: string;
  info: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  let player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }

  let name = data.name;
  let desc = data.desc || '';
  let avatar = data.avatar || '';
  let info = data.info;

  if (!name) {
    throw '缺少模板名';
  }

  if (!info) {
    throw '缺少模板信息';
  }

  let isExistTemplate = await db.models.actor_template.findOne({
    where: { name },
  });
  if (isExistTemplate) {
    throw '该模板名字已存在';
  }

  const user = await PlayerUser.findByUUID(player.uuid);
  let template = await db.models.actor_template.create({
    name,
    desc,
    avatar,
    info,
  });
  await template.setCreator(user);
  return { template };
};

export const updateTemplate: EventFunc<{
  uuid: string;
  name: string;
  desc: string;
  avatar: string;
  info: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  const player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }

  const uuid = data.uuid;
  const name = data.name;
  const desc = data.desc;
  const avatar = data.avatar;
  const info = data.info;

  if (!uuid || typeof uuid !== 'string') {
    throw '缺少必要参数';
  }

  let template = await db.models.actor_template.findOne({
    where: { uuid },
  });
  const user = await PlayerUser.findByUUID(player.uuid);
  if (template.creatorId !== user.id) {
    throw '您不是该模板的所有者，无法修改模板';
  }
  if (name) {
    template.name = name;
  }
  if (desc) {
    template.desc = desc;
  }
  if (avatar) {
    template.avatar = avatar;
  }
  if (info) {
    template.info = info;
  }
  template = await template.save();

  return { template };
};

export const removeTemplate: EventFunc<{
  uuid: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  const player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }

  const uuid = data.uuid;
  const user = await PlayerUser.findByUUID(player.uuid);
  const template = await db.models.actor_template.findOne({
    where: {
      uuid,
      creatorId: user.id,
    },
  });
  if (!template) {
    throw '删除失败，找不到该模板';
  }
  await template.destroy();
  return true;
};

export const createActor: EventFunc<{
  name: string;
  avatar: string;
  desc: string;
  info: {};
  template_uuid: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  const player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }

  const name = data.name;
  const avatar = data.avatar;
  const desc = data.desc;
  const info = data.info || {};
  const template_uuid = data.template_uuid;
  if (!name) {
    throw '人物名不能为空';
  }

  let actor = null;
  await db.transactionAsync(async () => {
    actor = await db.models.actor_actor.create({
      name,
      avatar,
      desc,
      info,
      template_uuid,
    });
    const user = await PlayerUser.findByUUID(player.uuid);
    await actor.setOwner(user);
    if (!!avatar) {
      let tmp = avatar.split('/');
      let avatarModel = await db.models.file_avatar.findOne({
        where: {
          name: tmp[tmp.length - 1],
        },
      });
      if (avatarModel) {
        avatarModel.attach_uuid = actor.uuid;
        avatarModel.save(); // 不使用await，做一个延时返回
      }
    }
  });

  if (actor) {
    return { actor: actor.getObject() };
  } else {
    return false;
  }
};

export const getActor: EventFunc<{
  uuid: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  const player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }

  const uuid = data.uuid;
  if (uuid) {
    // 返回指定的actor
    let actor = await db.models.actor_actor.findOne({ where: { uuid } });
    return { actor };
  } else {
    // 返回当前用户所有的actor
    let user = await db.models.player_user.findOne({
      where: { uuid: player.uuid },
    });
    let actors = await user.getActors();
    return { actors };
  }
};

export const removeActor: EventFunc<{
  uuid: string;
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  let player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }
  let uuid = data.uuid;
  if (!uuid) {
    throw '缺少必要参数';
  }

  await db.transactionAsync(async () => {
    const user = await PlayerUser.findByUUID(player.uuid);
    let actor = await db.models.actor_actor.findOne({
      where: {
        uuid,
        ownerId: user.id,
      },
    });
    if (!actor) {
      throw '没有找到该角色';
    }
    await actor.destroy();

    if (db.models.group_actor) {
      // 如果有group actor模型
      // 移除所有相关的团角色
      await db.models.group_actor.destroy({
        where: { actor_uuid: uuid },
      });
    }
  });
  return true;
};

export const updateActor: EventFunc<{
  uuid: string;
  name: string;
  avatar: string;
  desc: string;
  info: {};
}> = async function(data, cb, db) {
  const app = this.app;
  const socket = this.socket;

  const player = app.player.manager.findPlayer(socket);
  if (!player) {
    throw '用户不存在，请检查登录状态';
  }
  const user = await PlayerUser.findByUUID(player.uuid);
  const userId = user.id;

  const uuid = data.uuid;
  const name = data.name;
  const avatar = data.avatar;
  const desc = data.desc;
  const info = data.info || {};
  if (!uuid) {
    throw '缺少必要参数';
  }
  if (!name) {
    throw '人物名不能为空';
  }

  return await db.transactionAsync(async () => {
    let actor = await db.models.actor_actor.findOne({
      where: { uuid, ownerId: userId },
    });
    if (_.isNil(actor)) {
      throw new Error('无法更新角色信息: 该角色不存在');
    }

    let oldAvatar = actor.avatar.toString();
    actor.name = name;
    actor.avatar = avatar;
    actor.desc = desc;
    actor.info = info;
    let saveActor = await actor.save();

    if (db.models.file_avatar && oldAvatar && oldAvatar !== avatar) {
      // 更新avatar的attach

      const user = await PlayerUser.findByUUID(player.uuid);
      let oldtmp = oldAvatar.split('/');
      let tmp = avatar.split('/');
      let userId = user.id;
      let oldAvatarInstance = await db.models.file_avatar.findOne({
        where: {
          name: oldtmp[oldtmp.length - 1],
          ownerId: userId,
        },
        order: [['id', 'DESC']],
      });
      if (oldAvatarInstance) {
        oldAvatarInstance.attach_uuid = null;
        await oldAvatarInstance.save();
      }

      let avatarInstance = await db.models.file_avatar.findOne({
        where: {
          name: tmp[tmp.length - 1],
          ownerId: userId,
        },
        order: [['id', 'DESC']],
      });
      avatarInstance.attach_uuid = uuid;
      await avatarInstance.save();
    }

    return { actor: saveActor.getObject() };
  });
};
