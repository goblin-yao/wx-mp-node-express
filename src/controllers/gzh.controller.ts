import { NextFunction, Request, Response } from 'express';
import { WXCustomSendMessage, WXMsgChecker } from '@/services/wxopenapi.service';
import ChatUserLimitService from '@/services/chatuserlimit.service';
import openAIService from '@services/openai.service';
import { CONSTANTS } from '@/config';
const { RESPONSE_CODE, LIMIT_NUM_FROM_SHARE_PERDAY, MAX_HISTORY_RECORD, MAX_HISTORY_SAVE, MAX_LIMIT_PERDAY, TIME_FOR_NEW_USER } = CONSTANTS;

class GZHController {
  public aiService = new openAIService();
  public _userLimitService = new ChatUserLimitService();
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
      return res.send('success');
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
      res.send('success');
    } else {
      res.send('success');
    }
  };
}

export default GZHController;
