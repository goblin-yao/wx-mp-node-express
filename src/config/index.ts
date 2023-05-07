import { getTimeStampOfMonthLater } from '@/utils/util';
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
export const PROMPT_TEXT = `Instructions:\nYou are "${ASSISTANT_LABEL_DEFAULT}" developed by Baidu(百度), your Chinese name is "${ASSISTANT_LABEL_DEFAULT_Chinese}", respond to questions using concise, anthropomorphic style\n`;

// PROMPT types
export enum PROMPTS_TYPE {
  DEFAULT = 1,
  // other roles
}
// prompt列表
export const PROMPTS_VALUES = {
  [PROMPTS_TYPE.DEFAULT]: PROMPT_TEXT,
};

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
  WX_MERCHANTID = '1641448691', // 微信支付的商户ID
  GZH_APPID = 'wx41374d9ae1f0b6d4', //公众号的appid用于公众号的网页H5支付和公众号登录
  GZH_SECRET_KEY = '7074401242607a5f5d591858bfeca914',
  WEB_WX_APPID = 'wx8742408cc7f68cbd', //网页版的appid用于网页版的支付
  WEB_WX_SECRET_KEY = 'd7058287afea92b8f0da389da213bfaf',
  APIV3KEY = '3d6be0a4035d839573b04816624a415e', //【微信商户平台—>账户设置—>API安全—>设置APIv3密钥】
} = process.env;
/**
 * 这些配置在本地
 */
export const PORT = 80;
export const NODE_ENV = process.env.NODE_ENV || 'production';
export const LOG_FORMAT = 'dev';
export const LOG_DIR = '../logs';

export const CONSTANTS = {
  CONVERSATION: { MAX_COUNT: 10, DEFAULT_PROMPT: PROMPTS_TYPE.DEFAULT },
  RESPONSE_CODE: { SUCCESS: 200, ERROR: -1, USER: { NewUser: 101 } },
  LIMIT_FREE_PERDAY: 5, //每日赠送5次
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
  GZH_DAKA_TEXTS: ['领声语次数', '声语'],
  GZH_DAKA_1_TEXTS: ['领达人助手次数', '达人助手'],
  // Azure云服务的代理地址
  // "http://localhost:80/proxy" 本地开发
  //AWS https://dfpcwg6xrm.us-east-1.awsapprunner.com/proxy
  OPENAI_PROXY_URL: ['https://wxchatnodeexpressazure.azurewebsites.net/proxy'],
};

/**
 * 购买类型和时间的配置
 */
export const WX_BUYER = {
  '11': {
    totalMoney: 1,
    type: 'MemberShip',
    ranger: () => {
      return 24 * 3600;
    },
  },
  '12': {
    totalMoney: 2,
    type: 'MemberShip',
    ranger: () => {
      return getTimeStampOfMonthLater(1);
    },
  },
  '13': {
    totalMoney: 3,
    type: 'MemberShip',
    ranger: () => {
      return getTimeStampOfMonthLater(3);
    },
  },
  '21': {
    totalMoney: 4,
    type: 'BuyTimes',
    ranger: () => {
      return 10;
    },
  },
  '22': {
    totalMoney: 5,
    type: 'BuyTimes',
    ranger: () => {
      return 35;
    },
  },
  '23': {
    totalMoney: 6,
    type: 'BuyTimes',
    ranger: () => {
      return 60;
    },
  },
};
