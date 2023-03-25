import { NextFunction, Request, Response } from 'express';
import path from 'path';
class IndexController {
  public index = (req: Request, res: Response, next: NextFunction) => {
    try {
      res.sendFile(path.join(__dirname, '../../index.html'));
    } catch (error) {
      next(error);
    }
  };
}

export default IndexController;
