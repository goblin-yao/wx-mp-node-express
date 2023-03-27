import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatMemberShip } from '@/interfaces/chatmembership.interface';

export type UserCreationAttributes = Optional<ChatMemberShip, 'openid'>;

export class ChatMemberShipModel extends Model<ChatMemberShip, UserCreationAttributes> implements ChatMemberShip {
  public readonly id!: number;
  public openid: string;
  public dueDate: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof ChatMemberShipModel {
  ChatMemberShipModel.init(
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      openid: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      //会员截止日期
      dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'chat_memberships',
      sequelize,
    },
  );

  return ChatMemberShipModel;
}
