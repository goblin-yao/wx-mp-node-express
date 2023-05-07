import { NextFunction, Request, Response } from 'express';
import WxPay from 'wechatpay-node-v3';
import fs from 'fs';

import WeChatPayRecordService from '@/services/wechatpayrecord.service';
import ChatMemberShipService from '@/services/chatmembership.service';
import axios from 'axios';
import { CONSTANTS, GZH_APPID, WX_MERCHANTID } from '@/config';
import path from 'path';
const { RESPONSE_CODE, GZH_DAKA_TEXTS, GZH_DAKA_1_TEXTS } = CONSTANTS;

// 基于 https://github.com/klover2/wechatpay-node-v3-ts 这个开发
class WeChatPayController {
  public _wcPay = new WxPay({
    appid: GZH_APPID, //直连商户申请的公众号或移动应用appid
    mchid: WX_MERCHANTID, //公众号对应的商户号
    publicKey: fs.readFileSync(path.join(__dirname, '../wechatpay_files/apiclient_cert.pem')), // 公钥
    privateKey: fs.readFileSync(path.join(__dirname, '../wechatpay_files/apiclient_key.pem')), // 秘钥
  });

  public _wxPayRerocdService = new WeChatPayRecordService();
  public _memberShipService = new ChatMemberShipService();

  public showPaymentPage = (req: Request, res: Response, next: NextFunction) => {
    const { openid, unionid } = req.cookies;
    if (openid && unionid) {
      res.sendFile(path.join(__dirname, '../static_pages/pay.html'));
    } else {
      res.redirect('/wxopenapi/login');
    }
  };

  // let result = {};
  // let _memberShipResult = null,
  //   _limitResult = null;

  // try {
  //   //添加操作日志-todo
  //   switch (Number(type)) {
  //     case 11:
  //       _memberShipResult = await this._memberShipService.addMemberShip(openid, 24 * 3600 * 1000);
  //       result = { type: 1, result: _memberShipResult };
  //       break;
  //     case 12:
  //       _memberShipResult = await this._memberShipService.addMemberShip(openid, getTimeStampOfMonthLater(1));
  //       result = { type: 1, result: _memberShipResult };
  //       break;
  //     case 13:
  //       _memberShipResult = await this._memberShipService.addMemberShip(openid, getTimeStampOfMonthLater(3));
  //       result = { type: 1, result: _memberShipResult };
  //       break;
  //     case 21:
  //       _limitResult = await this._userLimitService.addUserLimit(openid, 10);
  //       result = { type: 2, result: _limitResult };
  //       break;
  //     case 22:
  //       _limitResult = await this._userLimitService.addUserLimit(openid, 35);
  //       result = { type: 2, result: _limitResult };
  //       break;
  //     case 23:
  //       _limitResult = await this._userLimitService.addUserLimit(openid, 60);
  //       result = { type: 2, result: _limitResult };
  //       break;
  //     case 24:
  //       _limitResult = await this._userLimitService.addUserLimit(openid, 85);
  //       result = { type: 2, result: _limitResult };
  //       break;

  //     default:
  //       break;
  //   }

  //   res.status(RESPONSE_CODE.SUCCESS).send({ code: RESPONSE_CODE.SUCCESS, data: result });
  // } catch (error) {
  //   res.status(RESPONSE_CODE.ERROR).send({ code: RESPONSE_CODE.ERROR });
  // }

  //微信jsapi下单
  public checkout = async (req: Request, res: Response, next: NextFunction) => {
    console.log('[req.cookies]', req.cookies);
    const { openid, unionid } = req.cookies;
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

    const tradeId = `pzck${new Date().getTime()}`;
    const params = {
      description: '测试扫码支付', //商品描述 需要定义todo
      out_trade_no: tradeId, //订单号时间戳
      notify_url: 'https://puzhikeji.com.cn/wechatpay/noti',
      amount: {
        total: 1, //单位是 分
        currency: 'CNY',
      },
      payer: {
        openid: openid, //openid应该是公众号接口传过来的todo
      },
    };
    try {
      await this._wxPayRerocdService.create({ source: 'user', createdBy: openid, params: JSON.stringify(params) });
      // 下单成功时保存数据到订单记录表格中 todo
      let result = await this._wcPay.transactions_jsapi(params);
      // 为了测试
      // result = {
      //   appId: 'appid',
      //   timeStamp: '1609918952',
      //   nonceStr: 'y8aw9vrmx8c',
      //   package: 'prepay_id=wx0615423208772665709493edbb4b330000',
      //   signType: 'RSA',
      //   paySign: 'JnFXsT4VNzlcamtmgOHhziw7JqdnUS9qJ5W6vmAluk3Q2nska7rxYB4hvcl0BTFAB1PBEnHEhCsUbs5zKPEig==',
      // };
      // console.log(result);
      //如果返回有package，说明下单成功，否则其他的情况认为支付失败
      if (result?.package) {
        await this._wxPayRerocdService.create({ source: 'wechatpayment', createdBy: openid, params: JSON.stringify(result) });
        //成功下单,生成参数直接给前端使用
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: result,
        });
      } else {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.ERROR,
          data: result,
        });
      }
      // 下单成功后保存数据到订单记录表格中 todo
    } catch (error) {
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
        data: { error },
      });
    }
  };

  //用来接受支付完成之后的noti，对方会发送一个post请求过来
  public noti = async (req: Request, res: Response, next: NextFunction) => {
    // const result = this._wcPay.decipher_gcm(ciphertext, associated_data, nonce, key);
    //根据回调内容，确定用户会员关系

    await this._wxPayRerocdService.create({ source: 'wechatpayment', createdBy: 'paymentnoti', params: JSON.stringify(req.body) });
  };
}

export default WeChatPayController;
