const axios = require("axios");
// async function apiChatGet(question) {
//   try {
//     const url = `https://wxchatnodeexpressazure.azurewebsites.net/api/chat`;
//     const response = await axios.get(
//       `${url}?question=${encodeURIComponent(question)}`,
//       {
//         headers: { "Content-Type": "application/json" },
//         timeout: 30000,
//       }
//     );
//     return response.data;
//   } catch (error) {
//     console.log("error=>", error);
//     return {
//       statusCode: error?.response?.status || -1001,
//       data: error?.response?.data || "服务内部错误!",
//     };
//   }
// }

async function apiChat(question) {
  const body = { question };
  const statTime = new Date();
  try {
    const url = `https://wxchatnodeexpressazure.azurewebsites.net/api/chat`;
    // const url = `http://localhost:3000/api/chat`; // for local dev
    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });
    console.log("request time=>", new Date() - statTime);
    return response.data;
  } catch (error) {
    console.log("request error time=>", new Date() - statTime);
    console.log("error=>", error);
    return {
      statusCode: error?.response?.status || -1001,
      data: error?.response?.data || "服务内部错误!",
    };
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
