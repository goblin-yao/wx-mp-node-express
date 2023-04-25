import { Router } from 'express';
import WebController from '@controllers/web.controller';
import { Routes } from '@interfaces/routes.interface';
import rateLimit from 'express-rate-limit';

class WebAPIRoute implements Routes {
  public path = '/web';
  public router = Router();
  public controller = new WebController();
  // 创建限流中间件
  public limiter = rateLimit({
    windowMs: 10 * 1000, // 10秒最多允许1次请求
    max: 1,
    keyGenerator: function (req) {
      // 根据 IP 地址和用户 ID, openid等 生成唯一标识
      const userFlag = req.ip + '-' + (req.cookies['openid'] || req.headers['x-wx-openid']);

      console.log('[userFlag]', userFlag);
      return userFlag;
    },
    message: '请求过于频繁，请稍后再试！',
  });

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/checklogin`, this.controller.checkLogin);

    this.router.post(`${this.path}/baidu/chat`, this.limiter, this.controller.chatWithGPT);
    this.router.post(`${this.path}/conversation/list`, this.controller.getAllConversation);
    this.router.post(`${this.path}/conversation/create`, this.controller.createConversation);
    this.router.post(`${this.path}/conversation/update`, this.controller.updateConversation);
    this.router.post(`${this.path}/conversation/delete`, this.controller.deleteConversation);
    this.router.post(`${this.path}/conversation/deleteallandcreateone`, this.controller.deleteAllAndCreateOne);

    this.router.post(`${this.path}/messages/list`, this.controller.getMessagesHistory);
  }
}

export default WebAPIRoute;
