# Unread Messages and History

This feature provides two ways for agents to access messages: fetching only unread messages (for real-time workflows) or retrieving full conversation history (for context and review).

## Purpose

- **Unread Messages**: Efficient polling for new content without processing duplicates
- **History Retrieval**: Full access to conversation context with pagination
- **Read Tracking**: Coordinate message consumption among multiple agents

## Get Unread Messages

Returns messages that haven't been marked as read by the requesting agent.

### Request
```
GET /agents/agent-001/unread?conversationId=conv-001&limit=50
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | No | Filter to specific conversation |
| `limit` | number | No | Max results (default: 50, max: 200) |
| `cursor` | string | No | Pagination cursor `created_at|message_id` |

### Response
```json
{
  "items": [
    {
      "id": "msg-550e8400-e29b-41d4-a716-446655440000",
      "conversation_id": "conv-001",
      "sender_agent_id": "agent-002",
      "kind": "ask",
      "text": "What is the server status?",
      "created_at": "2024-01-15T10:30:00.000Z",
      "delivered_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "nextCursor": "2024-01-15T10:30:00.000Z|msg-550e8400-e29b-41d4-a716-446655440000"
}
```

### Notes
- Results are ordered by `created_at DESC` (newest first)
- The sender of a message never sees it as unread for themselves
- Messages remain in the unread list until marked as read

## Mark Messages as Read

Marks specific messages as read for an agent.

### Request
```json
{
  "agentId": "agent-001",
  "messageIds": [
    "msg-550e8400-e29b-41d4-a716-446655440000",
    "msg-660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

### Response
```json
{
  "updated": 2,
  "readAt": "2024-01-15T10:35:00.000Z"
}
```

### Validation Rules
- `agentId` must be provided
- `messageIds` must be a non-empty array
- Only updates receipts where `read_at IS NULL`

### Error Cases

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Missing fields | `agentId` or `messageIds` not provided |
| `400` | Empty array | `messageIds` array is empty |

### Side Effects
- Emits `message_read` SSE event to the marking agent

## Get Conversation History

Returns paginated message history for a conversation.

### Request
```
GET /conversations/conv-001/history?limit=50&cursor=2024-01-15T10:00:00.000Z|msg-xxx
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results (default: 50, max: 200) |
| `cursor` | string | No | Pagination cursor `created_at|message_id` |

### Response
```json
{
  "items": [
    {
      "id": "msg-550e8400-e29b-41d4-a716-446655440000",
      "conversation_id": "conv-001",
      "sender_agent_id": "agent-002",
      "kind": "command",
      "text": "Run backup",
      "command_name": "backup.run",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "msg-440e8400-e29b-41d4-a716-446655440999",
      "conversation_id": "conv-001",
      "sender_agent_id": "agent-001",
      "kind": "ask",
      "text": "Is the system healthy?",
      "created_at": "2024-01-15T10:25:00.000Z"
    }
  ],
  "nextCursor": "2024-01-15T10:25:00.000Z|msg-440e8400-e29b-41d4-a716-446655440999"
}
```

### Notes
- Results include ALL messages (both read and unread)
- Ordered by `created_at DESC` (newest first)
- Use `nextCursor` for pagination

## Pagination

Both unread and history endpoints use cursor-based pagination:

### Cursor Format
```
created_at|message_id
```

Example: `2024-01-15T10:30:00.000Z|msg-550e8400-e29b-41d4-a716-446655440000`

### Pagination Logic
1. Make initial request without cursor
2. If `nextCursor` is present in response, more results exist
3. Use `nextCursor` value in subsequent request
4. Stop when `nextCursor` is `null`

### Example Pagination Flow
```typescript
// Initial request
let response = await client.getUnreadMessages({ agentId: "agent-001" });
processMessages(response.items);

// Paginate through all results
while (response.nextCursor) {
  response = await client.getUnreadMessages({
    agentId: "agent-001",
    cursor: response.nextCursor
  });
  processMessages(response.items);
}
```

## Get Last Ask/Command

Retrieve the most recent ask or command in a conversation.

### Get Last Ask
```
GET /conversations/conv-001/last?kind=ask
```

### Get Last Command
```
GET /conversations/conv-001/last?kind=command
```

### Response
```json
{
  "item": {
    "id": "msg-550e8400-e29b-41d4-a716-446655440000",
    "conversation_id": "conv-001",
    "sender_agent_id": "agent-002",
    "kind": "command",
    "text": "Restart server",
    "command_name": "server.restart",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Empty Response
```json
{
  "item": null
}
```

## Usage Example

```typescript
import { HubMcpClient } from "@mcp-hub/mcp-client";

const client = new HubMcpClient({ baseUrl: "http://localhost:8080" });

// Poll for unread messages
const unread = await client.getUnreadMessages({
  agentId: "agent-001",
  conversationId: "conv-001"
});

// Process each message
for (const message of unread.items) {
  console.log(`New ${message.kind} from ${message.sender_agent_id}: ${message.text}`);
  
  // Mark as read
  await client.markMessagesRead({
    agentId: "agent-001",
    messageIds: [message.id]
  });
}

// Get full history for context
const history = await client.getConversationHistory({
  conversationId: "conv-001",
  limit: 100
});

// Find last command
const lastCommand = await client.getLastCommand({
  conversationId: "conv-001"
});
```

## Recommended Workflow

### Real-time Message Processing
1. Subscribe to SSE events for `message_created`
2. On event, call `get_unread_messages`
3. Process new messages
4. Mark processed messages as read

### Batch Processing
1. Periodically poll `get_unread_messages`
2. Process all returned messages
3. Mark batch as read
4. Handle pagination if `nextCursor` present

### Context Building
1. Use `get_conversation_history` to load recent context
2. Combine with `get_last_command` for command state
3. Cache results appropriately

