import { OAuthError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

/**
 * Diagnostic logging for the OAuth token/client-resolution code paths.
 *
 * The MCP SDK's tokenHandler catches every error internally and always
 * responds itself (it never calls next(err) or lets anything reach an
 * Express error-handling middleware), so a 500 there is otherwise invisible
 * server-side. These helpers log at the point an error is caught, then the
 * caller re-throws so response behavior is unchanged.
 *
 * Only non-secret, structural information is logged: error name/message/
 * stack, which OAuth stage/grant type failed, and boolean presence flags for
 * request parameters. Never log authorization codes, access/refresh tokens,
 * client secrets, passwords, or PKCE verifier values.
 */
export interface OAuthErrorLogContext {
  stage: string;
  grantType?: string;
  clientId?: string;
  params?: Record<string, boolean>;
}

export function logOAuthServerError(context: OAuthErrorLogContext, error: unknown): void {
  const err = error instanceof Error ? error : undefined;

  const entry = {
    scope: "oauth",
    stage: context.stage,
    grantType: context.grantType ?? null,
    clientId: context.clientId ?? null,
    params: context.params ?? {},
    isOAuthError: error instanceof OAuthError,
    errorName: err?.name ?? typeof error,
    errorMessage: err?.message ?? String(error),
    stack: err?.stack ?? null,
  };

  console.error(`[oauth] ${context.stage} threw: ${JSON.stringify(entry)}`);
}
