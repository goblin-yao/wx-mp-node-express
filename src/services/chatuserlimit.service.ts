import DB from '@databases';
import { Op } from 'sequelize';
import { ChatUserLimit } from '@/interfaces/chatuserlimit.interface';
import { CONSTANTS } from '@/config';
const { LIMIT_NUM_FROM_GZH } = CONSTANTS;

class ChatUserLimitService {
  public serviceInstance = DB.ChatUserLimit;
  public _userServiceInstance = DB.ChatUser;

  public async addUserLimitFromGZH(unionid: string): Promise<{ result: boolean; addLimit: number }> {
    console.log('addUserLimitFromGZH=>unionid', unionid);
    // unionid = 'ob-vI5p5P9MOmSr4tIc1fH5yetCQ';
    try {
      // 根据unionid找到小程序的openid，然后给小程序增加次数
      const res = await this._userServiceInstance.findOne({ where: { unionid } });
      console.log(`res=>>'cc`, res.toJSON());
      if (res) {
        let userLimit = await this.serviceInstance.findOne({
          where: {
            openid: res.getDataValue('openid'),
            lastAddFromGzh: {
              [Op.lt]: new Date(new Date().toLocaleDateString()),
            },
          },
        });
        //每天只能增加一次
        if (userLimit) {
          await userLimit.update({
            chatLeftNums: userLimit.getDataValue('chatLeftNums') + LIMIT_NUM_FROM_GZH,
            lastAddFromGzh: new Date(),
          });
          await userLimit.save();
          console.log('userLimit add=>', userLimit.toJSON());
          return { result: true, addLimit: LIMIT_NUM_FROM_GZH };
        }
      }
    } catch (error) {
      console.log('addUserLimitFromGZH error=>', error);
    }
    console.log('userLimit unadd!!');
    return { result: false, addLimit: 0 };
  }

  public async addUserLimit(openid: string, nums: number): Promise<ChatUserLimit> {
    let [userLimit] = await this.serviceInstance.findOrCreate({
      where: { openid },
    });
    //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
    await userLimit.update({
      chatLeftNums: userLimit.getDataValue('chatLeftNums') + nums,
    });
    await userLimit.save();

    return userLimit;
  }
}

export default ChatUserLimitService;
