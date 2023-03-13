const express = require("express");
const router = express.Router();
const { ChatUsers, ChatMessages, ChatUsersLimit } = require("../database");
const mpController = require("../controllers/miniprogram");
const {
  RESPONSE_CODE,
  MAX_LIMIT_PERDAY,
  MAX_HISTORY_RECORD,
  MAX_HISTORY_SAVE,
} = require("../constants");
const WXMsgChecker = require("../utils/msg_checker");

// 校验用户是否已经有登录，未来可以考虑将这两个接口合并
// 计算分享次数 10次/每人，每日最多6人
router.post("/user/auth", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  const { share_from_openid } = req.body;
  try {
    let [result] = await ChatUsers.findOrCreate({
      where: {
        openid,
      },
    });
    res.send({
      code: RESPONSE_CODE.SUCCESS,
      data: result,
    });
  } catch (error) {
    console.log("errro", error);
    // 未登录时需要传openid给小程序，这样方便后面的操作身份
    res.send({
      code: RESPONSE_CODE.ERROR,
      data: { openid },
    });
  } finally {
    //添加分享次数
    if (openid !== share_from_openid) {
      await mpController.addLimitNumFromShare(openid, share_from_openid);
    }
  }
});

//用户注册
router.post("/user/register", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  const { avatarUrl = 1, nickName = 1 } = req.body;
  try {
    let hasUser = await ChatUsers.findOne({
      where: {
        openid,
      },
    });
    if (hasUser) {
      res.send({
        code: RESPONSE_CODE.ERROR,
        data: hasUser,
      });
      console.log("user already exist", openid);
    } else {
      const result = await ChatUsers.create({
        openid,
        avatarUrl: avatarUrl,
        nickName: nickName,
      });
      res.send({
        code: RESPONSE_CODE.SUCCESS,
        data: result,
      });
    }
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
          attachment: JSON.stringify(data),
        });
        res.send({
          code: RESPONSE_CODE.SUCCESS,
        });
        break;
      }
      default:
    }
  } catch (error) {
    console.log("eerrr=>", error);
    res.send({
      code: RESPONSE_CODE.ERROR,
    });
  }
});

// 获取历史消息记录
router.post("/chatmessage/history", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  try {
    const { count, rows } = await ChatMessages.findAndCountAll({
      attributes: { exclude: ["attachment"] },
      where: { openid },
      order: [
        // 将转义 title 并针对有效方向列表进行降序排列
        ["createdAt", "DESC"],
      ],
      limit: MAX_HISTORY_RECORD,
    });
    res.send({
      code: RESPONSE_CODE.SUCCESS,
      data: { count, rows },
    });
    //超过记录数，删除总数之前的一半
    if (count > MAX_HISTORY_SAVE) {
      console.log("ccc=>", count, MAX_HISTORY_SAVE);
      ChatMessages.destroy({
        where: { openid },
        order: [
          // 将转义 title 并针对有效方向列表进行降序排列
          ["createdAt", "DESC"],
        ],
        limit: MAX_HISTORY_SAVE - MAX_HISTORY_RECORD,
      });
      //超过这个数值，删掉一半数据
    }
  } catch (error) {
    res.send({
      code: RESPONSE_CODE.ERROR,
      data: { count: 0, rows: [] },
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
      new Date(userLimit.updatedAt) <
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
      new Date(userLimit.updatedAt) <
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

router.post("/checker/text", async (req, res) => {
  const openid = req.headers["x-wx-openid"];
  const { content } = req.body;

  const result = await WXMsgChecker(content, { openid });
  res.send(result);
});

module.exports = router;
