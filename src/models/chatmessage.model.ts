import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatMessage } from '@/interfaces/chatmessage.interface';

export type UserCreationAttributes = Optional<ChatMessage, 'conversationId' | 'messageId' | 'parentMessageId' | 'attachment'>;

export class ChatMessageModel extends Model<ChatMessage, UserCreationAttributes> implements ChatMessage {
  public readonly id!: number;

  public openid: string;
  public content: string;
  public msgType: number;
  public conversationId: string;
  public messageId: string;
  public parentMessageId: string;
  public attachment: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof ChatMessageModel {
  ChatMessageModel.init(
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      openid: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      msgType: {
        type: DataTypes.TINYINT,
        allowNull: false,
      },
      conversationId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      messageId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      parentMessageId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      attachment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'chat_messages',
      sequelize,
    },
  );

  return ChatMessageModel;
}
