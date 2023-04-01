import { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import ChatUserService from '@services/chatuser.service';
import ChatUserLimitService from '@/services/chatuserlimit.service';
import ChatMemberShipService from '@/services/chatmembership.service';
import { WXCustomSendMessage, WXMsgChecker } from '@/services/wxopenapi.service';
import openAIService from '@services/openai.service';
import { CONSTANTS } from '@/config';
import { getTimeStampOfMonthLater } from '@/utils/util';
const { RESPONSE_CODE, LIMIT_NUM_FROM_SHARE_PERDAY, MAX_HISTORY_RECORD, MAX_HISTORY_SAVE, MAX_LIMIT_PERDAY, TIME_FOR_NEW_USER } = CONSTANTS;

class GZHController {
  public aiService = new openAIService();
  public _userLimitService = new ChatUserLimitService();
  public _memberShipService = new ChatMemberShipService();
  public messageHandler = async (req: Request, res: Response, next: NextFunction) => {
    // 从 header 中取appid，如果 from-appid 不存在，则不是资源复用场景，可以直接传空字符串，使用环境所属账号发起云调用
    const appid = req.headers['x-wx-from-appid'] || '';
    // unionid=>
    // 推送接收的账号 {
    // appid: '',
    // body: {
    // ToUserName: 'gh_31cb7255c884',
    // FromUserName: 'oWl8_5slEAh0Ow7hR_-4pedtFB_Q',
    // CreateTime: 1678528047,
    // MsgType: 'text',
    // Content: '1+1',
    // MsgId: 24030743352527428
    // }
    // }
    const { ToUserName, FromUserName, MsgType, Content, CreateTime } = req.body;
    console.log('推送接收的账号', {
      body: req.body,
      headers: req.headers,
    });
    if (MsgType === 'text') {
      if (Content.replace(/\s/g, '') === '增加使用次数') {
        this._userLimitService.addUserLimitFromGZH(FromUserName);
      }
      //增加使用次数
      res.send('success');
      return;
      // 不做聊天
      const msgResult = await WXMsgChecker(Content, {
        openid: FromUserName,
        appid,
      });
      let replyMsg = '';
      if (msgResult.code === -1) {
        replyMsg = '内容含有敏感词';
      } else {
        try {
          let response = await this.aiService.chatToAI(Content);
          replyMsg = response.text;
        } catch (error) {
          replyMsg = '服务器超时';
        }
      }
      // 小程序、公众号可用
      try {
        let _reslut = await WXCustomSendMessage(
          {
            touser: FromUserName,
            msgtype: 'text',
            text: {
              content: replyMsg,
            },
          },
          appid,
        );
        console.log('_reslut', _reslut);
      } catch (error) {}
      res.status(RESPONSE_CODE.SUCCESS).send('success');
    } else {
      res.status(RESPONSE_CODE.SUCCESS).send('success');
    }
  };

  public buy = async (req: Request, res: Response, next: NextFunction) => {
    const appid = req.headers['x-wx-from-appid'] || '';
    const openid = req.headers['x-wx-openid'] as string;
    const unionid = req.headers['x-wx-unionid'] as string;
    const { type } = req.body;
    // <select id="typeSelect">
    //   <option value="11">会员1天</option>
    //   <option value="12">会员1个月</option>
    //   <option value="13">会员3个月</option>
    //   <option value="21">10次</option>
    //   <option value="22">35次</option>
    //   <option value="23">60次</option>
    //   <option value="24">85次</option>
    // </select>
    let result = {};
    let _memberShipResult = null,
      _limitResult = null;

    try {
      //添加操作日志-todo
      switch (Number(type)) {
        case 11:
          _memberShipResult = await this._memberShipService.addMemberShip(openid, 24 * 3600 * 1000);
          result = { type: 1, result: _memberShipResult };
          break;
        case 12:
          _memberShipResult = await this._memberShipService.addMemberShip(openid, getTimeStampOfMonthLater(1));
          result = { type: 1, result: _memberShipResult };
          break;
        case 13:
          _memberShipResult = await this._memberShipService.addMemberShip(openid, getTimeStampOfMonthLater(3));
          result = { type: 1, result: _memberShipResult };
          break;
        case 21:
          _limitResult = await this._userLimitService.addUserLimit(openid, 10);
          result = { type: 2, result: _limitResult };
          break;
        case 22:
          _limitResult = await this._userLimitService.addUserLimit(openid, 35);
          result = { type: 2, result: _limitResult };
          break;
        case 23:
          _limitResult = await this._userLimitService.addUserLimit(openid, 60);
          result = { type: 2, result: _limitResult };
          break;
        case 24:
          _limitResult = await this._userLimitService.addUserLimit(openid, 85);
          result = { type: 2, result: _limitResult };
          break;

        default:
          break;
      }

      res.status(RESPONSE_CODE.SUCCESS).send({ code: RESPONSE_CODE.SUCCESS, data: result });
    } catch (error) {
      res.status(RESPONSE_CODE.ERROR).send({ code: RESPONSE_CODE.ERROR });
    }
  };
}

export default GZHController;
