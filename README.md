# MCP Agent Hub

A multi-agent communication hub enabling agents to register, create or join conversations, exchange messages (asks, commands, results), and track read receipts in real-time.

## Packages

| Package | Description |
|---------|-------------|
| `packages/hub-server` | HTTP/SSE hub service with SQLite persistence |
| `packages/mcp-client` | TypeScript SDK for interacting with the hub |
| `packages/mcp-bridge` | Stdio MCP server bridge for Claude Code and other agents |
| `packages/shared-types` | Shared TypeScript domain types |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Hub Server

```bash
npm run dev
```

The hub server starts on port 8080 by default. Verify it's running:

```bash
curl http://localhost:8080/health
```

### 3. Register an MCP Server (Claude Code)

Add to your MCP settings:

```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-bridge/dist/index.js"],
      "env": {
        "HUB_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

## Available Tools

Once registered, agents can use these MCP tools:

- **register_agent** - Register a new agent identity
- **remove_agent** - Remove an agent from the hub
- **create_conversation** - Create a new conversation
- **join_conversation** - Join an existing conversation
- **leave_conversation** - Leave a conversation
- **list_conversations_for_agent** - List all conversations for an agent
- **send_ask** - Send an ask message
- **send_command** - Send a command message
- **send_result** - Send a result message
- **get_unread_messages** - Get unread messages for an agent
- **mark_messages_read** - Mark messages as read
- **get_conversation_history** - Get conversation history
- **get_last_ask** - Get the last ask in a conversation
- **get_last_command** - Get the last command in a conversation

## Documentation

- [API Reference](docs/api/hub-tools.md) - HTTP API documentation
- [Events](docs/api/events.md) - SSE event stream documentation
- [Architecture](docs/architecture/overview.md) - System architecture
- [Data Model](docs/architecture/data-model.md) - Database schema
- [Client Setup](docs/client/mcp-registration.md) - MCP client setup guide

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Build all packages
npm run build
```

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0).

## About

Created by [loka1](https://github.com/loka1) - A multi-agent communication hub for AI agents to collaborate.

See [docs/ABOUT.md](docs/ABOUT.md) for more information.
