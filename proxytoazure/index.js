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
async function apiGetModels() {
  try {
    const url = `https://wxchatnodeexpressazure.azurewebsites.net/api/getModels`;
    const response = await axios.get(`${url}`, {
      headers: { "Content-Type": "application/json" },
      timeout: 300000,
    });
    console.log("response=>", response);
    return response.data;
  } catch (error) {
    console.log("error=>", error);
  }
}

module.exports = { apiGetModels, apiChat };
