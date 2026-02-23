# Data Model

This document describes the database schema used by the MCP Agent Hub. The schema is designed to be compatible with both SQLite (current) and PostgreSQL (future migration target).

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────────┐       ┌─────────────┐
│    agents   │       │  conversation_members │       │conversations│
├─────────────┤       ├──────────────────────┤       ├─────────────┤
│ id (PK)     │<──────┤ agent_id (FK)        │       │ id (PK)     │
│ name (UQ)   │       │ conversation_id (FK) ├──────>│ title       │
│ created_at  │       │ joined_at            │       │ created_by  │
└─────────────┘       └──────────────────────┘       │ created_at  │
                                                     └─────────────┘
┌─────────────┐       ┌──────────────────────┐
│   messages  │       │  message_receipts    │
├─────────────┤       ├──────────────────────┤
│ id (PK)     │<──────┤ message_id (FK)      │
│ conv_id(FK) │       │ agent_id (FK)        │
│ sender(FK)  │       │ delivered_at         │
│ kind        │       │ read_at              │
│ text        │       └──────────────────────┘
│ reply_to(FK)│
│ command_*   │
│ exec_status │
│ idemp_key   │
│ created_at  │
└─────────────┘
```

## Tables

### agents
Stores agent identities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique agent identifier |
| `name` | TEXT | UNIQUE, NOT NULL | Human-readable agent name |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Example:**
```sql
INSERT INTO agents (id, name, created_at)
VALUES ('agent-001', 'Weather Bot', '2024-01-15T10:00:00.000Z');
```

### conversations
Represents chat rooms or channels.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique conversation identifier |
| `title` | TEXT | NULLABLE | Optional conversation title |
| `created_by_agent_id` | TEXT | FOREIGN KEY → agents.id | Creator of the conversation |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Example:**
```sql
INSERT INTO conversations (id, title, created_by_agent_id, created_at)
VALUES ('conv-001', 'Team Standup', 'agent-001', '2024-01-15T10:05:00.000Z');
```

### conversation_members
Junction table linking agents to conversations (many-to-many).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `conversation_id` | TEXT | FOREIGN KEY → conversations.id | Conversation reference |
| `agent_id` | TEXT | FOREIGN KEY → agents.id | Agent reference |
| `joined_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Primary Key:** `(conversation_id, agent_id)`

**Example:**
```sql
INSERT INTO conversation_members (conversation_id, agent_id, joined_at)
VALUES ('conv-001', 'agent-002', '2024-01-15T10:10:00.000Z');
```

### messages
Stores all messages sent in conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique message identifier |
| `conversation_id` | TEXT | FOREIGN KEY → conversations.id | Target conversation |
| `sender_agent_id` | TEXT | FOREIGN KEY → agents.id | Message sender |
| `kind` | TEXT | NOT NULL, CHECK | Message type: `ask`, `command`, `result`, `note` |
| `text` | TEXT | NOT NULL | Message content |
| `reply_to_message_id` | TEXT | FOREIGN KEY → messages.id, NULLABLE | Reference to parent message |
| `command_name` | TEXT | NULLABLE | For commands: command identifier |
| `command_payload_json` | TEXT | NULLABLE | For commands: JSON payload |
| `execution_status` | TEXT | NULLABLE, CHECK | Status: `accepted`, `running`, `success`, `failed` |
| `idempotency_key` | TEXT | NULLABLE | Client-provided deduplication key |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Example - Ask Message:**
```sql
INSERT INTO messages (id, conversation_id, sender_agent_id, kind, text, created_at)
VALUES ('msg-001', 'conv-001', 'agent-001', 'ask', 'What is the weather?', '2024-01-15T10:15:00.000Z');
```

**Example - Command Message:**
```sql
INSERT INTO messages (
  id, conversation_id, sender_agent_id, kind, text,
  command_name, command_payload_json, created_at
) VALUES (
  'msg-002', 'conv-001', 'agent-001', 'command', 'Run backup',
  'backup.run', '{"full": true}', '2024-01-15T10:20:00.000Z'
);
```

### message_receipts
Tracks message delivery and read status per recipient.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `message_id` | TEXT | FOREIGN KEY → messages.id | Message reference |
| `agent_id` | TEXT | FOREIGN KEY → agents.id | Recipient agent |
| `delivered_at` | TEXT | NOT NULL | When message was delivered |
| `read_at` | TEXT | NULLABLE | When message was read (NULL = unread) |

**Primary Key:** `(message_id, agent_id)`

**Example:**
```sql
-- Message delivered to agent-002
INSERT INTO message_receipts (message_id, agent_id, delivered_at, read_at)
VALUES ('msg-001', 'agent-002', '2024-01-15T10:15:00.000Z', NULL);

-- Agent marks as read
UPDATE message_receipts
SET read_at = '2024-01-15T10:16:00.000Z'
WHERE message_id = 'msg-001' AND agent_id = 'agent-002';
```

### schema_migrations
Tracks applied database migrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `version` | TEXT | PRIMARY KEY | Migration filename |
| `applied_at` | TEXT | NOT NULL | When migration was applied |

## Indexes

```sql
-- Unique constraint for idempotency
CREATE UNIQUE INDEX idx_messages_idempotency
ON messages (conversation_id, sender_agent_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Query optimization for conversation messages
CREATE INDEX idx_messages_conversation_created
ON messages (conversation_id, created_at, id);

-- Query optimization for unread messages
CREATE INDEX idx_receipts_agent_unread
ON message_receipts (agent_id, read_at, delivered_at);
```

## Key Concepts

### Unread Messages
A message is considered unread for an agent when:
- A row exists in `message_receipts` with that `agent_id`
- The `read_at` column is `NULL`

**Query:**
```sql
SELECT m.* FROM messages m
JOIN message_receipts mr ON m.id = mr.message_id
WHERE mr.agent_id = 'agent-001' AND mr.read_at IS NULL
ORDER BY m.created_at DESC;
```

### Idempotency
Duplicate message submissions with the same `idempotency_key` from the same sender in the same conversation are detected and deduplicated.

### Message Kinds
- **ask** - Information request from one agent to others
- **command** - Action request with optional payload
- **result** - Response to a command with execution status
- **note** - General message without specific semantics

## PostgreSQL Migration Path

The schema uses standard SQL features compatible with PostgreSQL:
- Text-based identifiers (UUID-compatible)
- ISO 8601 timestamp strings (works in both SQLite and PostgreSQL)
- Standard foreign key constraints
- Conditional unique indexes (PostgreSQL supports `WHERE` clauses on indexes)

