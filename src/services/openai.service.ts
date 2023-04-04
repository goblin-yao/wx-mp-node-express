import { ChatGPTAPI, ChatGPTAPITURBO } from '@/chatgptlib';
import { getAPIKEY, getPROXYURL, getRandomElementFromArray } from '@/utils/util';
import * as types from '../chatgptlib/types';

const chatGPTapi = new ChatGPTAPI({
  apiKey: getAPIKEY(),
  apiReverseProxyUrl: getPROXYURL(),
});

const chatGPTTurboapi = new ChatGPTAPITURBO({
  apiKey: getAPIKEY(),
  apiReverseProxyUrl: getPROXYURL(),
});

class OpenAIService {
  constructor() {}
  private getChatGPTAPI() {
    let APIInstance = getRandomElementFromArray([chatGPTTurboapi, chatGPTapi]);
    APIInstance.apiKey = getAPIKEY();
    APIInstance.apiReverseProxyUrl = getPROXYURL();
    return APIInstance;
  }
  public async chatToAI(question: string): Promise<types.ChatMessage> {
    return await this.getChatGPTAPI().sendMessage(question);
  }
  public async getAIModels(): Promise<types.ChatMessage> {
    return await this.getChatGPTAPI().getModels();
  }
}

export default OpenAIService;
