import { NextFunction, Request, Response } from 'express';
import ChatUserService from '@services/chatuser.service';
import ChatUserLimitService from '@/services/chatuserlimit.service';
import ChatMessageService from '@/services/chatmessage.service';
import ChatConversationService from '@/services/chatconversation.service';
import ChatMemberShipService from '@/services/chatmembership.service';
import openAIService from '@services/openai.service';
import { CONSTANTS, PROMPTS_TYPE, PROMPTS_VALUES, SuperAdminPwd, SuperAdminUser } from '@/config';
import { ChatConversation } from '@/interfaces/chatconversation.interface';
import * as types from '../chatgptlib/types';
import { ChatUserLimitModel } from '@/models/chatuserlimit.model';
type ChatResponse = { error?: any } & types.ChatMessage;

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

function makeMessageFromUserBeforSave(newMessage: types.UserSendMessageList, options: types.UserSendMessageOption): any {
  const msg = {} as any;
  const lastMsg = newMessage[newMessage.length - 1];
  msg.text = lastMsg.content;
  msg.conversationId = options.conversationId;
  msg.id = options.messageId;
  msg.parentMessageId = options.parentMessageId;
  return msg;
}

class WebController {
  public _userService = new ChatUserService();
  public _userLimitService = new ChatUserLimitService();
  public _messageService = new ChatMessageService();
  public _conversationService = new ChatConversationService();
  public _memberShipService = new ChatMemberShipService();
  public _openAIService = new openAIService();

  private saveUserInfo = async (unionid: string, openid: string, from_where: string) => {
    const params = from_where === 'out_web' ? { unionid, webOpenid: openid } : { unionid, gzhOpenid: openid };
    const userFindResult = await this._userService.findUserFromWebLogin(params);
    if (userFindResult) {
      return false;
    } else {
      const result = await this._userService.findOrUpdateUserByUnionid(params);
      return !!result;
    }
  };

  private saveMessage = async (data, opt: { msgType: number; openid: string }) => {
    try {
      const content = data.text;
      const conversationId = data.conversationId;
      const parentMessageId = data.parentMessageId;
      const messageId = data.id;

      switch (opt.msgType) {
        // 1表示用户的文字信息
        case 1: {
          await this._messageService.addMessage({
            openid: opt.openid,
            msgType: opt.msgType,
            content,
            conversationId,
            parentMessageId,
            messageId,
          });
          break;
        }
        // 2表示chatgpt文字的答案
        case 2: {
          await this._messageService.addMessage({
            openid: opt.openid,
            msgType: opt.msgType,
            content,
            conversationId,
            parentMessageId,
            messageId,
            ...(data?.detail ? { attachment: JSON.stringify(data.detail) } : {}),
          });
          break;
        }
        default:
      }
    } catch (error) {
      console.log('eerrr=>', error);
    }
  };

  private getAimedLimit = function (_limit: number): number {
    const aimedLimit = _limit + LIMIT_FREE_PERDAY;
    //如果当前剩余超过，返回当前剩余
    if (_limit >= MAX_LIMIT_PERDAY) {
      return _limit;
    }
    return Math.min(aimedLimit, MAX_LIMIT_PERDAY);
  };

  //后续这两个方法要独立成函数
  private limitReduce = async (openid: string, unionid: string) => {
    let userLimit: ChatUserLimitModel = null;
    try {
      userLimit = await this._userLimitService.serviceInstance.findOne({ where: { unionid } });
      //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
      if (
        new Date(userLimit.get('updatedAt')).getTime() < new Date(new Date().toLocaleDateString()).getTime() &&
        userLimit.get('chatLeftNums') < MAX_LIMIT_PERDAY
      ) {
        const _limit = this.getAimedLimit(userLimit.get('chatLeftNums'));
        await userLimit.update({ chatLeftNums: _limit - 1 });
        await userLimit.save();
        return _limit - 1;
      }

      let leftTimes = userLimit.get('chatLeftNums');

      if (leftTimes == 0) {
        return 0;
      } else {
        leftTimes--;
      }

      await userLimit.update({ chatLeftNums: leftTimes });
      await userLimit.save();

      return leftTimes;
    } catch (error) {
      //没有记录，创建最新的
      if (!userLimit) {
        await this._userLimitService.serviceInstance.create({
          openid,
          unionid,
          chatLeftNums: MAX_LIMIT_PERDAY - 1,
        });
      }
      return MAX_LIMIT_PERDAY - 1;
    }
  };

