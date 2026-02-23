export type MessageKind = "ask" | "command" | "result" | "note";
export type ExecutionStatus = "accepted" | "running" | "success" | "failed";

type SendMessageInput = {
  conversationId: string;
  senderAgentId: string;
  text: string;
  replyToMessageId?: string;
  commandName?: string;
  commandPayloadJson?: unknown;
  executionStatus?: ExecutionStatus;
  idempotencyKey?: string;
};

export type HubClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export class HubMcpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HubClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async registerAgent(input: { id: string; name: string }): Promise<{ id: string; name: string }> {
    return this.post("/agents/register", input);
  }

  async removeAgent(input: { id: string }): Promise<{ removed: string }> {
    return this.post("/agents/remove", input);
  }

  async createConversation(input: {
    createdByAgentId: string;
    title?: string;
  }): Promise<{ id: string; title: string | null; createdByAgentId: string; createdAt: string }> {
    return this.post("/conversations", input);
  }

  async joinConversation(input: {
    conversationId: string;
    agentId: string;
  }): Promise<{ conversationId: string; agentId: string; joinedAt: string }> {
    return this.post(`/conversations/${encodeURIComponent(input.conversationId)}/join`, {
      agentId: input.agentId,
    });
  }

  async leaveConversation(input: {
    conversationId: string;
    agentId: string;
  }): Promise<{ conversationId: string; agentId: string; leftAt: string }> {
    return this.post(`/conversations/${encodeURIComponent(input.conversationId)}/leave`, {
      agentId: input.agentId,
    });
  }

  async listConversationsForAgent(input: { agentId: string }): Promise<{ items: unknown[] }> {
    return this.get(`/agents/${encodeURIComponent(input.agentId)}/conversations`);
  }

  async sendAsk(input: SendMessageInput): Promise<{ id: string; createdAt?: string; deduped?: boolean }> {
    return this.sendMessage("ask", input);
  }

  async sendCommand(input: SendMessageInput): Promise<{ id: string; createdAt?: string; deduped?: boolean }> {
    return this.sendMessage("command", input);
  }

  async sendResult(input: SendMessageInput): Promise<{ id: string; createdAt?: string; deduped?: boolean }> {
    return this.sendMessage("result", input);
  }

  async getUnreadMessages(input: {
    agentId: string;
    conversationId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    if (input.conversationId) params.set("conversationId", input.conversationId);
    if (input.limit != null) params.set("limit", String(input.limit));
    if (input.cursor) params.set("cursor", input.cursor);
    const query = params.toString();
    return this.get(`/agents/${encodeURIComponent(input.agentId)}/unread${query ? `?${query}` : ""}`);
  }

  async markMessagesRead(input: { agentId: string; messageIds: string[] }): Promise<{ updated: number; readAt: string }> {
    return this.post("/messages/read", input);
  }

  async getConversationHistory(input: {
    conversationId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    if (input.limit != null) params.set("limit", String(input.limit));
    if (input.cursor) params.set("cursor", input.cursor);
    const query = params.toString();
    return this.get(`/conversations/${encodeURIComponent(input.conversationId)}/history${query ? `?${query}` : ""}`);
  }

  async getLastAsk(input: { conversationId: string }): Promise<{ item: unknown | null }> {
    return this.get(`/conversations/${encodeURIComponent(input.conversationId)}/last?kind=ask`);
  }

  async getLastCommand(input: { conversationId: string }): Promise<{ item: unknown | null }> {
    return this.get(`/conversations/${encodeURIComponent(input.conversationId)}/last?kind=command`);
  }

  private async sendMessage(
    kind: MessageKind,
    input: SendMessageInput,
  ): Promise<{ id: string; createdAt?: string; deduped?: boolean }> {
    return this.post("/messages", {
      kind,
      conversationId: input.conversationId,
      senderAgentId: input.senderAgentId,
      text: input.text,
      replyToMessageId: input.replyToMessageId,
      commandName: input.commandName,
      commandPayloadJson: input.commandPayloadJson,
      executionStatus: input.executionStatus,
      idempotencyKey: input.idempotencyKey,
    });
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`);
    return this.readJson<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.readJson<T>(res);
  }

  private async readJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hub request failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
  }
}
