import DB from '@databases';
import { HttpException } from '@exceptions/HttpException';
import { ChatMemberShip } from '@/interfaces/chatmembership.interface';
import { isEmpty } from '@utils/util';
import { Op } from 'sequelize';

class ChatMemberShipService {
  public serviceInstance = DB.ChatMemberShip;
  public async addMemberShip(unionid: string, timeStamp: number): Promise<ChatMemberShip> {
    if (isEmpty(unionid)) {
      throw new HttpException(400, 'unionid is empty');
    }
    let result = await this.serviceInstance.findOne({
      where: {
        unionid,
      },
    });
    // 增加时间
    if (result) {
      result.update({ dueDate: new Date(new Date(result.get('dueDate')).getTime() + timeStamp) });
      result.save();
      return result;
    } else {
      //创建一个新的
      result = await this.serviceInstance.create({ unionid, dueDate: new Date(new Date().getTime() + timeStamp) });
    }
    return result;
  }

  public async checkIfMemberShipVaild(unionid: string): Promise<boolean> {
    if (isEmpty(unionid)) {
      throw new HttpException(400, 'unionid is empty');
    }
    let result = await this.serviceInstance.findOne({
      where: {
        unionid,
        dueDate: {
          [Op.gt]: new Date(), //比当前时间大的
        },
      },
    });
    return !!result; //如果时间小于当前时间就是是会员
  }
}

export default ChatMemberShipService;