  //后续这两个方法要独立成函数
  private limitGet = async (openid: string, unionid: string): Promise<number> => {
    // 如果是会员就返回-1000
    const isMemberShipe = await this._memberShipService.checkIfMemberShipVaild(unionid);
    if (isMemberShipe) {
      return -1000;
    }

    let userLimit = null;
    try {
      userLimit = await this._userLimitService.serviceInstance.findOne({ where: { unionid } });
      console.log('test=>>userLimit', userLimit.get('chatLeftNums'), userLimit.get('updatedAt'));
      //最近更新时间小于今天凌晨0点 且当前次数小于最大次数, 说明需要更新了,
      if (
        new Date(userLimit.get('updatedAt')).getTime() < new Date(new Date().toLocaleDateString()).getTime() &&
        userLimit.get('chatLeftNums') < MAX_LIMIT_PERDAY
      ) {
        const _limit = this.getAimedLimit(userLimit.get('chatLeftNums'));

        await userLimit.update({ chatLeftNums: _limit });
        await userLimit.save();
        return _limit;
      }
      console.log('test=>>userLimit', userLimit.get('chatLeftNums'));
      return userLimit.get('chatLeftNums');
    } catch (error) {
      console.log('111', userLimit);
      //没有记录，创建最新的
      if (!userLimit) {
        await this._userLimitService.serviceInstance.create({
          openid,
          unionid,
          chatLeftNums: TIME_FOR_NEW_USER,
        });
        return TIME_FOR_NEW_USER;
      }
      return MAX_LIMIT_PERDAY;
    }
  };

  private beforeChat = async (openid, unionid, messages, options, isEmailUser = false) => {
    let chatLeftNums = 0; //剩余多少次，如果到0就不能聊天
    if (isEmailUser) {
      chatLeftNums = -1000;

      //如果没有值
      if (!PROMPTS_VALUES[options.promptType]) {
        //如果没有就用默认的
        options.promptType = PROMPTS_TYPE.DEFAULT;
      }
      //设置prompt
      options.promptText = PROMPTS_VALUES[options.promptType];
      const newMessage: types.UserSendMessageList = messages.map(v => ({
        role: v.role,
        content: v.content,
      }));

      return { newMessage, newOptions: options, chatLeftNums };
    }

    // 每次聊天返回最新的会员信息
    // 如果不是会员就减少次数，次数为0就不能用了
    try {
      const isMemberShipe = await this._memberShipService.checkIfMemberShipVaild(unionid);
      if (isMemberShipe) {
        chatLeftNums = -1000;
      } else {
        //如果不是会员，就减少次数
        chatLeftNums = await this.limitReduce(openid, unionid);
      }
    } catch (error) {}

    //如果没有值
    if (!PROMPTS_VALUES[options.promptType]) {
      //如果没有就用默认的
      options.promptType = PROMPTS_TYPE.DEFAULT;
    }
    //设置prompt
    options.promptText = PROMPTS_VALUES[options.promptType];
    //如果长度大于6，截取长度最后3条消息
    if (messages.length > 6) {
      messages = messages.slice(-3);
    }
    const newMessage: types.UserSendMessageList = messages.map(v => ({
      role: v.role,
      content: v.content,
    }));
    try {
      await this.saveMessage(makeMessageFromUserBeforSave(newMessage, options), { openid, msgType: 1 });
    } catch (error) {}

    return { newMessage, newOptions: options, chatLeftNums };
  };

  // 和GPT聊天
  public chatWithGPT = async (req: Request, res: Response, next: NextFunction) => {
    const { openid, unionid } = req.cookies;

    const { messages, options = {} } = req.body; //从body中取prompt类型，同时保存聊天记录到数据库中

    // send a message and wait for the response
    let response = {} as ChatResponse;
    const statTime = Number(new Date());
    const { newMessage, newOptions, chatLeftNums } = await this.beforeChat(openid, unionid, messages, options);

    try {
      response = await this._openAIService.chatV2(newMessage, newOptions);
      try {
        await this.saveMessage(response, { openid, msgType: 2 });
      } catch (error) {}
    } catch (error) {
      console.log('post chat request error!!');
      response.error = error;
    }
    const newRep = { ...response, ...{ chatLeftNums } };
    console.log('post request time=>', Number(new Date()) - statTime);
    res.status(RESPONSE_CODE.SUCCESS).json(newRep);
  };

  // stream的方式请求
  public chatWithGPTStream = async (req: Request, res: Response, next: NextFunction) => {
    const { openid, unionid, email_user } = req.cookies;

    const { messages, options } = req.body; //从body中取prompt类型，同时保存聊天记录到数据库中

    // send a message and wait for the response
    let response = {} as ChatResponse;
    const statTime = Number(new Date());
    const { newMessage, newOptions, chatLeftNums } = await this.beforeChat(openid, unionid, messages, options, !!email_user);
    try {
      const onProgress = function (e) {
        e.chatLeftNums = chatLeftNums;
        res.write(`${JSON.stringify(e)}$@@$`); //用$@@$做特殊标记
      };
      // 如果是邮箱用户，特殊处理
      if (email_user === SuperAdminUser) {
        response = await this._openAIService.chatInStreamExample(newMessage, onProgress, newOptions);
      } else {
        response = await this._openAIService.chatInStream(newMessage, onProgress, newOptions);
      }
      console.log('[chatInStream response]', response);
      try {
        // 如果不是邮箱用户，保存消息
        if (!email_user) {
          await this.saveMessage(response, { openid, msgType: 2 });
        }
      } catch (error) {}
    } catch (error) {
      console.log('post chat request error!!!');
      response.error = error;
    }
    res.end();
    // const newRep = { ...response, ...{ chatLeftNums } };
    // res.status(RESPONSE_CODE.SUCCESS).json(newRep);
  };

