import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { createMcpServer } from "./server.js";
import { oauthRouter, requireShopifyMcpBearerAuth } from "./oauth/router.js";

const app = express();

// Railway terminates TLS and proxies over a single hop, so trust exactly one
// level of X-Forwarded-* headers. This gives the OAuth endpoints' rate
// limiting (express-rate-limit) the real client IP instead of Railway's edge.
app.set("trust proxy", 1);

app.use(express.json());

// OAuth 2.1 authorization server + protected resource metadata for this server.
// Mounted at the app root so /.well-known/*, /authorize, /token, and /register
// are all reachable, per the MCP authorization specification.
app.use(oauthRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/mcp", requireShopifyMcpBearerAuth, async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. This server operates in stateless mode.",
    },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. This server operates in stateless mode.",
    },
    id: null,
  });
});

app.listen(config.port, () => {
  console.log(`Shopify Admin MCP server listening on port ${config.port}`);
});
