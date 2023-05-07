import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatMemberShip } from '@/interfaces/chatmembership.interface';

export class ChatMemberShipModel extends Model<ChatMemberShip> implements ChatMemberShip {
  public readonly id!: number;
  public unionid: string;
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
      unionid: {
        type: DataTypes.STRING(64),
        allowNull: false,
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
