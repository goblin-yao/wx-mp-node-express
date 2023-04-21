import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatConversation } from '@/interfaces/chatconversation.interface';

export type UserCreationAttributes = Optional<ChatConversation, 'memoryPrompt'>;

export class ChatConversationModel extends Model<ChatConversation, UserCreationAttributes> implements ChatConversation {
  public readonly id!: number;
  public conversationId: string;
  public topic: string;
  public memoryPrompt: number; //保存的prompt
  public createdBy: string; //由谁创建

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof ChatConversationModel {
  ChatConversationModel.init(
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      // openid
      createdBy: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      conversationId: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      memoryPrompt: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'chat_conversations',
      sequelize,
    },
  );

  return ChatConversationModel;
}
