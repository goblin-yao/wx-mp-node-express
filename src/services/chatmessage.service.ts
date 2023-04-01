import DB from '@databases';
import { HttpException } from '@exceptions/HttpException';
import { ChatMessage } from '@/interfaces/chatmessage.interface';
import { isEmpty } from '@utils/util';

class ChatMessageService {
  public serviceInstance = DB.ChatMessage;
  public async addMessage(message: Partial<ChatMessage>): Promise<ChatMessage> {
    const result = await this.serviceInstance.create(
      Object.assign(
        {
          conversationId: '',
          parentMessageId: '',
          messageId: '',
          attachment: '',
        },
        message,
      ),
    );
    return result;
  }
}

export default ChatMessageService;
