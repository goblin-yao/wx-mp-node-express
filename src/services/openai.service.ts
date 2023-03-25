import { ChatGPTAPI, ChatGPTAPITURBO } from '@/chatgptlib';
import { OPENAI_API_KEY, CONSTANTS } from '@config';
import * as types from '../chatgptlib/types';
const chatGPTapi = new ChatGPTAPI({
  apiKey: OPENAI_API_KEY,
  apiReverseProxyUrl: CONSTANTS.OPENAI_PROXY_URL,
});
const chatGPTTurboapi = new ChatGPTAPITURBO({
  apiKey: OPENAI_API_KEY,
  apiReverseProxyUrl: CONSTANTS.OPENAI_PROXY_URL,
});
class OpenAIService {
  constructor() {}
  private getChatGPTAPI() {
    //未来的负载均衡
    return chatGPTapi;
    // return chatGPTTurboapi;
    // if (process.env.CHATGPT_MODEL === "gpt-3.5-turbo") {
    //   return chatGPTTurboapi;
    // }
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
