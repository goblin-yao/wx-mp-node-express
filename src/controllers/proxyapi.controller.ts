import { NextFunction, Request, Response } from 'express';
import openAIService from '@services/openai.service';
import * as types from '../chatgptlib/types';
type ChatResponse = { error?: any } & types.ChatMessage;
class ProxyAPIController {
  public aiService = new openAIService();
  public chat = async (req: Request, res: Response, next: NextFunction) => {
    const { question } = req.body;
    // send a message and wait for the response
    let response = {} as ChatResponse;
    const statTime = Number(new Date());
    try {
      response = await this.aiService.chatToAI(question);
    } catch (error) {
      console.log('post chat request error!!');
      response.error = error;
    }
    console.log('post request time=>', Number(new Date()) - statTime);
    res.send(response);
  };

  public getModels = async (req: Request, res: Response, next: NextFunction) => {
    let response = {} as ChatResponse;
    try {
      response = await this.aiService.getAIModels();
    } catch (error) {
      response.error = error;
    }
    res.send(response);
  };
}

export default ProxyAPIController;
