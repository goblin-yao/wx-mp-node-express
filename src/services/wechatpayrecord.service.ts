import DB from '@databases';
import { HttpException } from '@exceptions/HttpException';
import { WeChatPayRecord } from '@/interfaces/wechatpayrecord.interface';
import { isEmpty } from '@utils/util';
import { CONSTANTS } from '@/config';
import { Optional } from 'sequelize';
const { CONVERSATION } = CONSTANTS;
export type WeChatPayRecordForSave = Optional<WeChatPayRecord, 'id'>;

class WeChatPayRecordService {
  public serviceInstance = DB.WeChatPayRecord;
  // 全部的支付记录查询
  public async list(): Promise<WeChatPayRecord[]> {
    let result = await this.serviceInstance.findAll();
    return result;
  }

  public async create(payRecord: WeChatPayRecordForSave): Promise<WeChatPayRecord> {
    return await this.serviceInstance.create(payRecord);
  }
}

export default WeChatPayRecordService;
