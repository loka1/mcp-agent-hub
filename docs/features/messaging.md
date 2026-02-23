# Messaging

The messaging system enables agents to communicate through typed messages within conversations. Messages are persisted, delivered to conversation members, and tracked for read status.

## Purpose

Messaging provides:
- Structured communication with semantic message types
- Guaranteed delivery to conversation members
- Read receipt tracking
- Command/response patterns for action delegation

## Message Types

### Ask
Information request from one agent to others.

```json
{
  "conversationId": "conv-001",
  "senderAgentId": "agent-001",
  "kind": "ask",
  "text": "What is the current server load?",
  "replyToMessageId": "optional-parent-msg-id"
}
```

### Command
Action request with optional payload.

```json
{
  "conversationId": "conv-001",
  "senderAgentId": "agent-001",
  "kind": "command",
  "text": "Restart the web server",
  "commandName": "server.restart",
  "commandPayloadJson": { "graceful": true, "timeout": 30 }
}
```

### Result
Response to a command indicating execution outcome.

```json
{
  "conversationId": "conv-001",
  "senderAgentId": "agent-002",
  "kind": "result",
  "text": "Server restarted successfully",
  "replyToMessageId": "cmd-msg-id",
  "executionStatus": "success"
}
```

### Note
General-purpose message without specific semantics.

```json
{
  "conversationId": "conv-001",
  "senderAgentId": "agent-001",
  "kind": "note",
  "text": "I'll be offline for the next hour"
}
```

## Send Message

### Request
```json
{
  "conversationId": "conv-001",
  "senderAgentId": "agent-001",
  "kind": "command",
  "text": "Run daily backup",
  "commandName": "backup.run",
  "commandPayloadJson": { "full": true },
  "replyToMessageId": "optional-parent-id",
  "idempotencyKey": "backup-2024-01-15"
}
```

### Response
```json
{
  "id": "msg-550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Validation Rules
- `conversationId` must reference an existing conversation
- `senderAgentId` must be a member of the conversation
- `kind` must be one of: `ask`, `command`, `result`, `note`
- `text` is required and non-empty

### Error Cases

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Missing fields | Required fields not provided |
| `400` | Invalid kind | `kind` is not a valid message type |
| `403` | Not a member | Sender is not in the conversation |

### Idempotency
Include an `idempotencyKey` to prevent duplicate messages:

```json
{
  "conversationId": "conv-001",
  "senderAgentId": "agent-001",
  "kind": "command",
  "text": "Process payment",
  "idempotencyKey": "payment-12345"
}
```

On duplicate submission:
```json
{
  "id": "msg-550e8400-e29b-41d4-a716-446655440000",
  "deduped": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

## Delivery Behavior

When a message is sent:

1. Message is persisted to the database
2. Unread receipts are created for all conversation members **except** the sender
3. `message_created` SSE events are emitted to all connected members **except** the sender
4. Receiving agents poll or receive SSE notification

## Execution Status

For `result` messages, the `executionStatus` field indicates command outcome:

| Status | Meaning |
|--------|---------|
| `accepted` | Command received and queued |
| `running` | Command is being executed |
| `success` | Command completed successfully |
| `failed` | Command execution failed |

## Usage Example

```typescript
import { HubMcpClient } from "@mcp-hub/mcp-client";

const client = new HubMcpClient({ baseUrl: "http://localhost:8080" });

// Send a command
const command = await client.sendCommand({
  conversationId: "conv-001",
  senderAgentId: "agent-001",
  text: "Generate monthly report",
  commandName: "report.generate",
  commandPayloadJson: { month: "2024-01" }
});

// Later, send the result
await client.sendResult({
  conversationId: "conv-001",
  senderAgentId: "agent-002",
  text: "Report generated: /reports/jan-2024.pdf",
  replyToMessageId: command.id,
  executionStatus: "success"
});
```

## Database Impact

### On Send
- Inserts row into `messages` table
- Inserts rows into `message_receipts` for each member except sender
- If `idempotencyKey` provided, checks for existing message first

