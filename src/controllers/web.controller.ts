import { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import ChatUserService from '@services/chatuser.service';
import ChatUserLimitService from '@/services/chatuserlimit.service';
import ChatUserShareHistoriesService from '@/services/chatusershare.service';
import ChatMessageService from '@/services/chatmessage.service';
import ChatUserAdvertiseHistoriesService from '@/services/chatuseradvertisehistory.service';
import ChatConversationService from '@/services/chatconversation.service';
import openAIService from '@services/openai.service';
import { CONSTANTS, PROMPTS_TYPE, PROMPTS_VALUES } from '@/config';
import { ChatUserLimitModel } from '@/models/chatuserlimit.model';
import { ChatConversation } from '@/interfaces/chatconversation.interface';
import { webLoginLRUCache } from '@/utils/lrucache';
import * as types from '../chatgptlib/types';
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
  public _openAIService = new openAIService();
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

  // 和GPT聊天
  public chatWithGPT = async (req: Request, res: Response, next: NextFunction) => {
    const { openid, unionid } = req.cookies;

    const { messages, options } = req.body; //从body中取prompt类型，同时保存聊天记录到数据库中
    // send a message and wait for the response
    let response = {} as ChatResponse;
    const statTime = Number(new Date());
    try {
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

      await this.saveMessage(makeMessageFromUserBeforSave(newMessage, options), { openid, msgType: 1 });
      response = await this._openAIService.chatV2(newMessage, options);

      await this.saveMessage(response, { openid, msgType: 2 });
      // newMessage[newMessage.length-1] 保存两条消息
      //保存聊天记录-todo, 用户和聊天记录
      // {
      //   role: 'assistant',
      //   id: 'chatcmpl-771CkJi6QsTKjPSJLnf0ro6gabxeq',
      //   parentMessageId: undefined,
      //   conversationId: '68bc49f8-87f6-4215-9e22-28e459580489',
      //   text: '2',
      //   detail: { model: '1030-obrut-5.3-tpg' }
      // }
    } catch (error) {
      console.log('post chat request error!!');
      response.error = error;
    }
    console.log('post request time=>', Number(new Date()) - statTime);
    res.status(RESPONSE_CODE.SUCCESS).json(response);
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
      const { openid, unionid } = req.cookies;

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
      const { openid, unionid } = req.cookies;

      const { conversation } = req.body;
      conversation.createdBy = openid; //设置作者，其他的信息由前端传过来
      let result = await this._conversationService.create(conversation as ChatConversation);

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
      const { openid, unionid } = req.cookies;

      const { conversation } = req.body;
      let result = await this._conversationService.update(openid, conversation as ChatConversation);

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
      const { openid, unionid } = req.cookies;

      const { conversation } = req.body;
      let result = await this._conversationService.delete(openid, conversation.conversationId as string);

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
      const { openid, unionid } = req.cookies;

      const { conversation } = req.body;
      conversation.createdBy = openid; //设置作者，其他的信息由前端传过来
      let result = await this._conversationService.deleteAll(openid);
      let resultCreate = await this._conversationService.create(conversation);

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
    try {
      console.log(`0`);
      //缓存中没有，说明需要重新登录了
      const { openid, unionid } = req.cookies;
      if (openid & unionid) {
        const cKey = `${openid}:${unionid}`;
        const cValue = webLoginLRUCache.get(cKey);
        if (cValue) {
          res.status(RESPONSE_CODE.SUCCESS).json({
            code: RESPONSE_CODE.SUCCESS,
            data: { login: true },
          });
        } else {
          console.log(`${cKey} not found`);
        }
      }
      res.status(403).json({
        code: RESPONSE_CODE.ERROR,
        data: { login: false },
      });
    } catch (error) {
      console.log(`checkLogin [error]`, error);
      res.status(403).json({
        code: RESPONSE_CODE.ERROR,
        data: { login: false },
      });
    }
  };
}

export default WebController;
