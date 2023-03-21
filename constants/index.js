const RESPONSE_CODE = { SUCCESS: 200, ERROR: -1 };
const MAX_LIMIT_PERDAY = 50; //每天最大次数
const TIME_FOR_NEW_USER = 40; //新用户40次
const MAX_HISTORY_RECORD = 50;
const MAX_HISTORY_SAVE = 60; //最大存储60条，超过60条的时候删除最早的10条，这样方便查询最大纪录数位50条
const LIMIT_NUM_FROM_SHARE_PERDAY = {
  MAX_NUM_PERSHARE: 10,
  MAX_USER_NUM: 6,
}; //从分享中获取的次数: 奖励10次/每次分享，每日分享到最多6人

module.exports = {
  RESPONSE_CODE,
  MAX_LIMIT_PERDAY,
  MAX_HISTORY_RECORD,
  MAX_HISTORY_SAVE,
  LIMIT_NUM_FROM_SHARE_PERDAY,
};