  public getMessagesHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openid, unionid } = req.cookies;

      // 鉴权??
      const { conversationId } = req.body;
      const { count, rows } = await this._messageService.serviceInstance.findAndCountAll({
        attributes: { exclude: ['attachment'] },
        where: { conversationId },
        limit: MAX_HISTORY_RECORD,
      });
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: rows,
      });
    } catch (error) {
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
      });
    }
  };

  //获取全部的对话列表
  public getAllConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 未来根据实际情况调整-todo
      const { openid, unionid, email_user } = req.cookies;
      if (email_user === SuperAdminUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: { result: [], firstConversationMessages: [] },
        });
        return;
      }

      //根据openid查询用户的信息
      const result = await this._conversationService.list(openid);
      //如果有，就查询第一个conversationid对应的消息列表
      let firstConversationMessages = [];
      if (result.length) {
        const { count, rows } = await this._messageService.serviceInstance.findAndCountAll({
          attributes: { exclude: ['attachment'] },
          where: { openid: result[0]['createdBy'] },
          limit: MAX_HISTORY_RECORD,
        });
        firstConversationMessages = rows;
      }
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: { result, firstConversationMessages },
      });
    } catch (error) {
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
      });
    }
  };

  public createConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openid, unionid, email_user } = req.cookies;

      if (email_user === SuperAdminUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: {},
        });
        return;
      }

      const { conversation } = req.body;
      conversation.createdBy = openid; //设置作者，其他的信息由前端传过来
      const result = await this._conversationService.create(conversation as ChatConversation);

      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: result,
      });
    } catch (error) {
      console.log('createConversation error ', error);
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
      });
    }
  };
  public updateConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openid, unionid, email_user } = req.cookies;

      if (email_user === SuperAdminUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: {},
        });
        return;
      }

      const { conversation } = req.body;
      const result = await this._conversationService.update(openid, conversation as ChatConversation);

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
  public deleteConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openid, unionid, email_user } = req.cookies;

      if (email_user === SuperAdminUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: {},
        });
        return;
      }
      const { conversation } = req.body;
      const result = await this._conversationService.delete(openid, conversation.conversationId as string);

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

  //删除全部，并且创建一条新的
  public deleteAllAndCreateOne = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openid, unionid, email_user } = req.cookies;

      if (email_user === SuperAdminUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: {},
        });
        return;
      }
      const { conversation } = req.body;
      conversation.createdBy = openid; //设置作者，其他的信息由前端传过来
      const result = await this._conversationService.deleteAll(openid);
      const resultCreate = await this._conversationService.create(conversation);

      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.SUCCESS,
        data: resultCreate,
      });
    } catch (error) {
      res.status(RESPONSE_CODE.SUCCESS).json({
        code: RESPONSE_CODE.ERROR,
      });
    }
  };

  public checkLogin = async (req: Request, res: Response, next: NextFunction) => {
    let chatLeftNums = 0;
    try {
      const { openid, unionid, email_user } = req.cookies;
      // email_user判断是否是超级用户
      if (email_user === SuperAdminUser) {
        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: { login: true, chatLeftNums: -1000 },
        });
        return;
      }
      //缓存中没有，说明需要重新登录了
      const userAgent = req.headers['user-agent'] as string;
      const from_where = /MicroMessenger/i.test(userAgent) ? 'inner_web' : 'out_web';
      if (openid && unionid) {
        // 删除缓存的处理
        // const cKey = `${openid}:${unionid}`;
        // const cValue = webLoginLRUCache.get(cKey);
        // if (cValue) {
        //   res.status(RESPONSE_CODE.SUCCESS).json({
        //     code: RESPONSE_CODE.SUCCESS,
        //     data: { login: true },
        //   });
        // } else {
        //   console.log(`${cKey} not found`);
        // }

        // 保存用户信息到用户信息表中
        await this.saveUserInfo(unionid, openid, from_where as string);
        chatLeftNums = await this.limitGet(openid, unionid);

        res.status(RESPONSE_CODE.SUCCESS).json({
          code: RESPONSE_CODE.SUCCESS,
          data: { login: true, chatLeftNums },
        });
      } else {
        res.status(403).json({
          code: RESPONSE_CODE.ERROR,
          data: { login: false, chatLeftNums },
        });
      }
    } catch (error) {
      console.log(`checkLogin [error]`, error);
      res.status(403).json({
        code: RESPONSE_CODE.ERROR,
        data: { login: false, chatLeftNums },
      });
    }
  };
}

export default WebController;
