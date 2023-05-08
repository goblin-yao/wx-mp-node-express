import axios from 'axios';
import { CONSTANTS, SUBSCRIBE_TEMPLATE_ID } from '@config';

const { RESPONSE_CODE, LIMIT_NUM_FROM_SHARE_PERDAY } = CONSTANTS;

/**
 * 文本敏感词校验
 * @param content
 * @param option
 * @returns
 */
export async function WXMsgChecker(content, option) {
  try {
    let url = `http://api.weixin.qq.com/wxa/msg_sec_check`;
    if (option.appid) {
      url = `http://api.weixin.qq.com/wxa/msg_sec_check?from_appid=${option.appid}`;
    }
    const result = await axios.post(
      url,
      {
        openid: option.openid,
        version: 2,
        scene: 2,
        content,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    );
    console.log('WXMsgCheckerdata=>', result.data);
    // data: {
    //     errcode: 41001,
    //     errmsg: 'access_token missing rid: 64083e89-5d0117e2-419e0f1d'
    //   }
    if (result?.data?.result?.suggest == 'pass') {
      return {
        code: RESPONSE_CODE.SUCCESS,
      };
    } else {
      return {
        code: RESPONSE_CODE.ERROR,
      };
    }
  } catch (error) {
    console.log('error=>', error);
    return {
      code: RESPONSE_CODE.ERROR,
    };
  }
}
/**
 * 推送订阅消息
 * @param option
 * @returns
 */
export async function WXSubscribeSend(option) {
  if (!SUBSCRIBE_TEMPLATE_ID) {
    return false;
  }
  let url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send`;
  try {
    const result = await axios.post(
      url,
      {
        touser: option.toOpenId,
        template_id: SUBSCRIBE_TEMPLATE_ID,
        page: '/pages/index/index',
        miniprogram_state: 'trial', //跳转小程序类型：developer为开发版；trial为体验版；formal为正式版；默认为正式版
        lang: 'zh_CN',
        data: {
          //积分类型
          thing1: {
            value: '你通过分享增加了次数',
          },
          //积分数量
          number2: {
            value: LIMIT_NUM_FROM_SHARE_PERDAY.MAX_NUM_PERSHARE,
          },
          // 温馨提醒
          thing3: {
            value: '点击进入小程序使用',
          },
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      },
    );
    console.log('message/subscribe/send result=>', result.data);
    return result.data;
  } catch (error) {
    console.log('message/subscribe/send error', error);
    return -1;
  }
}

/**
 * 公众号回复消息
 * @param appid
 * @param message
 * @returns
 */
export async function WXCustomSendMessage(message, appid) {
  let url = `http://api.weixin.qq.com/cgi-bin/message/custom/send`;
  if (appid) {
    url = `http://api.weixin.qq.com/cgi-bin/message/custom/send?from_appid=${appid}`;
  }
  try {
    const result = await axios.post(url, message, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log('message/custom/send result=>', result.data);
    return result.data;
  } catch (error) {
    console.log('message/custom/send error', error);
    return -1;
  }
}
