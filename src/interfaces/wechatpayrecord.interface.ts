export interface WeChatPayRecord {
  id: number;
  outTradeNo?: string; // 商户的交易id
  transactionId?: string; // 微信支付的交易id
  /**
   * 操作来源
   */
  source: string;
  /**
   * 操作的参数
   */
  params: string;
  createdBy?: string;
  createdByUnionid?: string;
}
