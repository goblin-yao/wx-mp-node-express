import DB from '@databases';
import { ChatUserLimit } from '@/interfaces/chatuserlimit.interface';
import { CONSTANTS } from '@/config';
const { LIMIT_NUM_FROM_GZH } = CONSTANTS;

class ChatUserLimitService {
  public serviceInstance = DB.ChatUserLimit;
  public _userServiceInstance = DB.ChatUser;

  public async addUserLimitFromGZH(unionid: string, gzhOpenid: string): Promise<ChatUserLimit> {
    const res = await this._userServiceInstance.findOne({ where: { unionid } });
    if (res) {
      let userLimit = await this.serviceInstance.findOne({
        where: { openid: res.openid },
      });
      //每天只能增加一次
      if (userLimit) {
        if (new Date(userLimit.lastAddFromGzh).getTime() < new Date(new Date().toLocaleDateString()).getTime()) {
          //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
          await userLimit.update({
            chatLeftNums: userLimit.chatLeftNums + LIMIT_NUM_FROM_GZH,
          });
          await userLimit.save();
        }
      }
      return userLimit;
    }
  }

  public async addUserLimit(openid: string, nums: number): Promise<ChatUserLimit> {
    let [userLimit] = await this.serviceInstance.findOrCreate({
      where: { openid },
    });
    //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
    await userLimit.update({
      chatLeftNums: userLimit.chatLeftNums + nums,
    });
    await userLimit.save();

    return userLimit;
  }
}

export default ChatUserLimitService;
