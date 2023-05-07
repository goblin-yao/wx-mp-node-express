import { Router } from 'express';
import weChatPayController from '@controllers/wechatpay.controller';
import { Routes } from '@interfaces/routes.interface';

class WeChatPayRoute implements Routes {
  public path = '/wechatpay';
  public router = Router();
  public controller = new weChatPayController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/notitest`, this.controller.notiTest);
    this.router.get(`${this.path}/payment`, this.controller.showPaymentPage);

    //支付下单
    this.router.post(`${this.path}/checkout`, this.controller.checkout);

    // 支付结果noti
    this.router.post(`${this.path}/noti`, this.controller.noti);
  }
}

export default WeChatPayRoute;
