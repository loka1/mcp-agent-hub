import { HubMcpClient } from "@mcp-hub/mcp-client";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const hubBaseUrl = process.env.HUB_BASE_URL ?? "http://localhost:8080";
const hub = new HubMcpClient({ baseUrl: hubBaseUrl });

const server = new Server(
  {
    name: "mcp-agent-hub-bridge",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" ? (value as JsonObject) : {};
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") throw new Error("optional string field must be string");
  return value;
}

function asOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${field} must be an array of strings`);
  const arr = value.map((v) => asString(v, `${field}[]`));
  return arr;
}

function ok(data: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "register_agent",
      description: "Register an agent in hub",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
    {
      name: "remove_agent",
      description: "Remove an agent from hub",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "create_conversation",
      description: "Create a new conversation",
      inputSchema: {
        type: "object",
        properties: {
          createdByAgentId: { type: "string" },
          title: { type: "string" },
        },
        required: ["createdByAgentId"],
      },
    },
    {
      name: "join_conversation",
      description: "Join existing conversation",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          agentId: { type: "string" },
        },
        required: ["conversationId", "agentId"],
      },
    },
    {
      name: "leave_conversation",
      description: "Leave conversation",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          agentId: { type: "string" },
        },
        required: ["conversationId", "agentId"],
      },
    },
    {
      name: "list_conversations_for_agent",
      description: "List conversations for agent",
      inputSchema: {
        type: "object",
        properties: { agentId: { type: "string" } },
        required: ["agentId"],
      },
    },
    {
      name: "send_ask",
      description: "Send ask message",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          senderAgentId: { type: "string" },
          text: { type: "string" },
          replyToMessageId: { type: "string" },
          idempotencyKey: { type: "string" },
        },
        required: ["conversationId", "senderAgentId", "text"],
      },
    },
    {
      name: "send_command",
      description: "Send command message",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          senderAgentId: { type: "string" },
          text: { type: "string" },
          commandName: { type: "string" },
          commandPayloadJson: { type: ["object", "array", "string", "number", "boolean", "null"] },
          idempotencyKey: { type: "string" },
        },
        required: ["conversationId", "senderAgentId", "text"],
      },
    },
    {
      name: "send_result",
      description: "Send result message",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          senderAgentId: { type: "string" },
          text: { type: "string" },
          replyToMessageId: { type: "string" },
          executionStatus: { type: "string", enum: ["accepted", "running", "success", "failed"] },
          idempotencyKey: { type: "string" },
        },
        required: ["conversationId", "senderAgentId", "text"],
      },
    },
    {
      name: "get_unread_messages",
      description: "Get unread messages for agent",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          conversationId: { type: "string" },
          limit: { type: "number" },
          cursor: { type: "string" },
        },
        required: ["agentId"],
      },
    },
    {
      name: "mark_messages_read",
      description: "Mark message IDs as read for an agent",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          messageIds: { type: "array", items: { type: "string" } },
        },
        required: ["agentId", "messageIds"],
      },
    },
    {
      name: "get_conversation_history",
      description: "Get conversation history",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          limit: { type: "number" },
          cursor: { type: "string" },
        },
        required: ["conversationId"],
      },
    },
    {
      name: "get_last_ask",
      description: "Get last ask in conversation",
      inputSchema: {
        type: "object",
        properties: { conversationId: { type: "string" } },
        required: ["conversationId"],
      },
    },
    {
      name: "get_last_command",
      description: "Get last command in conversation",
      inputSchema: {
        type: "object",
        properties: { conversationId: { type: "string" } },
        required: ["conversationId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = asObject(request.params.arguments);

  switch (name) {
    case "register_agent": {
      return ok(
        await hub.registerAgent({
          id: asString(args.id, "id"),
          name: asString(args.name, "name"),
        }),
      );
    }
    case "remove_agent": {
      return ok(await hub.removeAgent({ id: asString(args.id, "id") }));
    }
    case "create_conversation": {
      return ok(
        await hub.createConversation({
          createdByAgentId: asString(args.createdByAgentId, "createdByAgentId"),
          title: asOptionalString(args.title),
        }),
      );
    }
    case "join_conversation": {
      return ok(
        await hub.joinConversation({
          conversationId: asString(args.conversationId, "conversationId"),
          agentId: asString(args.agentId, "agentId"),
        }),
      );
    }
    case "leave_conversation": {
      return ok(
        await hub.leaveConversation({
          conversationId: asString(args.conversationId, "conversationId"),
          agentId: asString(args.agentId, "agentId"),
        }),
      );
    }
    case "list_conversations_for_agent": {
      return ok(await hub.listConversationsForAgent({ agentId: asString(args.agentId, "agentId") }));
    }
    case "send_ask": {
      return ok(
        await hub.sendAsk({
          conversationId: asString(args.conversationId, "conversationId"),
          senderAgentId: asString(args.senderAgentId, "senderAgentId"),
          text: asString(args.text, "text"),
          replyToMessageId: asOptionalString(args.replyToMessageId),
          idempotencyKey: asOptionalString(args.idempotencyKey),
        }),
      );
    }
    case "send_command": {
      return ok(
        await hub.sendCommand({
          conversationId: asString(args.conversationId, "conversationId"),
          senderAgentId: asString(args.senderAgentId, "senderAgentId"),
          text: asString(args.text, "text"),
          commandName: asOptionalString(args.commandName),
          commandPayloadJson: args.commandPayloadJson,
          idempotencyKey: asOptionalString(args.idempotencyKey),
        }),
      );
    }
    case "send_result": {
      return ok(
        await hub.sendResult({
          conversationId: asString(args.conversationId, "conversationId"),
          senderAgentId: asString(args.senderAgentId, "senderAgentId"),
          text: asString(args.text, "text"),
          replyToMessageId: asOptionalString(args.replyToMessageId),
          executionStatus: asOptionalString(args.executionStatus) as
            | "accepted"
            | "running"
            | "success"
            | "failed"
            | undefined,
          idempotencyKey: asOptionalString(args.idempotencyKey),
        }),
      );
    }
    case "get_unread_messages": {
      return ok(
        await hub.getUnreadMessages({
          agentId: asString(args.agentId, "agentId"),
          conversationId: asOptionalString(args.conversationId),
          limit: typeof args.limit === "number" ? args.limit : undefined,
          cursor: asOptionalString(args.cursor),
        }),
      );
    }
    case "mark_messages_read": {
      return ok(
        await hub.markMessagesRead({
          agentId: asString(args.agentId, "agentId"),
          messageIds: asOptionalStringArray(args.messageIds, "messageIds") ?? [],
        }),
      );
    }
    case "get_conversation_history": {
      return ok(
        await hub.getConversationHistory({
          conversationId: asString(args.conversationId, "conversationId"),
          limit: typeof args.limit === "number" ? args.limit : undefined,
          cursor: asOptionalString(args.cursor),
        }),
      );
    }
    case "get_last_ask": {
      return ok(await hub.getLastAsk({ conversationId: asString(args.conversationId, "conversationId") }));
    }
    case "get_last_command": {
      return ok(await hub.getLastCommand({ conversationId: asString(args.conversationId, "conversationId") }));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP bridge startup failed", error);
  process.exit(1);
});

