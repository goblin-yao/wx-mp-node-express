import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
// import { webLoginLRUCache } from '@/utils/lrucache';
import { CONSTANTS, WEB_WX_APPID, WEB_WX_SECRET_KEY, GZH_APPID, GZH_SECRET_KEY, SuperAdminUser } from '@/config';
import path from 'path';
import ChatUserService from '@/services/chatuser.service';
const { RESPONSE_CODE } = CONSTANTS;

class WxOpenAPIController {
  public _userService = new ChatUserService();

  private saveUserInfo = async (unionid: string, openid: string, from_where: string) => {
    const params = from_where === 'out_web' ? { unionid, webOpenid: openid } : { unionid, gzhOpenid: openid };
    const userFindResult = await this._userService.findUserFromWebLogin(params);
    if (userFindResult) {
      return false;
    } else {
      const result = await this._userService.findOrUpdateUserByUnionid(params);
      return !!result;
    }
  };

  // how to use cookies
  // https://www.jianshu.com/p/2ca91bc5830a
  /**
   * 登录，cookies中包含:
   * access_token
   * refresh_token
   * openid
   * unionid
   */
  public login = async (req: Request, res: Response, next: NextFunction) => {
    //缓存中没有，说明需要重新登录了，就去登录页面，然后在登录页面进行下一步操作：
    //1. 微信内跳转到callback根据code获取用户信息
    //2. 微信外扫码登陆，在这之前要先根据token刷新一下
    const { openid, unionid, email_user } = req.cookies;
    const userAgent = req.headers['user-agent'] as string;
    if (openid && unionid) {
      // 保存用户信息到用户信息表中-判断是否是微信环境
      await this.saveUserInfo(unionid, openid, /MicroMessenger/i.test(userAgent) ? 'inner_web' : 'out_web');
      // const cKey = `${openid}:${unionid}`;
      // const cValue = webLoginLRUCache.get(cKey);
      // if (cValue) {
      //   //如果缓存中有，说明用户是合法的，直接重定向到聊天首页，流程结束
      //   res.redirect('/index.html');
      //   return;
      // } else {
      //   console.log(`${cKey} not found`);
      // }

      // 删除缓存的处理，后面有redis之类的再配置
      res.redirect('/index.html');
      return;
    } else if (email_user === SuperAdminUser) {
      res.redirect('/index.html');
      return;
    }

    res.sendFile(path.join(__dirname, '../static_pages/login.html'));

    //  else {
    //   //刷新token
    //   try {
    //     const authAccessToken = await axios.get(
    //       `https://api.weixin.qq.com/sns/auth?access_token=${access_token}&openid=${openid}&appid=${WEB_WX_APPID}&secret=${WEB_WX_SECRET_KEY}`,
    //       {
    //         timeout: 5000,
    //       },
    //     );
    //     if (authAccessToken.data.errcode === 0) {
    //       //如果成功，直接跳转首页
    //       res.redirect('/index.html');
    //     }
    //     console.log('[/sns/auth]', authAccessToken.data);
    //   } catch (error) {
    //     //出错了就重新取一次token
    //   }
    // }

    // res.sendFile(path.join(__dirname, '../static_pages/login.html'));
    // return;

    // // 向微信服务器发送请求，获取access_token和openid
    // axios
    //   .get(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${code}&grant_type=authorization_code`)
    //   .then(response => {
    //     const { access_token, openid } = response.data;
    //     // 向微信服务器发送请求，获取用户信息
    //     return axios.get(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`);
    //   })
    //   .then(response => {
    //     // 将用户信息返回给前端
    //     res.status(RESPONSE_CODE.SUCCESS).json(response.data);
    //   })
    //   .catch(error => {
    //     console.error(error);
    //     res.status(500).send('Internal server error');
    //   });
    // //校验cookie中的access_token是否有效，如果无效就续期，因此访问login页面的时候已经续期了
    // res.sendFile(path.join(__dirname, '../static_pages/login.html'));
    // res.status(RESPONSE_CODE.SUCCESS).send({ data: 'result' });
  };

