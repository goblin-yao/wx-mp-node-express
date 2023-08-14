import { Router } from 'express';
import ExampleController from '@controllers/example.controller';
import { Routes } from '@interfaces/routes.interface';
import rateLimit from 'express-rate-limit';

class WebAPIRoute implements Routes {
  public path = '/example';
  public router = Router();
  public controller = new ExampleController();
  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/checkLoginTemp`, this.controller.checkLoginTemp);
    this.router.post(`${this.path}/checklogin`, this.controller.checkLogin);
    this.router.post(`${this.path}/registeruser`, this.controller.registerUser);
    this.router.get(`${this.path}/index`, this.controller.exampleIndex);
    this.router.get(`${this.path}/register`, this.controller.exampleRegister);
  }
}

export default WebAPIRoute;
