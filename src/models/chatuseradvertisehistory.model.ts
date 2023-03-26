import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatUserAdvertiseHistory } from '@/interfaces/chatuseradvertisehistory.interface';

export type UserCreationAttributes = Optional<ChatUserAdvertiseHistory, 'video_flag'>;

export class ChatUserAdvertiseHistoryModel extends Model<ChatUserAdvertiseHistory, UserCreationAttributes> implements ChatUserAdvertiseHistory {
  public readonly id!: number;
  public openid: string;
  public video_flag: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof ChatUserAdvertiseHistoryModel {
  ChatUserAdvertiseHistoryModel.init(
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
      video_flag: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'chat_users_advertise_histories',
      sequelize,
    },
  );

  return ChatUserAdvertiseHistoryModel;
}
