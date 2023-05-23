import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import { Op } from 'sequelize';
import ChatUserService from '@services/chatuser.service';
import ChatUserLimitService from '@/services/chatuserlimit.service';
import ChatMemberShipService from '@/services/chatmembership.service';
import { WXCustomSendMessage, WXMsgChecker } from '@/services/wxopenapi.service';
import openAIService from '@services/openai.service';
import { CONSTANTS } from '@/config';
import { getTimeStampOfMonthLater } from '@/utils/util';
import path from 'path';
const { RESPONSE_CODE, GZH_DAKA_TEXTS, GZH_DAKA_PAY_TEXTS, GZH_DAKA_ShengyuPro_TEXTS } = CONSTANTS;

class GZHController {
  public aiService = new openAIService();
  public _userLimitService = new ChatUserLimitService();
  public _memberShipService = new ChatMemberShipService();
  // 发送客服消息参考
  // https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/kf-mgnt/kf-message/sendCustomMessage.html
  public messageHandler = async (req: Request, res: Response, next: NextFunction) => {
    // 从 header 中取appid，如果 from-appid 不存在，则不是资源复用场景，可以直接传空字符串，使用环境所属账号发起云调用
    const appid = req.headers['x-wx-from-appid'] || '';
    const unionid = req.headers['x-wx-from-unionid'] as string;
    // body: {
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
    // headers:
    // 'x-wx-source': 'other',
    // 'x-wx-service': 'express-pqiq',
    // 'x-wx-env': 'prod-3gurr7jtde026102',
    // 'x-wx-region': 'ap-shanghai',
    // 'x-wx-from-unionid': 'ob-vI5p5P9MOmSr4tIc1fH5yetCQ',
    // 'x-wx-appid': 'wx8bd01c9a583478cf',
    // 'x-wx-from-appid': 'wx41374d9ae1f0b6d4',
    // 'x-wx-from-openid': 'oOY7b56-yJerlctP0flOf-JewU8U',
    // 'content-type': 'application/json'
    const { ToUserName, FromUserName, MsgType, Content, CreateTime, Event } = req.body;
    console.log('[gzh msg body]', req.body);
    if (MsgType === 'text') {
      const _content = Content.replace(/\s/g, '');
      try {
        // 打卡回复
        if ([...GZH_DAKA_TEXTS, ...GZH_DAKA_ShengyuPro_TEXTS].includes(_content)) {
          // 小程序、公众号可用
          let temp = { result: false, addLimit: 0 };
          let mpName = '声语Pro'; //GeniusAI助手
          if (GZH_DAKA_TEXTS.includes(_content)) {
            mpName = 'GeniusAI助手';
            temp = await this._userLimitService.addUserLimitFromGZH(unionid);
          }
          if (GZH_DAKA_ShengyuPro_TEXTS.includes(_content)) {
            let _temp1 = await axios.post(
              'https://express-bnkr-40873-8-1317602977.sh.run.tcloudbase.com/gzh/dakalimit',
              { unionid },
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
              },
            );
            temp = _temp1.data.data;
            console.log('[ShengyuPro dakalimit]', temp);
          }

          let _reslut = await WXCustomSendMessage(
            {
              touser: FromUserName,
              msgtype: 'text',
              text: {
                content: temp.result ? `${mpName}使用次数增加${temp.addLimit}` : `${mpName}今天已经增加过了`,
              },
            },
            appid,
          );
          console.log('[WXCustomSendMessage]result', _reslut);
        } else if (GZH_DAKA_PAY_TEXTS.filter(e => _content.includes(e)).length) {
          // 会员/充值
          let _reslut = await WXCustomSendMessage(
            {
              touser: FromUserName,
              msgtype: 'text',
              text: {
                content: `点击🔗
https://puzhikeji.com.cn/wechatpay/payment`,
              },
            },
            appid,
          );
          console.log('[WXCustomSendMessage]result', _reslut);
        } else {
          //其他情况，进入小程序与AI畅通对话
          await WXCustomSendMessage(
            {
              touser: FromUserName,
              msgtype: 'text',
              text: {
                content: `点击🔗进入小程序与AI畅通对话
                #小程序://GeniusAI助手/U1vLIctpzEWadmb`,
              },
            },
            appid,
          );
        }
      } catch (error) {
        let _reslut = await WXCustomSendMessage(
          {
            touser: FromUserName,
            msgtype: 'text',
            text: {
              content: `后台服务异常，请联系管理员`,
            },
          },
          appid,
        );
        console.log('error', error);
      }

      //增加使用次数
      res.send('success');
      return;
      // 不做聊天
      // const msgResult = await WXMsgChecker(Content, {
      //   openid: FromUserName,
      //   appid,
      // });
      // let replyMsg = '';
      // if (msgResult.code === -1) {
      //   replyMsg = '内容含有敏感词';
      // } else {
      //   try {
      //     let response = await this.aiService.chatToAI(Content);
      //     replyMsg = response.text;
      //   } catch (error) {
      //     replyMsg = '服务器超时';
      //   }
      // }
    } else if (MsgType === 'event' && Event === 'subscribe') {
      //订阅
      // ToUserName: 'gh_b2964b254956',
      // FromUserName: 'oOY7b56-yJerlctP0flOf-JewU8U',
      // CreateTime: 0,
      // MsgType: 'event',
      // Event: 'subscribe',
      // EventKey: ''
      let _reslut = await WXCustomSendMessage(
        {
          touser: FromUserName,
          msgtype: 'text',
          text: {
            content: `公众号中输入“领次数”可以每日免费领取“GeniusAI“答题次数10次
输入“领声语次数”可以每日免费领取“声语pro“10次对话
在公众号右下角“会员”菜单中，可以购买会员或者充次数
使用tips：
公众号无法直接与AI聊天，请进入小程序与AI对话`,
          },
        },
        appid,
      );
    } else {
      res.status(RESPONSE_CODE.SUCCESS).send('success');
    }
  };

  /**
   * 增加每天打卡次数，主要用来给语音小程序使用，因为数据没有互通-共享账号，增加每天打卡次数
   * 公众号接口调用语音小程序的外部接口增加次数
   */
  public dakalimit = async (req: Request, res: Response, next: NextFunction) => {
    const { unionid } = req.body;
    const result = await this._userLimitService.addUserLimitFromGZH(unionid);
    res.status(RESPONSE_CODE.SUCCESS).send({ data: result });
  };
}

export default GZHController;
