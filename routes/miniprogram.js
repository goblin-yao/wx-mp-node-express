const express = require("express");
const router = express.Router();
const { ChatUsers, ChatMessages, ChatUsersLimit } = require("../database");
const {
  RESPONSE_CODE,
  MAX_LIMIT_PERDAY,
  MAX_HISTORY_RECORD,
} = require("../constants");

// 校验用户是否已经有登录
router.post("/user/auth", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  console.log("1=>", openid);
  try {
    let result = await ChatUsers.findOne({
      where: {
        openid,
      },
    });
    if (result) {
      res.send({
        code: RESPONSE_CODE.SUCCESS,
        data: result,
      });
    } else {
      res.send({
        code: RESPONSE_CODE.ERROR,
        data: { openid },
      });
    }
  } catch (error) {
    // 未登录时需要传openid给小程序，这样方便后面的操作身份
    res.send({
      code: RESPONSE_CODE.ERROR,
      data: { openid },
    });
  }
});

//用户注册
router.post("/user/register", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  const { avatarUrl, nickName } = req.body;
  try {
    const result = await ChatUsers.create({
      openid,
      avatarUrl: avatarUrl,
      nickName: nickName,
    });
    res.send({
      code: RESPONSE_CODE.SUCCESS,
      data: result,
    });
  } catch (error) {
    res.send({
      code: RESPONSE_CODE.ERROR,
    });
  }
});

// 添加消息记录
router.post("/chatmessage/add", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  const { msgType, data } = req.body;
  try {
    const content = data.text;
    switch (msgType) {
      // 1表示用户的文字信息
      case 1: {
        const result = await ChatMessages.create({
          openid,
          msgType,
          content,
        });
        res.send({
          code: RESPONSE_CODE.SUCCESS,
          data: result,
        });
        break;
      }
      // 2表示chatgpt文字的答案
      case 2: {
        const result = await ChatMessages.create({
          openid,
          msgType,
          content,
          attachment: data,
        });
        res.send({
          code: RESPONSE_CODE.SUCCESS,
          data: result,
        });
        break;
      }
      default:
    }
  } catch (error) {
    res.send({
      code: RESPONSE_CODE.ERROR,
    });
  }
});

// 获取历史消息记录
router.post("/chatmessage/history", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  try {
    const result = await ChatMessages.findAll({
      where: { openid },
      order: [
        // 将转义 title 并针对有效方向列表进行降序排列
        ["createdAt", "DESC"],
      ],
      limit: MAX_HISTORY_RECORD,
    });

    res.send({
      code: RESPONSE_CODE.SUCCESS,
      data: result,
    });
  } catch (error) {
    res.send({
      code: RESPONSE_CODE.ERROR,
      data: [],
    });
  }
});

// 减少次数
router.post("/limit/reduce", async (req, res) => {
  const openid = req.headers["x-wx-openid"];

  let userLimit = null;
  try {
    userLimit = await ChatUsersLimit.findOne({ where: { openid } });
    //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
    if (
      new Date(userLimit.updateAt) <
        new Date(new Date().toLocaleDateString()).getTime() &&
      userLimit.chat_left_nums < MAX_LIMIT_PERDAY
    ) {
      await userLimit.update({ chat_left_nums: MAX_LIMIT_PERDAY - 1 });
      await userLimit.save();
      return res.send({
        code: RESPONSE_CODE.SUCCESS,
        chat_left_nums: MAX_LIMIT_PERDAY - 1,
      }); // 最新的剩余次数
    }

    let leftTimes = userLimit.chat_left_nums;

    if (leftTimes == 0) {
      //说明次数到了，不做处理
      return res.send({
        code: RESPONSE_CODE.SUCCESS,
        chat_left_nums: leftTimes,
      }); // 最新的剩余次数0次
    } else {
      leftTimes--;
    }

    await userLimit.update({ chat_left_nums: leftTimes });
    await userLimit.save();
    return res.send({
      code: RESPONSE_CODE.SUCCESS,
      chat_left_nums: leftTimes,
    }); // 最新的剩余次数次
  } catch (error) {
    //没有记录，创建最新的
    if (!userLimit) {
      await ChatUsersLimit.create({
        openid,
        chat_left_nums: MAX_LIMIT_PERDAY - 1,
      });
    }
    // 出现异常就返回新的
    return res.send({
      code: RESPONSE_CODE.ERROR,
      chat_left_nums: MAX_LIMIT_PERDAY - 1,
    });
  }
});

router.post("/limit/get", async (req, res) => {
  const openid = req.headers["x-wx-openid"];

  let userLimit = null;
  try {
    userLimit = await ChatUsersLimit.findOne({ where: { openid } });
    //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
    if (
      new Date(userLimit.updateAt) <
        new Date(new Date().toLocaleDateString()).getTime() &&
      userLimit.chat_left_nums < MAX_LIMIT_PERDAY
    ) {
      await userLimit.update({ chat_left_nums: MAX_LIMIT_PERDAY });
      await userLimit.save();
      return res.send({
        code: RESPONSE_CODE.SUCCESS,
        chat_left_nums: MAX_LIMIT_PERDAY,
      }); // 最新的剩余次数
    }
    return res.send({
      code: RESPONSE_CODE.SUCCESS,
      chat_left_nums: userLimit.chat_left_nums,
    });
  } catch (error) {
    //没有记录，创建最新的
    if (!userLimit) {
      await ChatUsersLimit.create({ openid, chat_left_nums: MAX_LIMIT_PERDAY });
    }
    // 出现异常就返回新的
    return res.send({
      code: RESPONSE_CODE.ERROR,
      chat_left_nums: MAX_LIMIT_PERDAY,
    });
  }
});

module.exports = router;
