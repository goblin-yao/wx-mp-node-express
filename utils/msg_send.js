const axios = require("axios");
async function customSendMessage(appid, mess) {
  const url = `http://api.weixin.qq.com/cgi-bin/message/custom/send?from_appid=${appid}`;
  try {
    const result = await axios.post(url, mess, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });
    return result.body;
  } catch (error) {
    return -1;
  }
}

module.exports = customSendMessage;
