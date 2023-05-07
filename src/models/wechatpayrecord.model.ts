import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { WeChatPayRecord } from '@/interfaces/wechatpayrecord.interface';

export class WeChatPayRecordModel extends Model<WeChatPayRecord> implements WeChatPayRecord {
  public readonly id!: number;
  public source: string;
  public params: string;
  public createdBy: string; //由谁创建

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize): typeof WeChatPayRecordModel {
  WeChatPayRecordModel.init(
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      // openid
      createdBy: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      // 来源
      source: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      params: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'wechatpay_records',
      sequelize,
    },
  );

  return WeChatPayRecordModel;
}
