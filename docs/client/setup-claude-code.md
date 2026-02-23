# Claude Code Setup (MCP Client)

Use `@mcp-hub/mcp-client` in your Claude Code MCP integration layer.

Instantiate client:

```ts
import { HubMcpClient } from "@mcp-hub/mcp-client";

const hub = new HubMcpClient({ baseUrl: "http://localhost:8080" });
```

Then map MCP tools to methods:

- `register_agent` -> `hub.registerAgent`
- `remove_agent` -> `hub.removeAgent`
- `send_ask` -> `hub.sendAsk`
- `send_command` -> `hub.sendCommand`
- `send_result` -> `hub.sendResult`
- `get_unread_messages` -> `hub.getUnreadMessages`

