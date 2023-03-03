const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const logger = morgan("tiny");
const chatgptlib = require("./chatgptlib");

//这个来源是由wx-mp-node项目中的ts文件构建出来的
const chatGPTapi = new chatgptlib.ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
});
const chatGPTTurboapi = new chatgptlib.ChatGPTAPITURBO({
  apiKey: process.env.OPENAI_API_KEY,
});

function getChatGPTAPI() {
  if (process.env.CHATGPT_MODEL === "gpt-3.5-turbo") {
    return chatGPTTurboapi;
  }
  return Math.random() > 0.5 ? chatGPTTurboapi : chatGPTapi;
}

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
  // send a message and wait for the response
  let response = {};
  try {
    response = await getChatGPTAPI().sendMessage(question);
  } catch (error) {
    response.error = error;
  }
  res.send(response);
});

app.get("/api/getModels", async (req, res) => {
  const { question } = req.body;
  // send a message and wait for the response
  let response = {};
  try {
    response = await getChatGPTAPI().getModels(question);
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
