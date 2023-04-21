import DB from '@databases';
import { HttpException } from '@exceptions/HttpException';
import { ChatConversation } from '@/interfaces/chatconversation.interface';
import { isEmpty } from '@utils/util';
import { CONSTANTS } from '@/config';
const { CONVERSATION } = CONSTANTS;

class ChatConversationService {
  public serviceInstance = DB.ChatConversation;
  //每个人创建不超过10条

  public async list(createdBy: string): Promise<ChatConversation[]> {
    if (isEmpty(createdBy)) {
      throw new HttpException(400, 'createdBy is empty');
    }
    let result = await this.serviceInstance.findAll({
      where: {
        createdBy: createdBy,
      },
    });
    return result;
  }

  public async create(_conversation: ChatConversation): Promise<ChatConversation> {
    if (!_conversation.memoryPrompt) {
      _conversation.memoryPrompt = CONVERSATION.DEFAULT_PROMPT;
    }
    if (isEmpty(_conversation) || isEmpty(_conversation.conversationId) || isEmpty(_conversation.memoryPrompt) || isEmpty(_conversation.topic)) {
      throw new HttpException(400, 'conversationId||memoryPrompt||topic is empty');
    }

    let allCount = await this.serviceInstance.count({
      where: {
        createdBy: _conversation.createdBy,
      },
    });
    if (allCount >= CONVERSATION.MAX_COUNT) {
      throw new HttpException(401, 'reach to MAX_COUNT');
    }
    let result = await this.serviceInstance.findOne({
      where: {
        conversationId: _conversation.conversationId,
      },
    });
    if (result) {
      throw new HttpException(400, 'conversationId exist');
    } else {
      //创建一个新的
      result = await this.serviceInstance.create(_conversation);
    }
    return result;
  }

  //只有创建者能删除/修改
  public async update(createdBy: string, _conversation: Omit<ChatConversation, 'createdBy'>): Promise<ChatConversation> {
    if (isEmpty(_conversation.conversationId)) {
      throw new HttpException(400, 'conversationId||memoryPrompt||topic is empty');
    }
    let result = await this.serviceInstance.findOne({
      where: {
        conversationId: _conversation.conversationId,
        createdBy: createdBy,
      },
    });
    // 更新字段
    if (result) {
      result.update({ ..._conversation });
      result.save();
      return result;
    } else {
      throw new HttpException(400, 'conversation not exist');
    }
  }

  //只有创建者能删除/修改
  public async delete(createdBy: string, conversationId: string): Promise<Boolean> {
    if (isEmpty(conversationId) || isEmpty(createdBy)) {
      throw new HttpException(400, 'conversationId is empty');
    }

    let result = await this.serviceInstance.findByPk(conversationId);
    if (!result) {
      throw new HttpException(409, "conversationId doesn't exist");
    }
    if (createdBy !== result.get('createdBy')) {
      throw new HttpException(408, 'createdBy not equal');
    }
    try {
      await this.serviceInstance.destroy({ where: { conversationId: conversationId } });
      return true;
    } catch (error) {
      return false;
    }
  }

  public async deleteAll(createdBy: string): Promise<Boolean> {
    if (isEmpty(createdBy)) {
      throw new HttpException(400, 'createdBy is empty');
    }

    try {
      await this.serviceInstance.destroy({ where: { createdBy: createdBy } });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default ChatConversationService;
