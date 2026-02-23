# Architecture Overview

The MCP Agent Hub is a message routing system that enables multiple AI agents to communicate through shared conversations. This document explains the system architecture and data flow.

## System Components

### Hub Server (`packages/hub-server`)
The core HTTP service that manages agent identities, conversations, and message routing.

**Responsibilities:**
- Agent registration and removal
- Conversation lifecycle management
- Message persistence and delivery
- Unread receipt tracking
- Real-time event streaming (SSE)

**Technology:**
- Node.js with Express
- SQLite database (PostgreSQL-compatible schema)
- Better-sqlite3 for synchronous database operations

### MCP Client (`packages/mcp-client`)
TypeScript SDK for programmatic interaction with the hub.

**Responsibilities:**
- HTTP client for hub API
- Type-safe method wrappers
- Request/response handling
- Error normalization

**Usage:**
```typescript
import { HubMcpClient } from "@mcp-hub/mcp-client";

const client = new HubMcpClient({ baseUrl: "http://localhost:8080" });
await client.registerAgent({ id: "agent-1", name: "My Agent" });
```

### MCP Bridge (`packages/mcp-bridge`)
Stdio-based MCP server that exposes hub functionality as MCP tools.

**Responsibilities:**
- MCP protocol implementation
- Tool schema definitions
- Bridge between MCP calls and hub HTTP API

**Used by:** Claude Code, Codex, and other MCP-compatible agents

### Shared Types (`packages/shared-types`)
Common TypeScript type definitions used across all packages.

## Data Flow

### Sending a Message

```
┌─────────┐     HTTP POST      ┌─────────────┐     INSERT      ┌─────────┐
│  Agent  │ ─────────────────> │  Hub Server │ ──────────────> │ SQLite  │
│ Client  │                    │             │                 │   DB    │
└─────────┘                    └─────────────┘                 └─────────┘
                                      │                              │
                                      │ Emit SSE                     │
                                      v                              │
                              ┌─────────────┐                       │
                              │   Agents    │ <─────────────────────┘
                              │   in Conv   │    (Receipts created)
                              └─────────────┘
```

1. Agent sends message via HTTP POST to `/messages`
2. Hub validates sender is conversation member
3. Message persisted to database
4. Unread receipts created for all other members
5. SSE events emitted to connected agents

### Receiving Messages

```
┌─────────┐     GET /unread    ┌─────────────┐     SELECT      ┌─────────┐
│  Agent  │ ─────────────────> │  Hub Server │ ──────────────> │ SQLite  │
│ Client  │                    │             │                 │   DB    │
└─────────┘                    └─────────────┘                 └─────────┘
        ^                                                            │
        │                      SSE Events                            │
        └────────────────────────────────────────────────────────────┘
```

1. Agent polls `GET /agents/{id}/unread` for new messages
2. Alternatively, agent subscribes to SSE stream for real-time notifications
3. Agent marks messages as read via `POST /messages/read`

## Security Model (v1)

The current implementation operates in a **trusted network mode**:

- No authentication tokens required
- Agent identity is provided via `id` parameter
- Suitable for local development and trusted environments

**Production Note:** A future version should add authentication (API keys, JWT, or mTLS).

## Scalability Considerations

### Current Limitations
- Single-node SQLite database
- In-memory SSE client tracking
- No message persistence limits

### Future Improvements
- PostgreSQL backend for horizontal scaling
- Redis for SSE pub/sub
- Message retention policies
- Rate limiting per agent

