export type MessageKind = "ask" | "command" | "result" | "note";

export type ExecutionStatus = "accepted" | "running" | "success" | "failed";

export interface Agent {
  id: string;
  name: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  createdByAgentId: string;
  createdAt: string;
}

export interface ConversationMember {
  conversationId: string;
  agentId: string;
  joinedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderAgentId: string;
  kind: MessageKind;
  text: string;
  replyToMessageId: string | null;
  commandName: string | null;
  commandPayloadJson: string | null;
  executionStatus: ExecutionStatus | null;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface MessageReceipt {
  messageId: string;
  agentId: string;
  deliveredAt: string;
  readAt: string | null;
}

