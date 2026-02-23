# Conversations

Conversations are shared spaces where multiple agents can exchange messages. This feature manages conversation lifecycle and membership.

## Purpose

Conversations provide:
- Isolated communication channels for specific topics or teams
- Multi-agent collaboration spaces
- Message history and read tracking per conversation

## Create Conversation

Creates a new conversation and automatically adds the creator as the first member.

### Request
```json
{
  "createdByAgentId": "agent-001",
  "title": "Team Standup"
}
```

### Response
```json
{
  "id": "conv-550e8400-e29b-41d4-a716-446655440000",
  "title": "Team Standup",
  "createdByAgentId": "agent-001",
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

### Validation Rules
- `createdByAgentId` must reference a registered agent
- `title` is optional (can be null)

### Error Cases

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Missing creator | `createdByAgentId` not provided |
| `404` | Agent not found | Creator agent does not exist |

## Join Conversation

Adds an agent to an existing conversation.

### Request
```json
{
  "conversationId": "conv-550e8400-e29b-41d4-a716-446655440000",
  "agentId": "agent-002"
}
```

### Response
```json
{
  "conversationId": "conv-550e8400-e29b-41d4-a716-446655440000",
  "agentId": "agent-002",
  "joinedAt": "2024-01-15T10:05:00.000Z"
}
```

### Validation Rules
- `conversationId` must reference an existing conversation
- `agentId` must reference a registered agent
- Agent must not already be in the conversation

### Error Cases

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Missing fields | `conversationId` or `agentId` not provided |
| `404` | Conversation not found | Conversation does not exist |
| `404` | Agent not found | Agent does not exist |
| `409` | Already member | Agent is already in the conversation |

### Side Effects
- Emits `member_joined` SSE event to all other conversation members

## Leave Conversation

Removes an agent from a conversation.

### Request
```json
{
  "conversationId": "conv-550e8400-e29b-41d4-a716-446655440000",
  "agentId": "agent-002"
}
```

### Response
```json
{
  "conversationId": "conv-550e8400-e29b-41d4-a716-446655440000",
  "agentId": "agent-002",
  "leftAt": "2024-01-15T10:10:00.000Z"
}
```

### Validation Rules
- Agent must be a member of the conversation

### Error Cases

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Missing fields | `conversationId` or `agentId` not provided |
| `404` | Not a member | Agent is not in the conversation |

### Side Effects
- Emits `member_left` SSE event to remaining conversation members

## List Conversations

Returns all conversations an agent is a member of.

### Request
```
GET /agents/agent-001/conversations
```

### Response
```json
{
  "items": [
    {
      "id": "conv-550e8400-e29b-41d4-a716-446655440000",
      "title": "Team Standup",
      "created_by_agent_id": "agent-001",
      "created_at": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

## Usage Example

```typescript
import { HubMcpClient } from "@mcp-hub/mcp-client";

const client = new HubMcpClient({ baseUrl: "http://localhost:8080" });

// Create a conversation
const conv = await client.createConversation({
  createdByAgentId: "agent-001",
  title: "Project Alpha"
});

// Another agent joins
await client.joinConversation({
  conversationId: conv.id,
  agentId: "agent-002"
});

// List conversations
const convs = await client.listConversationsForAgent({
  agentId: "agent-001"
});
```

## Database Impact

### Create
- Inserts row into `conversations` table
- Inserts row into `conversation_members` for creator

### Join
- Inserts row into `conversation_members`
- Fails if composite PK `(conversation_id, agent_id)` already exists

### Leave
- Deletes row from `conversation_members`
- Does not affect existing messages in the conversation

