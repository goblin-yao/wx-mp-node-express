const axios = require("axios");
async function customSendMessage(appid, mess) {
  let url = `http://api.weixin.qq.com/cgi-bin/message/custom/send`;
  if (appid) {
    url = `http://api.weixin.qq.com/cgi-bin/message/custom/send?from_appid=${appid}`;
  }
  try {
    const result = await axios.post(url, mess, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });
    console.log("message/custom/send result=>", result.data);
    return result.data;
  } catch (error) {
    console.log("message/custom/send error", error);
    return -1;
  }
}

module.exports = customSendMessage;
