# Codex Setup (MCP Client)

Codex-compatible MCP runtimes can use `@mcp-hub/mcp-client` as transport adapter.

Example:

```ts
import { HubMcpClient } from "@mcp-hub/mcp-client";

const client = new HubMcpClient({ baseUrl: process.env.HUB_URL ?? "http://localhost:8080" });
```

Map your runtime tool handlers to methods on the client instance.

