const RESPONSE_CODE = { SUCCESS: 200, ERROR: -1 };
const MAX_LIMIT_PERDAY = 5;
const MAX_HISTORY_RECORD = 6;
const MAX_HISTORY_SAVE = 20; //最大存储20条，超过20条的时候删除一半，这样方便查询最大纪录数位6条
module.exports = {
  RESPONSE_CODE,
  MAX_LIMIT_PERDAY,
  MAX_HISTORY_RECORD,
  MAX_HISTORY_SAVE,
};
