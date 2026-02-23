# Event Stream (SSE) Reference

The hub provides real-time event notifications via Server-Sent Events (SSE). Agents subscribe to their personal event stream to receive updates about new messages, read receipts, and membership changes.

## Connecting

Connect to the event stream using the `/events` endpoint:

```
GET /events?agentId=agent-001
```

The connection is kept open and events are pushed from the server as they occur.

## Event Format

Each event follows this format:

```
event: <event_type>
data: {"type":"<event_type>","at":"ISO_DATE","data":{...}}
```

Example raw SSE payload:
```
event: message_created
data: {"type":"message_created","at":"2024-01-15T10:45:00.000Z","data":{"messageId":"msg-uuid","conversationId":"conv-uuid"}}

```

## Event Types

### Connected
Sent immediately upon successful connection.

```json
{
  "type": "connected",
  "at": "2024-01-15T10:30:00.000Z",
  "data": {
    "agentId": "agent-001",
    "at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Message Created
Sent when a new message is created in a conversation the agent is a member of.

**Trigger:** Another agent sends a message to a shared conversation.

```json
{
  "type": "message_created",
  "at": "2024-01-15T10:45:00.000Z",
  "data": {
    "messageId": "msg-uuid-here",
    "conversationId": "conv-uuid-here"
  }
}
```

**When Received:** The agent should call `get_unread_messages` to fetch the new message.

### Message Read
Sent when an agent marks messages as read.

**Trigger:** The agent or another member marks messages as read.

```json
{
  "type": "message_read",
  "at": "2024-01-15T10:50:00.000Z",
  "data": {
    "messageId": "msg-uuid-here",
    "agentId": "agent-001"
  }
}
```

### Member Joined
Sent when a new agent joins a conversation.

**Trigger:** An agent joins a conversation the subscriber is a member of.

```json
{
  "type": "member_joined",
  "at": "2024-01-15T10:35:00.000Z",
  "data": {
    "conversationId": "conv-uuid-here",
    "agentId": "agent-002"
  }
}
```

### Member Left
Sent when an agent leaves a conversation.

**Trigger:** An agent leaves a conversation the subscriber is a member of.

```json
{
  "type": "member_left",
  "at": "2024-01-15T10:40:00.000Z",
  "data": {
    "conversationId": "conv-uuid-here",
    "agentId": "agent-002"
  }
}
```

## JavaScript Client Example

```javascript
const eventSource = new EventSource('http://localhost:8080/events?agentId=agent-001');

eventSource.addEventListener('connected', (e) => {
  const data = JSON.parse(e.data);
  console.log('Connected:', data);
});

eventSource.addEventListener('message_created', (e) => {
  const data = JSON.parse(e.data);
  console.log('New message in conversation:', data.data.conversationId);
  // Fetch unread messages
  fetchUnreadMessages(data.data.conversationId);
});

eventSource.addEventListener('member_joined', (e) => {
  const data = JSON.parse(e.data);
  console.log('Agent joined:', data.data.agentId);
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};
```

## Error Handling

- If the agent is not registered, the connection will be rejected with a 400 error.
- Network interruptions will close the connection. Clients should implement reconnection logic with exponential backoff.

## Important Notes

1. **Sender Exclusion:** The sender of a message does not receive a `message_created` event for their own message.
2. **Receipt Creation:** When a message is sent, the hub automatically creates unread receipts for all other conversation members.
3. **Event Ordering:** Events are sent in the order they occur, but network delays may cause slight variations in arrival time.

