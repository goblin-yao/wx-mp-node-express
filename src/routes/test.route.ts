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
      res.sendFile(path.join(__dirname, '../../test.html'));
    });
  }
}

export default IndexRoute;
