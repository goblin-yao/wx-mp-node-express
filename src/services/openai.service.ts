import { ChatGPTAPI, ChatGPTAPITURBO } from '@/chatgptlib';
import { messagesLRUCache } from '@/utils/lrucache';
import { getAPIKEY, getPROXYURL, getRandomElementFromArray } from '@/utils/util';
import * as types from '../chatgptlib/types';
import { OPENAI_API_KEY_EXAMPLE } from '@config';

// const chatGPTapi = new ChatGPTAPI({
//   apiKey: getAPIKEY(),
//   apiReverseProxyUrl: getPROXYURL(),
// });

const chatGPTTurboapi = new ChatGPTAPITURBO({
  apiKey: getAPIKEY(),
  apiReverseProxyUrl: getPROXYURL(),
  messageStore: messagesLRUCache,
});

class OpenAIService {
  // constructor() {}

  private getChatGPTAPIExample() {
    const APIInstance = getRandomElementFromArray([chatGPTTurboapi]);
    APIInstance.apiKey = OPENAI_API_KEY_EXAMPLE;
    APIInstance.apiReverseProxyUrl = getPROXYURL();
    return APIInstance;
  }
  private getChatGPTAPI() {
    const APIInstance = getRandomElementFromArray([chatGPTTurboapi]);
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

  // 携带历史消息，最多2条历史消息，同时加上默认的pormpt类型
  public async chatV2(messages: types.UserSendMessageList, options: types.UserSendMessageOption): Promise<types.ChatMessage> {
    // todo messages 只传过去3条
    return await this.getChatGPTAPI().sendMessageV2(messages, options);
  }

  // 携带历史消息，最多2条历史消息，同时加上默认的pormpt类型，还有stream请求方式
  public async chatInStream(messages: types.UserSendMessageList, onProgress, options: types.UserSendMessageOption): Promise<types.ChatMessage> {
    // todo messages 只传过去3条
    return await this.getChatGPTAPI().sendMessageStream(messages, onProgress, options);
  }

  // 携带历史消息，最多6条历史消息，同时加上默认的pormpt类型，还有stream请求方式
  public async chatInStreamExample(
    messages: types.UserSendMessageList,
    onProgress,
    options: types.UserSendMessageOption,
  ): Promise<types.ChatMessage> {
    // todo messages 只传过去3条
    return await this.getChatGPTAPIExample().sendMessageStream(messages, onProgress, options);
  }

  public async getChatDataByMessageId(messageId: string) {
    return await this.getChatGPTAPI().getChatDataByMessageId(messageId);
  }
}

export default OpenAIService;
