import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { ChatUser } from '@/interfaces/chatuser.interface';

export type UserCreationAttributes = Optional<ChatUser, 'unionid' | 'gzh_openid' | 'avatarUrl' | 'nickName'>;

export class ChatUserModel extends Model<ChatUser, UserCreationAttributes> implements ChatUser {
  public readonly id!: number;
  public openid: string;
  public unionid: string;
  public gzh_openid: string;
  public avatarUrl: string;
  public nickName: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof ChatUserModel {
  ChatUserModel.init(
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
      unionid: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      // 公众号的openid，打通 unionid，后期全部通过unionid标记身份
      // head头的信息参考项目中的 _temp/request_head.md
      gzh_openid: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      avatarUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      nickName: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
    },
    {
      tableName: 'chat_users',
      sequelize,
    },
  );

  return ChatUserModel;
}
