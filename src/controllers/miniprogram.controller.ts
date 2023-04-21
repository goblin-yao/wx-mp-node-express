import { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import ChatUserService from '@services/chatuser.service';
import ChatUserLimitService from '@/services/chatuserlimit.service';
import ChatUserShareHistoriesService from '@/services/chatusershare.service';
import ChatMessageService from '@/services/chatmessage.service';
import ChatUserAdvertiseHistoriesService from '@/services/chatuseradvertisehistory.service';
import { WXSubscribeSend, WXCustomSendMessage, WXMsgChecker } from '@/services/wxopenapi.service';
import { CONSTANTS } from '@/config';
import { ChatUserLimitModel } from '@/models/chatuserlimit.model';
const {
  RESPONSE_CODE,
  LIMIT_NUM_FROM_SHARE_PERDAY,
  MAX_HISTORY_RECORD,
  MAX_HISTORY_SAVE,
  MAX_LIMIT_PERDAY,
  TIME_FOR_NEW_USER,
  LIMIT_NUM_FROM_ADVERTISE_PERDAY,
  LIMIT_FREE_PERDAY,
} = CONSTANTS;

class MiniProgramController {
  public _userService = new ChatUserService();
  public _userLimitService = new ChatUserLimitService();
  public _userShareHistoriesService = new ChatUserShareHistoriesService();
  public _messageService = new ChatMessageService();
  public _userAdvertiseHistoriesService = new ChatUserAdvertiseHistoriesService();

  private getAimedLimit = function (_limit: number): number {
    const aimedLimit = _limit + LIMIT_FREE_PERDAY;
    //如果当前剩余超过，返回当前剩余
    if (_limit >= MAX_LIMIT_PERDAY) {
      return _limit;
    }
    return Math.min(aimedLimit, MAX_LIMIT_PERDAY);
  };

  private addLimitNumFromShare = async (openid: string, share_from_openid: string) => {
    // 判断今天总记录数是否大于指定次数
    const recordToday = await this._userShareHistoriesService.serviceInstance.count({
      where: {
        openid: share_from_openid,
        updatedAt: {
          [Op.gt]: new Date(new Date().toLocaleDateString()),
        },
      },
    });
    console.log('recordToday=>', recordToday);
    if (recordToday < LIMIT_NUM_FROM_SHARE_PERDAY.MAX_USER_NUM) {
      // 查询两个openid的分享交互，如果有创建时间大于今天0点的内容。就不增加次数
      const [record, isCreated] = await this._userShareHistoriesService.serviceInstance.findOrCreate({
        where: {
          openid: share_from_openid,
          byOpenid: openid,
        },
      });
      console.log('[record, isCreated]', record.toJSON(), isCreated);
      //是新创建的 或者 不是新创建的 判断更新时间小于今天，增加10次
      if (isCreated || (!isCreated && new Date(record.get('updatedAt')).getTime() < new Date(new Date().toLocaleDateString()).getTime())) {
        if (!isCreated) {
          await record.update({ shareFlag: String(new Date().getTime()) });
          await record.save();
        }

        // 增加10次次数
        let userLimit = await this._userLimitService.serviceInstance.findOne({
          where: { openid: share_from_openid },
        });
        if (userLimit) {
          //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
          await userLimit.update({
            chatLeftNums: userLimit.get('chatLeftNums') + LIMIT_NUM_FROM_SHARE_PERDAY.MAX_NUM_PERSHARE,
          });
          await userLimit.save();
        }
        // await WXSubscribeSend({ toOpenId: share_from_openid });
      }
    }
  };
  public userRegister = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    const unionid = req.headers['x-wx-unionid'] as string;
    const { avatarUrl, nickName } = req.body;
    try {
      let hasUser = await this._userService.findUser(openid);
      if (hasUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.ERROR,
          data: hasUser,
        });
        console.log('user already exist', openid);
      } else {
        const result = await this._userService.createUser({
          openid,
          unionid,
          avatarUrl: avatarUrl,
          nickName: nickName,
        });
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: result,
        });
      }
    } catch (error) {
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
      });
    }
  };
  public updateUser = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    const unionid = req.headers['x-wx-unionid'] as string;
    const { avatarUrl, nickName } = req.body;
    try {
      let result = await this._userService.updateUser(openid, { avatarUrl, nickName });

      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: result,
      });
    } catch (error) {
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
      });
    }
  };

  public userAuth = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    const unionid = req.headers['x-wx-unionid'] as string;
    const { share_from_openid } = req.body;
    try {
      let hasUser = await this._userService.findUser(openid);
      if (hasUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: hasUser,
        });
      } else {
        const result = await this._userService.createUser({
          openid,
          unionid,
        });
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: result,
        });
      }
    } catch (error) {
      console.log('errro', error);
      // 未登录时需要传openid给小程序，这样方便后面的操作身份
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
        data: { openid },
      });
    } finally {
      //添加分享次数
      if (openid && share_from_openid && openid !== share_from_openid) {
        try {
          await this.addLimitNumFromShare(openid, share_from_openid as string);
        } catch (error) {
          console.log('addLimitNumFromShare error', error);
        }
      }
    }
  };

  public addChatMessage = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    const { msgType, data } = req.body;
    try {
      const content = data.text;
      const conversationId = data.conversationId;
      const parentMessageId = data.parentMessageId;
      const messageId = data.id;

      switch (msgType) {
        // 1表示用户的文字信息
        case 1: {
          const result = await this._messageService.addMessage({
            openid,
            msgType,
            content,
            conversationId,
            parentMessageId,
            messageId,
          });
          res.status(RESPONSE_CODE.SUCCESS).json({
            code: RESPONSE_CODE.SUCCESS,
            data: result,
          });
          break;
        }
        // 2表示chatgpt文字的答案
        case 2: {
          const result = await this._messageService.addMessage({
            openid,
            msgType,
            content,
            conversationId,
            parentMessageId,
            messageId,
            attachment: JSON.stringify(data.detail),
          });
          res.status(RESPONSE_CODE.SUCCESS).json({
            code: RESPONSE_CODE.SUCCESS,
          });
          break;
        }
        default:
      }
    } catch (error) {
      console.log('eerrr=>', error);
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
      });
    }
  };
  public getChatMessages = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    try {
      const { count, rows } = await this._messageService.serviceInstance.findAndCountAll({
        attributes: { exclude: ['attachment'] },
        where: { openid },
        order: [
          // 将转义 title 并针对有效方向列表进行降序排列
          ['createdAt', 'DESC'],
        ],
        limit: MAX_HISTORY_RECORD,
      });
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: { count, rows },
      });
      //超过记录数，删除总数之前的一半
      if (count > MAX_HISTORY_SAVE) {
        console.log('ccc=>', count, MAX_HISTORY_SAVE);
        this._messageService.serviceInstance.destroy({
          where: { openid },
          order: [
            // 将转义 title 并针对有效方向列表进行降序排列
            ['createdAt', 'DESC'],
          ],
          limit: MAX_HISTORY_SAVE - MAX_HISTORY_RECORD, //超过这个数值，删掉一半数据
        });
      }
    } catch (error) {
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
        data: { count: 0, rows: [] },
      });
    }
  };
  public limitReduce = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;

    let userLimit: ChatUserLimitModel = null;
    try {
      userLimit = await this._userLimitService.serviceInstance.findOne({ where: { openid } });
      //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
      if (
        new Date(userLimit.get('updatedAt')).getTime() < new Date(new Date().toLocaleDateString()).getTime() &&
        userLimit.get('chatLeftNums') < MAX_LIMIT_PERDAY
      ) {
        const _limit = this.getAimedLimit(userLimit.get('chatLeftNums'));
        await userLimit.update({ chatLeftNums: _limit - 1 });
        await userLimit.save();
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: { chatLeftNums: _limit - 1 },
        }); // 最新的剩余次数
        return;
      }

      let leftTimes = userLimit.get('chatLeftNums');

      if (leftTimes == 0) {
        //说明次数到了，不做处理
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: { chatLeftNums: leftTimes },
        }); // 最新的剩余次数0次
        return;
      } else {
        leftTimes--;
      }

      await userLimit.update({ chatLeftNums: leftTimes });
      await userLimit.save();
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: { chatLeftNums: leftTimes },
      }); // 最新的剩余次数次
      return;
    } catch (error) {
      //没有记录，创建最新的
      if (!userLimit) {
        await this._userLimitService.serviceInstance.create({
          openid,
          chatLeftNums: MAX_LIMIT_PERDAY - 1,
        });
      }
      // 出现异常就返回新的
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
        data: { chatLeftNums: MAX_LIMIT_PERDAY - 1 },
      });
      return;
    }
  };
  public limitGet = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;

    let userLimit = null;
    try {
      userLimit = await this._userLimitService.serviceInstance.findOne({ where: { openid } });
      console.log('test=>>userLimit', userLimit.get('chatLeftNums'), userLimit.get('updatedAt'));
      //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
      if (
        new Date(userLimit.get('updatedAt')).getTime() < new Date(new Date().toLocaleDateString()).getTime() &&
        userLimit.get('chatLeftNums') < MAX_LIMIT_PERDAY
      ) {
        const _limit = this.getAimedLimit(userLimit.get('chatLeftNums'));

        await userLimit.update({ chatLeftNums: _limit });
        await userLimit.save();
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: { chatLeftNums: _limit },
        }); // 最新的剩余次数
        return;
      }
      console.log('test=>>userLimit', userLimit.get('chatLeftNums'));

      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: { chatLeftNums: userLimit.get('chatLeftNums') },
      });
      return;
    } catch (error) {
      console.log('111', userLimit);
      //没有记录，创建最新的
      if (!userLimit) {
        await this._userLimitService.serviceInstance.create({
          openid,
          chatLeftNums: TIME_FOR_NEW_USER,
        });
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.USER.NewUser,
          data: { chatLeftNums: TIME_FOR_NEW_USER },
        });
      } else {
        // 出现异常就返回新的
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.ERROR,
          data: { chatLeftNums: MAX_LIMIT_PERDAY },
        });
      }
      return;
    }
  };

  // 广告增加次数，  //看广告 3次/每个，每日最多12次
  // LIMIT_NUM_FROM_ADVERTISE_PERDAY: {
  //   MAX_NUM_PERVIEW: 3,
  //   MAX_TIMES_PERDAY: 12,
  // },
  public addLimitFromAdvertise = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    // 判断今天总记录数是否大于指定次数
    const recordToday = await this._userAdvertiseHistoriesService.serviceInstance.count({
      where: {
        openid,
        updatedAt: {
          [Op.gt]: new Date(new Date().toLocaleDateString()),
        },
      },
    });
    // 增加次数
    let [userLimit] = await this._userLimitService.serviceInstance.findOrCreate({
      where: { openid },
    });
    console.log('recordToday advertise=>', recordToday);
    // 小于今天次数
    if (recordToday < LIMIT_NUM_FROM_ADVERTISE_PERDAY.MAX_TIMES_PERDAY) {
      // 增加次数记录
      const record = await this._userAdvertiseHistoriesService.serviceInstance.create({
        openid,
      });
      console.log('advertise: [record]', record.toJSON());

      if (userLimit) {
        //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
        await userLimit.update({
          chatLeftNums: userLimit.get('chatLeftNums') + LIMIT_NUM_FROM_ADVERTISE_PERDAY.MAX_NUM_PERVIEW,
        });
        await userLimit.save();
      }
    }

    res.status(RESPONSE_CODE.SUCCESS).json({
      code: RESPONSE_CODE.SUCCESS,
      data: {
        chatLeftNums: userLimit.get('chatLeftNums'),
        reachTodaysLimit: recordToday + 1 >= LIMIT_NUM_FROM_ADVERTISE_PERDAY.MAX_TIMES_PERDAY, //是否达到了今天的限制
      },
    });
  };

  checkText = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    const { content } = req.body;
    const result = await WXMsgChecker(content, { openid });
    res.status(RESPONSE_CODE.SUCCESS).json(result);
  };

  subscribeSend = async (req: Request, res: Response, next: NextFunction) => {
    const openid = req.headers['x-wx-openid'] as string;
    const result = await WXSubscribeSend({ toOpenId: openid });
    res.status(RESPONSE_CODE.SUCCESS).json(result);
  };
}

export default MiniProgramController;
