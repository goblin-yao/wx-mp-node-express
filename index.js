const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB } = require("./database");
const logger = morgan("tiny");
const indexRouter = require("./routes/index");
const openaiRouter = require("./routes/openai");
const miniprogramRouter = require("./routes/miniprogram");
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

app.use("/", indexRouter);
app.use("/openai", openaiRouter);
app.use("/miniprogram", miniprogramRouter);

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();

  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
