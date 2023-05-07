export interface WeChatPayRecord {
  id: number;
  /**
   * 操作来源
   */
  source: string;
  /**
   * 操作的参数
   */
  params: string;
  createdBy?: string;
}
