import DB from '@databases';
import { ChatUserLimit } from '@/interfaces/chatuserlimit.interface';
import { CONSTANTS } from '@/config';
const { LIMIT_NUM_FROM_GZH } = CONSTANTS;

class ChatUserLimitService {
  public serviceInstance = DB.ChatUserLimit;
  public async addUserLimitFromGZH(openid: string): Promise<ChatUserLimit> {
    let userLimit = await this.serviceInstance.findOne({
      where: { openid },
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

export default ChatUserLimitService;
