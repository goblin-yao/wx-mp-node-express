import DB from '@databases';
import { ChatUserLimit } from '@/interfaces/chatuserlimit.interface';
import { CONSTANTS } from '@/config';
const { LIMIT_NUM_FROM_GZH } = CONSTANTS;

class ChatUserLimitService {
  public serviceInstance = DB.ChatUserLimit;
  public _userServiceInstance = DB.ChatUser;

  public async addUserLimitFromGZH(unionid: string, gzhOpenid?: string): Promise<{ result: boolean; addLimit: number }> {
    console.log('addUserLimitFromGZH,gzhOpenid', unionid, gzhOpenid);
    unionid = 'ob-vI5p5P9MOmSr4tIc1fH5yetCQ';
    const res = await this._userServiceInstance.findOne({ where: { unionid } });
    console.log(`res=>>${res.openid}|'cc`, res.toJSON());
    if (res) {
      let userLimit = await this.serviceInstance.findOne({
        where: { openid: res.getDataValue('openid') },
      });
      console.log('userLimit=>', userLimit.toJSON());
      //每天只能增加一次
      if (userLimit) {
        if (new Date(userLimit.lastAddFromGzh).getTime() < new Date(new Date().toLocaleDateString()).getTime()) {
          //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
          await userLimit.update({
            chatLeftNums: userLimit.chatLeftNums + LIMIT_NUM_FROM_GZH,
            lastAddFromGzh: new Date(),
          });
          await userLimit.save();
        }
      }
      return { result: true, addLimit: LIMIT_NUM_FROM_GZH };
    }
    return { result: false, addLimit: 0 };
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
