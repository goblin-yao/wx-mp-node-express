import { Router } from 'express';
import wxOpenAPIController from '@controllers/wxopenapi.controller';
import { Routes } from '@interfaces/routes.interface';

class WXOpenAPIRoute implements Routes {
  public path = '/wxopenapi';
  public router = Router();
  public controller = new wxOpenAPIController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/login`, this.controller.login);
    this.router.get(`${this.path}/callback`, this.controller.callback);
    this.router.get(`${this.path}/getloginuserinfo`, this.controller.getLoginUserInfo);
  }
}

export default WXOpenAPIRoute;
