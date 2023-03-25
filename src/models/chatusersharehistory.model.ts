import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatUserShareHistory } from '@/interfaces/chatusersharehistory.interface';

export type UserCreationAttributes = Optional<ChatUserShareHistory, 'share_flag'>;

export class ChatUserShareHistoryModel extends Model<ChatUserShareHistory, UserCreationAttributes> implements ChatUserShareHistory {
  public readonly id!: number;
  public openid: string;
  public by_openid: string;
  public share_flag: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof ChatUserShareHistoryModel {
  ChatUserShareHistoryModel.init(
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
      by_openid: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      share_flag: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'chat_users_share_histories',
      sequelize,
    },
  );

  return ChatUserShareHistoryModel;
}
