const mpController = {};
const { Op } = require("sequelize");
const { ChatUsersShareHistory, ChatUsersLimit } = require("../database");
const {
  RESPONSE_CODE,
  MAX_LIMIT_PERDAY,
  MAX_HISTORY_RECORD,
  MAX_HISTORY_SAVE,
  LIMIT_NUM_FROM_SHARE_PERDAY,
} = require("../constants");
const SubscribSend = require("../utils/subscribe_send");

mpController.addLimitNumFromShare = async (openid, share_from_openid) => {
  // 判断今天总记录数是否大于指定次数
  const recordToday = await ChatUsersShareHistory.count({
    where: {
      openid: share_from_openid,
      updatedAt: {
        [Op.gt]: new Date(new Date().toLocaleDateString()),
      },
    },
  });
  console.log("recordToday=>", recordToday);
  if (recordToday < LIMIT_NUM_FROM_SHARE_PERDAY.MAX_USER_NUM) {
    // 查询两个openid的分享交互，如果有创建时间大于今天0点的内容。就不增加次数
    const [record, isCreated] = await ChatUsersShareHistory.findOrCreate({
      where: {
        openid: share_from_openid,
        by_openid: openid,
      },
    });
    console.log("[record, isCreated]", record.toJSON(), isCreated);
    //是新创建的 或者 不是新创建的 判断更新时间小于今天，增加10次
    if (
      isCreated ||
      (!isCreated &&
        new Date(record.updatedAt) <
          new Date(new Date().toLocaleDateString()).getTime())
    ) {
      if (!isCreated) {
        await record.update({ share_flag: String(new Date().getTime()) });
        await record.save();
      }

      // 增加10次次数
      let userLimit = await ChatUsersLimit.findOne({
        where: { openid: share_from_openid },
      });
      //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
      await userLimit.update({
        chat_left_nums:
          userLimit.chat_left_nums +
          LIMIT_NUM_FROM_SHARE_PERDAY.MAX_NUM_PERSHARE,
      });
      await userLimit.save();
      // await SubscribSend({ toOpenId: share_from_openid });
    }
  }
};

module.exports = mpController;
