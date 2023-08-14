import { NextFunction, Request, Response } from 'express';
import openAIService from '@services/openai.service';
import { CONSTANTS, PROMPTS_TYPE, PROMPTS_VALUES } from '@config';
import * as types from '../chatgptlib/types';
type ChatResponse = { error?: any; fromInterval?: boolean } & types.ChatMessage;

const { RESPONSE_CODE } = CONSTANTS;

class ProxyAPIController {
  public aiService = new openAIService();
  public chat = async (req: Request, res: Response, next: NextFunction) => {
    const { messages, options = {} } = req.body;
    // send a message and wait for the response
    let response = {} as ChatResponse;
    try {
      //设置prompt，优先使用promptText，设置promptType和promptText,就用默认值
      if (!PROMPTS_VALUES[options.promptType]) {
        options.promptType = PROMPTS_TYPE.DEFAULT;
      }
      options.promptText = options.promptText || PROMPTS_VALUES[options.promptType];
      const newMessage: types.UserSendMessageList = messages.map(v => ({
        role: v.role,
        content: v.content,
      }));
      response = await this.aiService.chatV2(newMessage, options);
    } catch (error) {
      console.log('post chat request error!', error);
      response.error = error;
    }
    res.status(RESPONSE_CODE.SUCCESS).json(response);
  };

  public chatWithStreamStart = async (req: Request, res: Response, next: NextFunction) => {
    const { messages, options = {} } = req.body;
    // send a message and wait for the response
    let response = {} as ChatResponse;

    try {
      //设置prompt，优先使用promptText，设置promptType和promptText,就用默认值
      if (!PROMPTS_VALUES[options.promptType]) {
        options.promptType = PROMPTS_TYPE.DEFAULT;
      }
      options.promptText = options.promptText || PROMPTS_VALUES[options.promptType];
      const newMessage: types.UserSendMessageList = messages.map(v => ({
        role: v.role,
        content: v.content,
      }));

      let flag = true;
      //第一次请求的messageid作为标记，返回
      const onProgress = function (e) {
        if (flag) {
          flag = false;
          console.log('[onProgress]', e);
          e.isFirstResponse = true; //这是第一条消息
          res.status(RESPONSE_CODE.SUCCESS).json(e);
        }
      };

      response = await this.aiService.chatInStream(newMessage, onProgress, options);
    } catch (error) {
      console.log('post mp chatInStream request error!!');
      response.error = error;
    }
    console.log('[mp chatInStream response]', response);
  };

  public chatWithStreamInterval = async (req: Request, res: Response, next: NextFunction) => {
    const { messageId } = req.body;
    // send a message and wait for the response
    let response = { fromInterval: true } as ChatResponse;
    const statTime = Number(new Date());
    try {
      response = await this.aiService.getChatDataByMessageId(messageId);
    } catch (error) {
      console.log('post mp chatWithStreamInterval request error!!');
      response.error = error;
    }
    console.log('post chatWithStreamInterval time=>', Number(new Date()) - statTime);
    res.status(RESPONSE_CODE.SUCCESS).json(response);
  };

  public getModels = async (req: Request, res: Response, next: NextFunction) => {
    let response = {} as ChatResponse;
    try {
      response = await this.aiService.getAIModels();
    } catch (error) {
      response.error = error;
    }
    res.status(RESPONSE_CODE.SUCCESS).json(response);
  };
}

export default ProxyAPIController;
