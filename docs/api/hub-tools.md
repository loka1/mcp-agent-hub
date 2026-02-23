# Hub HTTP API Reference

This document describes the HTTP endpoints exposed by the MCP Hub server.

Base URL: `http://localhost:8080` (default)

## Health Check

### GET /health
Check if the hub server is running.

**Response:**
```json
{
  "ok": true,
  "service": "hub-server",
  "dbPath": "./hub.sqlite"
}
```

## Agent Management

### POST /agents/register
Register a new agent in the hub.

**Request Body:**
```json
{
  "id": "agent-001",
  "name": "My Agent"
}
```

**Response (201 Created):**
```json
{
  "id": "agent-001",
  "name": "My Agent"
}
```

**Error Cases:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Agent ID or name already exists

### POST /agents/remove
Remove an agent from the hub.

**Request Body:**
```json
{
  "id": "agent-001"
}
```

**Response (200 OK):**
```json
{
  "removed": "agent-001"
}
```

**Error Cases:**
- `400 Bad Request` - Missing agent ID
- `404 Not Found` - Agent not found

## Conversation Management

### POST /conversations
Create a new conversation.

**Request Body:**
```json
{
  "createdByAgentId": "agent-001",
  "title": "Team Chat"
}
```

**Response (201 Created):**
```json
{
  "id": "conv-uuid-here",
  "title": "Team Chat",
  "createdByAgentId": "agent-001",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Cases:**
- `400 Bad Request` - Missing creator agent ID
- `404 Not Found` - Creator agent not found

### POST /conversations/:conversationId/join
Join an existing conversation.

**Request Body:**
```json
{
  "agentId": "agent-002"
}
```

**Response (201 Created):**
```json
{
  "conversationId": "conv-uuid-here",
  "agentId": "agent-002",
  "joinedAt": "2024-01-15T10:35:00.000Z"
}
```

**Error Cases:**
- `400 Bad Request` - Missing agent ID
- `404 Not Found` - Conversation or agent not found
- `409 Conflict` - Agent already in conversation

### POST /conversations/:conversationId/leave
Leave a conversation.

**Request Body:**
```json
{
  "agentId": "agent-002"
}
```

**Response (200 OK):**
```json
{
  "conversationId": "conv-uuid-here",
  "agentId": "agent-002",
  "leftAt": "2024-01-15T10:40:00.000Z"
}
```

**Error Cases:**
- `400 Bad Request` - Missing agent ID
- `404 Not Found` - Agent not in conversation

### GET /agents/:agentId/conversations
List all conversations for an agent.

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "conv-uuid-here",
      "title": "Team Chat",
      "created_by_agent_id": "agent-001",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## Messaging

### POST /messages
Send a message to a conversation.

**Request Body:**
```json
{
  "conversationId": "conv-uuid-here",
  "senderAgentId": "agent-001",
  "kind": "ask",
  "text": "What is the weather today?",
  "replyToMessageId": "msg-uuid-optional",
  "idempotencyKey": "unique-key-optional"
}
```

**Message Kinds:** `ask`, `command`, `result`, `note`

**Command Message Example:**
```json
{
  "conversationId": "conv-uuid-here",
  "senderAgentId": "agent-001",
  "kind": "command",
  "text": "Run daily backup",
  "commandName": "backup.run",
  "commandPayloadJson": { "full": true },
  "idempotencyKey": "backup-2024-01-15"
}
```

**Response (201 Created):**
```json
{
  "id": "msg-uuid-here",
  "createdAt": "2024-01-15T10:45:00.000Z"
}
```

**Idempotency Response (200 OK):**
```json
{
  "id": "msg-uuid-here",
  "deduped": true,
  "createdAt": "2024-01-15T10:45:00.000Z"
}
```

**Error Cases:**
- `400 Bad Request` - Missing required fields or invalid kind
- `403 Forbidden` - Sender not in conversation

### GET /agents/:agentId/unread
Get unread messages for an agent.

**Query Parameters:**
- `conversationId` (optional) - Filter by conversation
- `limit` (optional) - Max messages to return (default: 50, max: 200)
- `cursor` (optional) - Pagination cursor `created_at|message_id`

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "msg-uuid-here",
      "conversation_id": "conv-uuid-here",
      "sender_agent_id": "agent-002",
      "kind": "ask",
      "text": "What is the weather today?",
      "created_at": "2024-01-15T10:45:00.000Z",
      "delivered_at": "2024-01-15T10:45:00.000Z"
    }
  ],
  "nextCursor": "2024-01-15T10:45:00.000Z|msg-uuid-here"
}
```

### POST /messages/read
Mark messages as read.

**Request Body:**
```json
{
  "agentId": "agent-001",
  "messageIds": ["msg-uuid-1", "msg-uuid-2"]
}
```

**Response (200 OK):**
```json
{
  "updated": 2,
  "readAt": "2024-01-15T10:50:00.000Z"
}
```

**Error Cases:**
- `400 Bad Request` - Missing agent ID or empty messageIds array

### GET /conversations/:conversationId/history
Get conversation history with pagination.

**Query Parameters:**
- `limit` (optional) - Max messages to return (default: 50, max: 200)
- `cursor` (optional) - Pagination cursor `created_at|message_id`

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "msg-uuid-here",
      "conversation_id": "conv-uuid-here",
      "sender_agent_id": "agent-001",
      "kind": "ask",
      "text": "Hello everyone",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "nextCursor": "2024-01-15T10:30:00.000Z|msg-uuid-here"
}
```

### GET /conversations/:conversationId/last
Get the last ask or command in a conversation.

**Query Parameters:**
- `kind` (required) - Either `ask` or `command`

**Response (200 OK):**
```json
{
  "item": {
    "id": "msg-uuid-here",
    "conversation_id": "conv-uuid-here",
    "sender_agent_id": "agent-001",
    "kind": "command",
    "text": "Run daily backup",
    "command_name": "backup.run",
    "created_at": "2024-01-15T10:45:00.000Z"
  }
}
```

**Empty Response:**
```json
{
  "item": null
}
```

## Events (SSE)

### GET /events?agentId=:agentId
Subscribe to real-time events for an agent.

See [events.md](events.md) for detailed documentation.

