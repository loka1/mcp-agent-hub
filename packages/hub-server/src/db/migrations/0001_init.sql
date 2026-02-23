PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_by_agent_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (created_by_agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, agent_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_agent_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ask', 'command', 'result', 'note')),
  text TEXT NOT NULL,
  reply_to_message_id TEXT,
  command_name TEXT,
  command_payload_json TEXT,
  execution_status TEXT CHECK (execution_status IN ('accepted', 'running', 'success', 'failed')),
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_agent_id) REFERENCES agents(id) ON DELETE RESTRICT,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency
ON messages (conversation_id, sender_agent_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_receipts (
  message_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  delivered_at TEXT NOT NULL,
  read_at TEXT,
  PRIMARY KEY (message_id, agent_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages (conversation_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_receipts_agent_unread
ON message_receipts (agent_id, read_at, delivered_at);

