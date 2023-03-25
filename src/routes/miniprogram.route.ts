import { Router } from 'express';
import mpController from '@controllers/miniprogram.controller';
import { Routes } from '@interfaces/routes.interface';

class MiniProgramAPIRoute implements Routes {
  public path = '/miniprogram';
  public router = Router();
  public controller = new mpController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/user/auth`, this.controller.userAuth);
    this.router.post(`${this.path}/user/register`, this.controller.userRegister);
    this.router.post(`${this.path}/chatmessage/add`, this.controller.addChatMessage);
    this.router.post(`${this.path}/chatmessage/history`, this.controller.getChatMessages);
    this.router.post(`${this.path}/limit/reduce`, this.controller.limitReduce);
    this.router.post(`${this.path}/limit/get`, this.controller.limitGet);
    this.router.post(`${this.path}/checker/text`, this.controller.checkText);
    this.router.post(`${this.path}/subscribe/test`, this.controller.subscribeSend);

    // 小程序调用，获取微信 Open ID
    // router.get('/wx_openid', async (req, res) => {
    //   if (req.headers['x-wx-source']) {
    //     res.send(req.headers['x-wx-openid']);
    //   }
    // });
  }
}

export default MiniProgramAPIRoute;
