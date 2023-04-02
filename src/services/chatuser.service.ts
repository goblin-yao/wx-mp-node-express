import DB from '@databases';
import { HttpException } from '@exceptions/HttpException';
import { ChatUser } from '@/interfaces/chatuser.interface';
import { isEmpty } from '@utils/util';

class ChatUserService {
  public serviceInstance = DB.ChatUser;
  public async findUser(openid: string): Promise<ChatUser> {
    if (isEmpty(openid)) {
      throw new HttpException(400, 'openid is empty');
    }
    const result = await this.serviceInstance.findOne({
      where: {
        openid,
      },
    });
    return result;
  }
  public async createUser(userData: Partial<ChatUser>): Promise<ChatUser> {
    if (isEmpty(userData)) {
      throw new HttpException(400, 'userData is empty');
    }
    const result = await this.serviceInstance.create({
      openid: userData.openid,
      unionid: userData.unionid || '',
      gzhOpenid: userData.gzhOpenid || '',
      avatarUrl: userData.avatarUrl || '1',
      nickName: userData.nickName || '2',
    });
    return result;
  }
}

export default ChatUserService;
