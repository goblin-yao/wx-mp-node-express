import { Router } from 'express';
import ProxyAPIController from '@controllers/proxyapi.controller';
import { Routes } from '@interfaces/routes.interface';

class ProxyAPIRoute implements Routes {
  public path = '/proxyapi';
  public router = Router();
  public controller = new ProxyAPIController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/chat`, this.controller.chat);
    this.router.post(`${this.path}/chatstreamstart`, this.controller.chatWithStreamStart);
    this.router.post(`${this.path}/chatstreaminterval`, this.controller.chatWithStreamInterval);
    this.router.get(`${this.path}/getmodels`, this.controller.getModels);

    // 小程序调用，获取微信 Open ID
    // router.get('/wx_openid', async (req, res) => {
    //   if (req.headers['x-wx-source']) {
    //     res.send(req.headers['x-wx-openid']);
    //   }
    // });
  }
}

export default ProxyAPIRoute;