  //登陆完成后的回调页面
  callback = async (req: Request, res: Response, next: NextFunction) => {
    const { code, from_where } = req.query;
    //todo 需要配置WEB_WX_APPID和WEB_WX_SECRET_KEY
    // 向微信服务器发送请求，获取access_token和openid
    let urlGet = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${GZH_APPID}&secret=${GZH_SECRET_KEY}&code=${code}&grant_type=authorization_code`;
    if (from_where === 'out_web') {
      urlGet = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WEB_WX_APPID}&secret=${WEB_WX_SECRET_KEY}&code=${code}&grant_type=authorization_code`;
    }
    axios
      .get(urlGet)
      .then(async response => {
        console.log('[sns/oauth2]', response.data);
        if (!response?.data?.refresh_token) {
          //如果没有返回refres_token就认为错了
          res.status(RESPONSE_CODE.SUCCESS).json({
            code: RESPONSE_CODE.ERROR,
            data: { data: response.data, url: urlGet },
          });
          // res.redirect('/wxopenapi/login');
        } else {
          console.log('[callback]', response.data);
          // {
          //   "access_token":"ACCESS_TOKEN",
          //   "expires_in":7200,
          //   "refresh_token":"REFRESH_TOKEN",
          //   "openid":"OPENID",
          //   "scope":"SCOPE",
          //   "unionid": "UNIONID"
          //   }
          const { access_token, openid, refresh_token, unionid, expires_in } = response.data;
          //设置cookie, todo 加密？？
          res.cookie('access_token', access_token, { maxAge: expires_in, httpOnly: false });
          res.cookie('refresh_token', refresh_token, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false }); //有效期1个月
          res.cookie('openid', openid, { maxAge: 90 * 24 * 3600 * 1000, httpOnly: false }); //有效期3个月
          res.cookie('unionid', unionid, { maxAge: 90 * 24 * 3600 * 1000, httpOnly: false }); //有效期3个月

          // 保存用户信息到用户信息表中
          await this.saveUserInfo(unionid, openid, from_where as string);

          // const cKey = `${openid}:${unionid}`;
          // webLoginLRUCache.set(cKey, refresh_token); //设置refresh token缓存

          res.redirect('/index.html');
        }
        // 向微信服务器发送请求，获取用户信息
        // return axios.get(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`);
      })
      // .then(response => {
      //   // 将用户信息返回给前端
      //   res.status(RESPONSE_CODE.SUCCESS).json(response.data);
      // })
      .catch(error => {
        console.error(error);
        res.redirect('/wxopenapi/login');
      });
  };

  getLoginUserInfo = async (req: Request, res: Response, next: NextFunction) => {
    const { code } = req.query;

    // 向微信服务器发送请求，获取access_token和openid
    axios
      .get(
        `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WEB_WX_APPID}&secret=${WEB_WX_SECRET_KEY}&code=${code}&grant_type=authorization_code`,
      )
      .then(response => {
        const { access_token, openid } = response.data;
        // 向微信服务器发送请求，获取用户信息
        return axios.get(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`);
      })
      .then(response => {
        // 将用户信息返回给前端
        res.status(RESPONSE_CODE.SUCCESS).json(response.data);
      })
      .catch(error => {
        console.error(error);
        res.status(500).send('Internal server error');
      });
  };

  //注销，清除全部cookie跳转到登录页面
  logout = async (req: Request, res: Response, next: NextFunction) => {
    const cookies = Object.keys(req.cookies);
    // 遍历 cookies 并清除每个 cookie
    cookies.forEach(cookieName => {
      res.clearCookie(cookieName);
    });

    res.redirect('/wxopenapi/login');
  };
}

export default WxOpenAPIController;
