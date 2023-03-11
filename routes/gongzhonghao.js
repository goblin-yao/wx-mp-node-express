const express = require("express");
const router = express.Router();
const WXMsgChecker = require("../utils/msg_checker");
const customSendMessage = require("../utils/msg_send");
const proxyToAzure = require("../proxytoazure");

// 微信消息推送 https://developers.weixin.qq.com/miniprogram/dev/wxcloudrun/src/development/weixin/callback.html
router.post("/messages/send", async (req, res) => {
  // 从 header 中取appid，如果 from-appid 不存在，则不是资源复用场景，可以直接传空字符串，使用环境所属账号发起云调用
  const appid = req.headers["x-wx-from-appid"] || "";
  console.log("unionid=>", req.headers["x-wx-from-unionid"] || "");

  const { ToUserName, FromUserName, MsgType, Content, CreateTime } = req.body;
  console.log("推送接收的账号", { appid, body: req.body });
  if (MsgType === "text") {
    const msgResult = await WXMsgChecker(Content, {
      openid: FromUserName,
      appid,
    });
    let replyMsg = "";
    if (msgResult.code === -1) {
      replyMsg = "内容含有敏感词";
    } else {
      try {
        let response = await proxyToAzure.apiChat(Content);
        replyMsg = response.text;
      } catch (error) {
        replyMsg = "服务器超时";
      }
    }
    // 小程序、公众号可用
    try {
      let _reslut = await customSendMessage(appid, {
        openid: FromUserName,
        touser: FromUserName,
        msgtype: "text",
        text: {
          content: replyMsg,
        },
      });
      console.log("_reslut", _reslut);
    } catch (error) {}
    res.send("success");
  } else {
    res.send("success");
  }
});

module.exports = router;
