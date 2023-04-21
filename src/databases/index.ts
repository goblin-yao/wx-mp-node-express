import Sequelize from 'sequelize';
import { MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_ADDRESS } from '@config';
import ChatUserModel from '@/models/chatuser.model';
import ChatMessageModel from '@/models/chatmessage.model';
import ChatUserLimitModel from '@/models/chatuserlimit.model';
import ChatUserShareHistoryModel from '@/models/chatusersharehistory.model';
import ChatUserAdvertiseHistoryModel from '@/models/chatuseradvertisehistory.model';
import ChatMemberShipModel from '@/models/chatmembership.model';
import ChatConversationModel from '@/models/chatconversation.model';
import { logger } from '@utils/logger';

const [DB_HOST, DB_PORT] = MYSQL_ADDRESS.split(':');

const sequelizeInstance = new Sequelize.Sequelize('wx_mp_chat', MYSQL_USERNAME, MYSQL_PASSWORD, {
  dialect: 'mysql',
  host: DB_HOST,
  port: Number(DB_PORT),
  timezone: '+08:00',
  pool: {
    min: 0,
    max: 5,
  },
  logQueryParameters: false,
  logging: (query, time) => {
    logger.info(time + 'ms' + ' ' + query);
  },
  benchmark: true,
});

sequelizeInstance.authenticate();

const DB = {
  ChatUser: ChatUserModel(sequelizeInstance),
  ChatMessage: ChatMessageModel(sequelizeInstance),
  ChatUserLimit: ChatUserLimitModel(sequelizeInstance),
  ChatUserShareHistory: ChatUserShareHistoryModel(sequelizeInstance),
  ChatUserAdvertiseHistory: ChatUserAdvertiseHistoryModel(sequelizeInstance),
  ChatMemberShip: ChatMemberShipModel(sequelizeInstance),
  ChatConversation: ChatConversationModel(sequelizeInstance),
  sequelizeInstance, // connection instance (RAW queries)
  Sequelize, // library
};

export default DB;
