const express = require("express");
const router = express.Router();

const proxyToAzure = require("../proxytoazure");

router.post("/chat", async (req, res) => {
  const { question } = req.body;
  // send a message and wait for the response
  let response = {};
  try {
    response = await proxyToAzure.apiChat(question);
  } catch (error) {
    response.error = error;
  }
  res.send(response);
});

router.get("/getModels", async (req, res) => {
  let response = {};
  try {
    response = await proxyToAzure.apiGetModels();
  } catch (error) {
    response.error = error;
  }
  res.send(response);
});

// 小程序调用，获取微信 Open ID
router.get("/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});
module.exports = router;
