import { NextFunction, Request, Response } from 'express';
import WxPay from 'wechatpay-node-v3';
import fs from 'fs';

import WeChatPayRecordService from '@/services/wechatpayrecord.service';
import ChatMemberShipService from '@/services/chatmembership.service';
import ChatUserLimitService from '@/services/chatuserlimit.service';
import ChatUserService from '@services/chatuser.service';
import { APIV3KEY, CONSTANTS, GZH_APPID, WX_BUYER, WX_MERCHANTID } from '@/config';
import path from 'path';
const { RESPONSE_CODE } = CONSTANTS;
type NotiGCMResult = {
  mchid: string;
  appid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_type: string;
  trade_state: string;
  trade_state_desc: string;
  bank_type: string;
  attach: string;
  success_time: string;
  payer: { openid: string };
  amount: { total: number; payer_total: number; currency: string; payer_currency: string };
};

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
  public _userService = new ChatUserService();
  public _userLimitService = new ChatUserLimitService();

  public showPaymentPage = (req: Request, res: Response, next: NextFunction) => {
    const { openid, unionid } = req.cookies;
    if (openid && unionid) {
      res.sendFile(path.join(__dirname, '../static_pages/pay.html'));
    } else {
      res.redirect('/wxopenapi/login');
    }
  };

  //微信jsapi下单
  public checkout = async (req: Request, res: Response, next: NextFunction) => {
    const { openid, unionid } = req.cookies;
    const { type } = req.body;

    const tradeId = `pzck-${type}-${new Date().getTime()}`;
    const params = {
      description: '测试扫码支付', //商品描述 需要定义todo
      out_trade_no: tradeId, //订单号时间戳-和支付类型
      notify_url: 'https://puzhikeji.com.cn/wechatpay/noti',
      amount: {
        total: WX_BUYER[type]['totalMoney'], //单位是 分
        currency: 'CNY',
      },
      payer: {
        openid: openid,
      },
    };
    try {
      // await this._wxPayRerocdService.create({ source: 'user', createdBy: openid, createdByUnionid: unionid, params: JSON.stringify(params) });
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
        await this._wxPayRerocdService.create({
          source: 'wechatpayment-checkout',
          createdBy: openid,
          outTradeNo: params.out_trade_no,
          createdByUnionid: unionid,
          params: JSON.stringify({ result, params }),
        });
        //成功下单,生成参数直接给前端使用
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: result,
        });
      } else {
        await this._wxPayRerocdService.create({
          source: 'wechatpayment-checkout-error0',
          createdBy: openid,
          createdByUnionid: unionid,
          outTradeNo: params.out_trade_no,
          params: JSON.stringify({ result, params }),
        });

        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.ERROR,
          data: result,
        });
      }
      // 下单成功后保存数据到订单记录表格中 todo
    } catch (error) {
      await this._wxPayRerocdService.create({
        source: 'wechatpayment-checkout-error1',
        createdBy: openid,
        createdByUnionid: unionid,
        outTradeNo: params.out_trade_no,
        params: JSON.stringify({ params, error: error.toString() }),
      });

      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
        data: { error },
      });
    }
  };

  //用来接受支付完成之后的noti，对方会发送一个post请求过来
  public noti = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resource } = req.body;
      // noti 数据例子
      //  {
      //     id: '16c4adb3-caa6-54c3-8c74-f1c501b28d02',
      //     create_time: '2023-05-07T16:49:38+08:00',
      //     resource_type: 'encrypt-resource',
      //     event_type: 'TRANSACTION.SUCCESS',
      //     summary: '支付成功',
      //     resource: {
      //   original_type: 'transaction',
      //   algorithm: 'AEAD_AES_256_GCM',
      //   ciphertext:
      //     'CRwwr90weOtMrFZhekGk4XfmILZgIz1pmSRLAk88ANWHCxUNSa07EyD+HmvmyFNcfCIAPzW58WfH3NVG9DmCPp4iOQO0/NiN/k59Q5P3aWnoobZAIcXSMXkynyYmiqbSkmGvMjrgxOopJCg24w8L6wDguPSLjkyqH6xEckzsdbfAby+WJ9K7qY8w0p3qgyikMpvf0XAQEZMIbP11x6NRwGePhe0+WtNc/0TQxcqlC9QUEmmnjoQCBFsVnFVXyid6jFauwHuxKdfsNdwfDSXtavz5DkGZYF1WoOhlWBPm+ch/U2DCrKkAE1uVXAm8gVi/PjVxPM3/uO/I8avChjzQ+dOwXv0ERAucs28gDqz0MhcQp8BEfcOooGgGYX3/P9VCtRIy/lWBujP9lBmWIU9Uv56nOWmrthM0yZdCA1o3lRE+n0sb4OV8D5/GciRMqdZYGK69aXLDejFpYI6TSohLbs6cJ2k3XBtY2DKuncsqGAPsnr8lstmtpp/SD36WQPui6KE+RI+Stu0e47d+QmGceGebcWyoNtHQROdeLxz4HbV6HN434LOATtVwCPlgZpcOwJtvSA==',
      //   associated_data: 'transaction',
      //   nonce: 'kKD2qXaaqFsE',
      // }
      //   };
      const result: NotiGCMResult = this._wcPay.decipher_gcm(resource.ciphertext, resource.associated_data, resource.nonce, APIV3KEY);
      // 解密后的数据类型
      // {
      //   mchid: '1641448691',
      //   appid: 'wx41374d9ae1f0b6d4',
      //   out_trade_no: 'pzck1683449373252',
      //   transaction_id: '4200001810202305075423630653',
      //   trade_type: 'JSAPI',
      //   trade_state: 'SUCCESS',
      //   trade_state_desc: '支付成功',
      //   bank_type: 'OTHERS',
      //   attach: '',
      //   success_time: '2023-05-07T16:49:38+08:00',
      //   payer: { openid: 'oOY7b56-yJerlctP0flOf-JewU8U' },
      //   amount: { total: 1, payer_total: 1, currency: 'CNY', payer_currency: 'CNY' }
      // }
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: result,
      });

      //根据回调内容，确定用户会员关系`pzck-${type}-${new Date().getTime()}`;
      const outTradeNo = result.out_trade_no;
      const payType = outTradeNo.split('-')[1];

      //保存记录
      await this._wxPayRerocdService.create({
        source: 'paymentnoti',
        createdBy: result?.payer?.openid || '',
        outTradeNo: outTradeNo,
        transactionId: result.transaction_id,
        params: JSON.stringify(result),
      });

      if (WX_BUYER[payType]) {
        const unionid = await this._userService.findUnionidFromWebOrGZHOpenid({ gzhOpenid: result?.payer?.openid });

        if (WX_BUYER[payType]['type'] === 'MemberShip') {
          // 先获取unionid，然后更加会员时间
          await this._memberShipService.addMemberShip(unionid, WX_BUYER[payType]['ranger']());
        }
        if (WX_BUYER[payType]['type'] === 'BuyTimes') {
          await this._userLimitService.addUserLimitFromUinionid(unionid, WX_BUYER[payType]['ranger']());
        }
      }
    } catch (error) {
      console.log('[noti]', error);
    }
  };
  //用来接受支付完成之后的noti，对方会发送一个post请求过来
  public notiTest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const { resource } = req.body;
      // noti 数据例子
      const testdata = {
        id: '16c4adb3-caa6-54c3-8c74-f1c501b28d02',
        create_time: '2023-05-07T16:49:38+08:00',
        resource_type: 'encrypt-resource',
        event_type: 'TRANSACTION.SUCCESS',
        summary: '支付成功',
        resource: {
          original_type: 'transaction',
          algorithm: 'AEAD_AES_256_GCM',
          ciphertext:
            'CRwwr90weOtMrFZhekGk4XfmILZgIz1pmSRLAk88ANWHCxUNSa07EyD+HmvmyFNcfCIAPzW58WfH3NVG9DmCPp4iOQO0/NiN/k59Q5P3aWnoobZAIcXSMXkynyYmiqbSkmGvMjrgxOopJCg24w8L6wDguPSLjkyqH6xEckzsdbfAby+WJ9K7qY8w0p3qgyikMpvf0XAQEZMIbP11x6NRwGePhe0+WtNc/0TQxcqlC9QUEmmnjoQCBFsVnFVXyid6jFauwHuxKdfsNdwfDSXtavz5DkGZYF1WoOhlWBPm+ch/U2DCrKkAE1uVXAm8gVi/PjVxPM3/uO/I8avChjzQ+dOwXv0ERAucs28gDqz0MhcQp8BEfcOooGgGYX3/P9VCtRIy/lWBujP9lBmWIU9Uv56nOWmrthM0yZdCA1o3lRE+n0sb4OV8D5/GciRMqdZYGK69aXLDejFpYI6TSohLbs6cJ2k3XBtY2DKuncsqGAPsnr8lstmtpp/SD36WQPui6KE+RI+Stu0e47d+QmGceGebcWyoNtHQROdeLxz4HbV6HN434LOATtVwCPlgZpcOwJtvSA==',
          associated_data: 'transaction',
          nonce: 'kKD2qXaaqFsE',
        },
      };
      const { resource } = testdata;
      const result: NotiGCMResult = this._wcPay.decipher_gcm(resource.ciphertext, resource.associated_data, resource.nonce, APIV3KEY);
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: result,
      });

      //根据回调内容，确定用户会员关系`pzck-${type}-${new Date().getTime()}`;
      const outTradeNo = result.out_trade_no;
      const payType = '11'; //outTradeNo.split('-')[1];

      //保存记录
      await this._wxPayRerocdService.create({
        source: 'paymentnoti',
        createdBy: result?.payer?.openid || '',
        outTradeNo: outTradeNo,
        transactionId: result.transaction_id,
        params: JSON.stringify(result),
      });

      if (WX_BUYER[payType]) {
        const unionid = await this._userService.findUnionidFromWebOrGZHOpenid({ gzhOpenid: result?.payer?.openid });

        if (WX_BUYER[payType]['type'] === 'MemberShip') {
          // 先获取unionid，然后更加会员时间
          await this._memberShipService.addMemberShip(unionid, WX_BUYER[payType]['ranger']());
        }
        if (WX_BUYER[payType]['type'] === 'BuyTimes') {
          await this._userLimitService.addUserLimitFromUinionid(unionid, WX_BUYER[payType]['ranger']());
        }
      }
    } catch (error) {
      console.log('[noti]', error);
    }
  };
}

export default WeChatPayController;
