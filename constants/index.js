module.exports = {
  RESPONSE_CODE: { SUCCESS: 200, ERROR: -1 },
  MAX_LIMIT_PERDAY: 50, //每天最大次数
  TIME_FOR_NEW_USER: 40, //新用户40次,
  MAX_HISTORY_RECORD: 50,
  MAX_HISTORY_SAVE: 60, //最大存储60条，超过60条的时候删除最早的10条，这样方便查询最大纪录数位50条
  LIMIT_NUM_FROM_SHARE_PERDAY: {
    MAX_NUM_PERSHARE: 10,
    MAX_USER_NUM: 6,
  }, //从分享中获取的次数: 奖励10次/每次分享，每日分享到最多6人
};
