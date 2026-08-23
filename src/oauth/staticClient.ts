import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { config } from "../config.js";

/**
 * A single pre-registered confidential client for Claude Desktop's connector
 * UI (CLAUDE_OAUTH_CLIENT_ID / CLAUDE_OAUTH_CLIENT_SECRET), offered as an
 * alternative to CIMD/DCR. Undefined when those env vars aren't configured.
 *
 * This is looked up by exact client_id match only — it is never treated as a
 * Client ID Metadata Document URL, even if CLAUDE_OAUTH_CLIENT_ID happens to
 * look like one.
 */
export const staticClaudeClient: OAuthClientInformationFull | undefined =
  config.claudeOAuthClientId && config.claudeOAuthClientSecret
    ? {
        client_id: config.claudeOAuthClientId,
        client_secret: config.claudeOAuthClientSecret,
        client_name: "Claude",
        redirect_uris: [
          "https://claude.ai/api/mcp/auth_callback",
          "https://claude.com/api/mcp/auth_callback",
        ],
        token_endpoint_auth_method: "client_secret_post",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }
    : undefined;
