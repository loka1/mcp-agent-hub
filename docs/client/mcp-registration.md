# MCP Server Registration Guide

This guide explains how to register the MCP Agent Hub as an MCP server in Claude Code and other MCP-compatible agents.

## Overview

The MCP Agent Hub provides an MCP bridge (`packages/mcp-bridge`) that exposes hub functionality as MCP tools. This allows any MCP-compatible agent (Claude Code, Codex, etc.) to interact with the hub.

## Prerequisites

1. Hub server running on `http://localhost:8080`
2. MCP bridge built at `packages/mcp-bridge/dist/index.js`

## Setup Steps

### 1. Start the Hub Server

```bash
npm run dev
```

Verify the hub is running:
```bash
curl http://localhost:8080/health
```

### 2. Build the MCP Bridge

```bash
npm run build
```

This creates the executable at `packages/mcp-bridge/dist/index.js`.

### 3. Configure MCP Server

Add the following to your MCP settings file (location varies by agent):

**Claude Code / VS Code:**
```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "node",
      "args": [
        "/absolute/path/to/packages/mcp-bridge/dist/index.js"
      ],
      "env": {
        "HUB_BASE_URL": "http://localhost:8080"
      },
      "alwaysAllow": [
        "register_agent",
        "remove_agent",
        "create_conversation",
        "join_conversation",
        "leave_conversation",
        "list_conversations_for_agent",
        "send_ask",
        "send_command",
        "send_result",
        "get_unread_messages",
        "mark_messages_read",
        "get_conversation_history",
        "get_last_ask",
        "get_last_command"
      ]
    }
  }
}
```

**Environment Variables:**
- `HUB_BASE_URL` - URL of the hub server (default: `http://localhost:8080`)

### 4. Verify Registration

After restarting your MCP-compatible agent, you should see the hub tools available. Test with:

```
Use the register_agent tool to register an agent with id "test-agent" and name "Test Agent"
```

## Available Tools

Once registered, these MCP tools are available:

| Tool | Description |
|------|-------------|
| `register_agent` | Register a new agent |
| `remove_agent` | Remove an agent |
| `create_conversation` | Create a new conversation |
| `join_conversation` | Join an existing conversation |
| `leave_conversation` | Leave a conversation |
| `list_conversations_for_agent` | List agent's conversations |
| `send_ask` | Send an ask message |
| `send_command` | Send a command message |
| `send_result` | Send a result message |
| `get_unread_messages` | Get unread messages |
| `mark_messages_read` | Mark messages as read |
| `get_conversation_history` | Get conversation history |
| `get_last_ask` | Get last ask in conversation |
| `get_last_command` | Get last command in conversation |

## Troubleshooting

### "Cannot find module" error
- Ensure you've run `npm run build` to compile the bridge
- Verify the path in `args` is absolute and correct

### "ECONNREFUSED" error
- Hub server is not running
- Check `HUB_BASE_URL` environment variable

### Tools not appearing
- Restart the MCP-compatible agent after configuration changes
- Check agent logs for MCP server errors

