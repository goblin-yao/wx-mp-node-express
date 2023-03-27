import DB from '@databases';
import { HttpException } from '@exceptions/HttpException';
import { ChatMemberShip } from '@/interfaces/chatmembership.interface';
import { isEmpty } from '@utils/util';

class ChatMemberShipService {
  public serviceInstance = DB.ChatMemberShip;
  public async addMemberShip(openid: string, timeStamp: number): Promise<ChatMemberShip> {
    if (isEmpty(openid)) {
      throw new HttpException(400, 'openid is empty');
    }
    let result = await this.serviceInstance.findOne({
      where: {
        openid,
      },
    });
    // 增加时间
    if (result) {
      result.update({ dueDate: new Date(new Date(result.get('dueDate')).getTime() + timeStamp) });
      result.save();
      return result;
    } else {
      //创建一个新的
      result = await this.serviceInstance.create({ openid, dueDate: new Date(new Date().getTime() + timeStamp) });
    }
    return result;
  }
}

export default ChatMemberShipService;
