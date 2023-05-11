import DB from '@databases';
import { HttpException } from '@exceptions/HttpException';
import { ChatUser } from '@/interfaces/chatuser.interface';
import { isEmpty } from '@utils/util';
import { USER_LABEL_DEFAULT } from '@/config';

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
  public async findUserFromWebLogin(params: { unionid: string; webOpenid?: string; gzhOpenid?: string }): Promise<ChatUser> {
    if (isEmpty(params.unionid)) {
      throw new HttpException(400, 'unionid is empty');
    }
    const result = await this.serviceInstance.findOne({
      where: params,
    });
    return result;
  }

  public async findUnionidFromWebOrGZHOpenid(params: { webOpenid?: string; gzhOpenid?: string }): Promise<string> {
    const result = await this.serviceInstance.findOne({
      where: params,
    });
    return result ? result.get('unionid') : '';
  }

  public async findUnionidFromMPOpenid(mpOpenid: string): Promise<string> {
    const result = await this.serviceInstance.findOne({
      where: { openid: mpOpenid },
    });
    return result ? result.get('unionid') : '';
  }

  public async findOrUpdateUserByUnionid(params: { unionid: string; webOpenid?: string; gzhOpenid?: string }): Promise<ChatUser> {
    if (isEmpty(params.unionid)) {
      throw new HttpException(400, 'unionid is empty');
    }
    const result = await this.serviceInstance.findOne({
      where: {
        unionid: params.unionid,
      },
    });
    await result.update({ ...params });
    await result.save();
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
      webOpenid: userData.webOpenid || '',
      avatarUrl: userData.avatarUrl || '1',
      nickName: userData.nickName || USER_LABEL_DEFAULT,
    });
    return result;
  }
  public async updateUser(openid: string, userData: Partial<ChatUser>): Promise<ChatUser> {
    if (isEmpty(userData)) {
      throw new HttpException(400, 'userData is empty');
    }
    let user = await this.serviceInstance.findOne({ where: { openid } });
    await user.update({ ...userData });
    await user.save();
    return user;
  }
  public async updateUserByUnionid(unionid: string, userData: Partial<ChatUser>): Promise<ChatUser> {
    if (isEmpty(userData)) {
      throw new HttpException(400, 'userData is empty');
    }
    let user = await this.serviceInstance.findOne({ where: { unionid } });
    await user.update({ ...userData });
    await user.save();
    return user;
  }
}

export default ChatUserService;
