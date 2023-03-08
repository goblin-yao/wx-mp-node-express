const axios = require("axios");
const { RESPONSE_CODE } = require("../constants");
async function WXMsgChecker(openid, content) {
  try {
    const url = `http://api.weixin.qq.com/wxa/msg_sec_check`;
    const result = await axios.post(
      url,
      {
        openid,
        version: 2,
        scene: 2,
        content,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );
    console.log("WXMsgCheckerdata=>", result.data);
    // data: {
    //     errcode: 41001,
    //     errmsg: 'access_token missing rid: 64083e89-5d0117e2-419e0f1d'
    //   }
    if (result?.data?.result?.suggest == "pass") {
      return {
        code: RESPONSE_CODE.SUCCESS,
      };
    } else {
      return {
        code: RESPONSE_CODE.ERROR,
      };
    }
  } catch (error) {
    console.log("error=>", error);
    return {
      code: RESPONSE_CODE.ERROR,
    };
  }
}

// 导出初始化方法和模型
module.exports = WXMsgChecker;
