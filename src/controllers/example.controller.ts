import { NextFunction, Request, Response } from 'express';
import { CONSTANTS } from '@/config';
import { exampleLoginLRUCache } from '@/utils/lrucache';
import path from 'path';
const { RESPONSE_CODE } = CONSTANTS;

class ExampleController {
  public checkLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email_user } = req.cookies;
      const { email, password } = req.body;
      const emailTrimed = email.trim();
      const passwordlTrimed = password.trim();

      if (email_user) {
        res.redirect('/');
      } else {
        if (emailTrimed) {
          const cKey = `${emailTrimed}`;
          const cValue = await exampleLoginLRUCache.get(cKey);
          console.log('[ccc]', cValue);
          // 没有账号就自动注册
          if (!cValue) {
            if (passwordlTrimed.trim()) {
              res.cookie('email_user', emailTrimed, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false });
              res.redirect('/');
            }
          } else {
            // 账号密码匹配
            if (cValue === password.trim()) {
              res.cookie('email_user', emailTrimed, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false });
              res.redirect('/');
            } else {
              res.status(403).json({
                code: RESPONSE_CODE.ERROR,
                data: { message: '账号&密码登录校验失败' },
              });
            }
          }
        } else {
          res.status(403).json({
            code: RESPONSE_CODE.ERROR,
            data: { message: '登录失败' },
          });
        }
      }
    } catch (error) {
      console.log(`checkLogin [error]`, error);
      res.status(403).json({
        code: RESPONSE_CODE.ERROR,
        data: { message: '登录失败！' },
      });
    }
  };

  public registerUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const emailTrimed = email.trim();
      const passwordlTrimed = password.trim();
      if (emailTrimed) {
        const cKey = `${emailTrimed}`;
        exampleLoginLRUCache.set(cKey, passwordlTrimed);
        if (passwordlTrimed.trim()) {
          res.cookie('email_user', emailTrimed, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false });
          res.redirect('/');
        } else {
          res.status(403).json({
            code: RESPONSE_CODE.ERROR,
            data: { message: '注册用户失败！' },
          });
        }
      } else {
        res.status(403).json({
          code: RESPONSE_CODE.ERROR,
          data: { message: '注册用户失败' },
        });
      }
    } catch (error) {
      res.status(403).json({
        code: RESPONSE_CODE.ERROR,
        data: { message: '注册用户失败.' },
      });
    }
  };

  public exampleIndex = (req: Request, res: Response, next: NextFunction) => {
    const { email_user } = req.cookies;
    if (!email_user) {
      res.sendFile(path.join(__dirname, '../../public_static/example.html'));
    } else {
      res.redirect('/');
    }
  };
  public exampleRegister = (req: Request, res: Response, next: NextFunction) => {
    res.sendFile(path.join(__dirname, '../../public_static/register.html'));
  };
}

export default ExampleController;
