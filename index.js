const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const logger = morgan("tiny");
const proxyToAzure = require("./proxytoazure");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

// 更新计数
app.post("/api/chat", async (req, res) => {
  const { question } = req.body;
  console.log("question=>", question);
  // send a message and wait for the response
  let response = {};
  try {
    response = await proxyToAzure.apiChat(question);
  } catch (error) {
    response.error = error;
  }
  res.send(response);
});

const port = process.env.PORT || 80;

async function bootstrap() {
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
