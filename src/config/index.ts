import { config } from 'dotenv';
// live环境配置在微信云托管
if (process.env.NODE_ENV === 'development') {
  config({ path: `.env.development.local` });
}
// else {
//   config({ path: `.env.production.local` });
// }

export const USER_LABEL_DEFAULT = 'User';
export const ASSISTANT_LABEL_DEFAULT = `Ernie Bot`;
export const ASSISTANT_LABEL_DEFAULT_Chinese = `文心一言`;
// 你是${this._assistantLabel}.使用简洁，拟人化的方式回答问题
export const PROMPT_TEXT = `Instructions:\nYou are "${ASSISTANT_LABEL_DEFAULT}", your Chinese name is "${ASSISTANT_LABEL_DEFAULT_Chinese}", respond to questions using concise, anthropomorphic style\n`;

/**
 * 这些配置在微信云托管
 */
export const {
  OPENAI_API_KEY,
  CHATGPT_MODEL_GPT = 'gpt-3.5-turbo',
  CHATGPT_MODEL = 'text-davinci-003',
  MYSQL_USERNAME,
  MYSQL_PASSWORD,
  MYSQL_ADDRESS,
  SUBSCRIBE_TEMPLATE_ID,
} = process.env;
/**
 * 这些配置在本地
 */
export const PORT = 80;
export const NODE_ENV = process.env.NODE_ENV || 'production';
export const LOG_FORMAT = 'dev';
export const LOG_DIR = '../logs';

export const CONSTANTS = {
  RESPONSE_CODE: { SUCCESS: 200, ERROR: -1, USER: { NewUser: 101 } },
  MAX_LIMIT_PERDAY: 50, //每天最大次数
  TIME_FOR_NEW_USER: 40, //新用户40次,
  MAX_HISTORY_RECORD: 50,
  MAX_HISTORY_SAVE: 60, //最大存储60条，超过60条的时候删除最早的10条，这样方便查询最大纪录数位50条
  //从分享中获取的次数: 奖励10次/每次分享，每日分享到最多6人
  LIMIT_NUM_FROM_SHARE_PERDAY: {
    MAX_NUM_PERSHARE: 10,
    MAX_USER_NUM: 6,
  },
  LIMIT_NUM_FROM_GZH: 10, //公众号回复关键词每日10次
  //看广告 3次/每个，每日最多12次
  LIMIT_NUM_FROM_ADVERTISE_PERDAY: {
    MAX_NUM_PERVIEW: 3,
    MAX_TIMES_PERDAY: 12,
  },
  GZH_DAKA_TEXTS: ['增加使用次数', '打卡'],
  GZH_DAKA_1_TEXTS: ['增加使用次数1', '打卡1'],
  // Azure云服务的代理地址
  // "http://localhost:80/proxy" 本地开发
  //AWS
  OPENAI_PROXY_URL: ['https://wxchatnodeexpressazure.azurewebsites.net/proxy', 'https://dfpcwg6xrm.us-east-1.awsapprunner.com/proxy'],
};
