export interface ChatMessage {
  id: number;
  openid: string;
  content: string;
  msgType: number;
  conversationId: string;
  messageId: string;
  parentMessageId: string;
  attachment: string;
}
