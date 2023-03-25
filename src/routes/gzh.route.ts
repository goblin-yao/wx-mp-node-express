import { Router } from 'express';
import gzhController from '@controllers/gzh.controller';
import { Routes } from '@interfaces/routes.interface';

class GZHRoute implements Routes {
  public path = '/gzh';
  public router = Router();
  public controller = new gzhController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/message`,this.controller.messageHandler),
    // 小程序调用，获取微信 Open ID
    // router.get('/wx_openid', async (req, res) => {
    //   if (req.headers['x-wx-source']) {
    //     res.send(req.headers['x-wx-openid']);
    //   }
    // });
  }
}

export default GZHRoute;
