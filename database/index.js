const { Sequelize, DataTypes } = require("sequelize");

// 从环境变量中读取数据库配置
const { MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_ADDRESS } = process.env;

const [host, port] = MYSQL_ADDRESS.split(":");

const sequelize = new Sequelize("wx_mp_chat", MYSQL_USERNAME, MYSQL_PASSWORD, {
  host,
  port,
  dialect: "mysql" /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */,
});

// 定义数据模型
const ChatUsers = sequelize.define("chat_users", {
  openid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  unionid: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // 公众号的openid，打通 unionid，后期全部通过unionid标记身份
  // head头的信息参考项目中的 _temp/request_head.md 
  gzh_openid: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  avatarUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nickName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// 数据模型：消息记录
const ChatMessages = sequelize.define("chat_messages", {
  openid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  msgType: {
    type: DataTypes.TINYINT,
    allowNull: false,
  },
  conversationId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  messageId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentMessageId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  attachment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

const ChatUsersLimit = sequelize.define("chat_users_limits", {
  openid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  chat_left_nums: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

const ChatUsersShareHistory = sequelize.define("chat_users_share_histories", {
  // 分享人
  openid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // 谁进入分享页面
  by_openid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // 分享的标记，预留
  share_flag: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// 数据库初始化方法
async function init() {
  await ChatUsers.sync({ alter: false });
  await ChatMessages.sync({ alter: false });
  await ChatUsersLimit.sync({ alter: false });
  await ChatUsersShareHistory.sync({ alter: false });
}

// 导出初始化方法和模型
module.exports = {
  init,
  ChatUsers,
  ChatMessages,
  ChatUsersLimit,
  ChatUsersShareHistory,
};
