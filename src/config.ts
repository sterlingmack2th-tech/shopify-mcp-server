function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }
  return value;
}

const mcpPublicUrlRaw = requireEnv("MCP_PUBLIC_URL");
let mcpPublicUrl: URL;
try {
  mcpPublicUrl = new URL(mcpPublicUrlRaw);
} catch {
  throw new Error(
    `MCP_PUBLIC_URL must be a valid absolute URL, e.g. "https://your-app.up.railway.app" (got "${mcpPublicUrlRaw}")`,
  );
}
if (mcpPublicUrl.protocol !== "https:" && mcpPublicUrl.hostname !== "localhost") {
  throw new Error("MCP_PUBLIC_URL must use https:// (except for localhost development)");
}
if (mcpPublicUrl.search || mcpPublicUrl.hash) {
  throw new Error("MCP_PUBLIC_URL must not include a query string or fragment");
}

const mcpOAuthSigningSecret = requireEnv("MCP_OAUTH_SIGNING_SECRET");
if (mcpOAuthSigningSecret.length < 32) {
  throw new Error(
    "MCP_OAUTH_SIGNING_SECRET must be at least 32 characters long. Generate one with: openssl rand -base64 32",
  );
}

const mcpAdminPassword = requireEnv("MCP_ADMIN_PASSWORD");
if (mcpAdminPassword.length < 12) {
  throw new Error("MCP_ADMIN_PASSWORD must be at least 12 characters long.");
}

const mcpResourceUrl = new URL("/mcp", mcpPublicUrl);

// Optional pre-registered client for Claude Desktop's connector UI, as an
// alternative to CIMD/DCR. Both or neither must be set.
const claudeOAuthClientId = optionalEnv("CLAUDE_OAUTH_CLIENT_ID");
const claudeOAuthClientSecret = optionalEnv("CLAUDE_OAUTH_CLIENT_SECRET");
if (Boolean(claudeOAuthClientId) !== Boolean(claudeOAuthClientSecret)) {
  throw new Error(
    "CLAUDE_OAUTH_CLIENT_ID and CLAUDE_OAUTH_CLIENT_SECRET must both be set together, or both left unset.",
  );
}
if (claudeOAuthClientSecret && claudeOAuthClientSecret.length < 16) {
  throw new Error("CLAUDE_OAUTH_CLIENT_SECRET must be at least 16 characters long.");
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  shopifyStore: requireEnv("SHOPIFY_STORE"),
  shopifyClientId: requireEnv("SHOPIFY_CLIENT_ID"),
  shopifyClientSecret: requireEnv("SHOPIFY_CLIENT_SECRET"),
  shopifyApiVersion: process.env.SHOPIFY_API_VERSION || "2026-07",

  /** Public base URL this server is reachable at, e.g. https://foo.up.railway.app */
  mcpPublicUrl,
  /** OAuth 2.1 issuer URL for this server's built-in authorization server. */
  mcpIssuerUrl: mcpPublicUrl,
  /** Canonical resource URI of the protected MCP endpoint (RFC 8707). */
  mcpResourceUrl,
  /** HMAC signing secret for access tokens. Never reused for Shopify auth. */
  mcpOAuthSigningSecret,
  /** Shared password used to gate the OAuth consent screen. Never reused for Shopify auth. */
  mcpAdminPassword,
  /** Pre-registered OAuth client for Claude Desktop, if configured. Never reused for Shopify auth. */
  claudeOAuthClientId,
  claudeOAuthClientSecret,
};
