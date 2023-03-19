const axios = require("axios");
const { LIMIT_NUM_FROM_SHARE_PERDAY } = require("../constants");
async function subscribeSend(option) {
  let url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send`;
  try {
    const result = await axios.post(
      url,
      {
        touser: option.toOpenId,
        template_id: "gDR3LuQ-JEOtfmT_ug40QcT6uk4kFPTHMuAVXyD3GqQ",
        page: "index",
        miniprogram_state: "trial", //跳转小程序类型：developer为开发版；trial为体验版；formal为正式版；默认为正式版
        lang: "zh_CN",
        data: {
          //积分类型
          thing1: {
            value: "你通过分享增加了次数",
          },
          //积分数量
          number2: {
            value: LIMIT_NUM_FROM_SHARE_PERDAY.LIMIT_NUM_FROM_SHARE_PERDAY,
          },
          // 温馨提醒
          thing3: {
            value: "点击进入小程序使用",
          },
        },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );
    console.log("message/subscribe/send result=>", result.data);
    return result.data;
  } catch (error) {
    console.log("message/subscribe/send error", error);
    return -1;
  }
}

module.exports = subscribeSend;
