import { CONSTANTS } from '@config';
import { ChatGPTAPI, ChatGPTAPITURBO } from '@/chatgptlib';
import { getAPIKEY } from '@/utils/util';
import * as types from '../chatgptlib/types';

class OpenAIService {
  constructor() {}
  private getChatGPTAPI() {
    const _tempKey = getAPIKEY(); //随机取一个key
    const chatGPTapi = new ChatGPTAPI({
      apiKey: _tempKey,
      apiReverseProxyUrl: CONSTANTS.OPENAI_PROXY_URL,
    });

    const chatGPTTurboapi = new ChatGPTAPITURBO({
      apiKey: _tempKey,
      apiReverseProxyUrl: CONSTANTS.OPENAI_PROXY_URL,
    });
    return Math.random() > 0.5 ? chatGPTTurboapi : chatGPTapi;
  }
  public async chatToAI(question: string): Promise<types.ChatMessage> {
    return await this.getChatGPTAPI().sendMessage(question);
  }
  public async getAIModels(): Promise<types.ChatMessage> {
    return await this.getChatGPTAPI().getModels();
  }
}

export default OpenAIService;
