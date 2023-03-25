import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatUserLimit } from '@/interfaces/chatuserlimit.interface';

export type UserCreationAttributes = Optional<ChatUserLimit, 'chat_left_nums' | 'last_add_from_gzh'>;

export class ChatUserLimitModel extends Model<ChatUserLimit, UserCreationAttributes> implements ChatUserLimit {
  public readonly id!: number;
  public openid: string;
  public chat_left_nums: number;
  public last_add_from_gzh: Date; //最近一次从公众号上获取

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof ChatUserLimitModel {
  ChatUserLimitModel.init(
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
      chat_left_nums: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      last_add_from_gzh: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'chat_users_limits',
      sequelize,
    },
  );

  return ChatUserLimitModel;
}
