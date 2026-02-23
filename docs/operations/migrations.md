# Database Migrations

The MCP Agent Hub uses a migration system to manage database schema changes. This ensures consistent database state across deployments and enables future upgrades.

## Migration System

### Migration Runner

Location: [`packages/hub-server/src/db/migrate.ts`](packages/hub-server/src/db/migrate.ts)

The runner:
1. Scans the `migrations` directory for `.sql` files
2. Sorts files alphabetically by filename
3. Checks `schema_migrations` table for already-applied migrations
4. Executes new migrations in a transaction
5. Records successful migrations

### Migration Table

```sql
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

## Current Migrations

### 0001_init.sql

Creates the v1 schema with all core tables and indexes.

**Tables Created:**
- `agents` - Agent identities
- `conversations` - Conversation rooms
- `conversation_members` - Many-to-many relationship
- `messages` - All messages
- `message_receipts` - Read status tracking
- `schema_migrations` - Migration tracking

**Indexes Created:**
- `idx_messages_idempotency` - Unique constraint for idempotency
- `idx_messages_conversation_created` - Query optimization
- `idx_receipts_agent_unread` - Unread queries

## Creating New Migrations

1. Create a new `.sql` file in `packages/hub-server/src/db/migrations/`
2. Use sequential naming: `0002_add_feature.sql`
3. Write PostgreSQL-compatible SQL
4. Test migration on a fresh database

### Migration Template

```sql
-- Migration: 0002_description.sql
-- Purpose: Brief description of changes

-- Add new table
CREATE TABLE IF NOT EXISTS new_table (
  id TEXT PRIMARY KEY,
  -- columns
  created_at TEXT NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_new_table_column
ON new_table (column);
```

## Running Migrations

Migrations run automatically when the hub server starts:

```typescript
// In app.ts
import { runMigrations } from "./db/migrate.js";

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
runMigrations(db);
```

## PostgreSQL Migration Path

The schema is designed for PostgreSQL compatibility:

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Foreign keys | Supported | Supported |
| Partial indexes | `WHERE` clause | `WHERE` clause |
| Text timestamps | ISO 8601 strings | `TIMESTAMPTZ` |
| UUIDs | Text strings | `UUID` type |

### Migration Considerations

When migrating to PostgreSQL:

1. **Timestamps**: Convert ISO 8601 strings to `TIMESTAMPTZ`
2. **Primary keys**: Text UUIDs work in both databases
3. **Indexes**: Recreate with PostgreSQL syntax
4. **Constraints**: Review and adapt CHECK constraints

### Example PostgreSQL Schema

```sql
-- PostgreSQL version of messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('ask', 'command', 'result', 'note')),
  text TEXT NOT NULL,
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  command_name VARCHAR(255),
  command_payload_json JSONB,
  execution_status VARCHAR(20) CHECK (execution_status IN ('accepted', 'running', 'success', 'failed')),
  idempotency_key VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_idempotency UNIQUE (conversation_id, sender_agent_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
);
```

## Backup Before Migration

Always backup the database before applying migrations:

```bash
# SQLite backup
cp hub.sqlite hub.sqlite.backup.$(date +%Y%m%d_%H%M%S)

# Or using SQLite CLI
sqlite3 hub.sqlite ".backup backup.db"
```

## Troubleshooting

### Migration Fails
1. Check application logs for SQL errors
2. Verify foreign key constraints are satisfied
3. Check for duplicate data violating unique constraints

### Rollback
SQLite doesn't support transaction rollback for DDL. To rollback:
1. Restore from backup
2. Fix migration script
3. Restart application

