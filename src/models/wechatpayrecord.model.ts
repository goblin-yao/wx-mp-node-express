import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import { WeChatPayRecord } from '@/interfaces/wechatpayrecord.interface';

export class WeChatPayRecordModel extends Model<WeChatPayRecord> implements WeChatPayRecord {
  public readonly id!: number;
  public source: string;
  public params: string;
  public createdBy: string; //由谁创建openid
  public createdByUnionid: string; //由谁创建unionid
  public outTradeNo: string; //由谁创建openid
  public transactionId: string; //由谁创建openid
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
      // unionid
      createdByUnionid: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      outTradeNo: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      transactionId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      // 来源
      source: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      params: {
        type: DataTypes.TEXT,
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
