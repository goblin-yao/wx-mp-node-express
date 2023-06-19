import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { NextFunction, Request, Response } from 'express';
import path from 'path';

class IndexRoute implements Routes {
  public path = '/test';
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, (req: Request, res: Response, next: NextFunction) => {
      const { unionid } = req.cookies;
      //超级管理员才能进入测试页面
      if (unionid == 'ob881412W91pK_Tm_R-pekQdogEI') {
        res.sendFile(path.join(__dirname, '../static_pages/test.html'));
      } else {
        res.status(403).json({
          code: -1,
        });
      }
    });
  }
}

export default IndexRoute;
