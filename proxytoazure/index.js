const axios = require("axios");
async function apiChat(question) {
  try {
    const url = `https://wxchatnodeexpressazure.azurewebsites.net/api/chat`;
    const response = await axios.get(
      `${url}?question=${encodeURIComponent(question)}`,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 300000,
      }
    );
    return response.data;
  } catch (error) {
    console.log("error=>", error);
  }
}

module.exports = {
  apiChat,
};
