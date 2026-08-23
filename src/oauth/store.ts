import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

export interface StoredAuthorizationCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource?: string;
  scopes: string[];
  expiresAt: number;
}

export interface StoredRefreshToken {
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
}

const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const REVOKED_JTI_RETENTION_MS = 60 * 60 * 1000;
const CIMD_CACHE_TTL_MS = 5 * 60 * 1000;

export const authorizationCodes = new Map<string, StoredAuthorizationCode>();
export const refreshTokens = new Map<string, StoredRefreshToken>();
export const revokedTokenIds = new Map<string, number>();
export const dynamicallyRegisteredClients = new Map<string, OAuthClientInformationFull>();
export const clientIdMetadataDocumentCache = new Map<
  string,
  { client: OAuthClientInformationFull; expiresAt: number }
>();

export function newAuthorizationCodeExpiry(): number {
  return Date.now() + AUTHORIZATION_CODE_TTL_MS;
}

export function newRefreshTokenExpiry(): number {
  return Date.now() + REFRESH_TOKEN_TTL_MS;
}

export function newCimdCacheExpiry(): number {
  return Date.now() + CIMD_CACHE_TTL_MS;
}

function sweepExpired(): void {
  const now = Date.now();
  for (const [code, entry] of authorizationCodes) {
    if (entry.expiresAt < now) authorizationCodes.delete(code);
  }
  for (const [token, entry] of refreshTokens) {
    if (entry.expiresAt < now) refreshTokens.delete(token);
  }
  for (const [jti, expiresAt] of revokedTokenIds) {
    if (expiresAt < now) revokedTokenIds.delete(jti);
  }
  for (const [url, entry] of clientIdMetadataDocumentCache) {
    if (entry.expiresAt < now) clientIdMetadataDocumentCache.delete(url);
  }
}

const sweepInterval = setInterval(sweepExpired, 60 * 1000);
sweepInterval.unref();

export function markTokenRevoked(jti: string): void {
  revokedTokenIds.set(jti, Date.now() + REVOKED_JTI_RETENTION_MS);
}

export function isTokenRevoked(jti: string): boolean {
  return revokedTokenIds.has(jti);
}
