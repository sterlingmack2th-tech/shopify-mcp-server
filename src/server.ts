import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProductTools } from "./tools/products.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerThemeTools } from "./tools/themes.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "shopify-admin-mcp-server",
    version: "1.0.0",
  });

  registerProductTools(server);
  registerCollectionTools(server);
  registerThemeTools(server);

  return server;
}
