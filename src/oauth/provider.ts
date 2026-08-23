import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  InvalidGrantError,
  InvalidTargetError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { config } from "../config.js";
import { clientsStore } from "./clientsStore.js";
import { renderConsentPage } from "./consentPage.js";
import { logOAuthServerError } from "./logging.js";
import {
  authorizationCodes,
  markTokenRevoked,
  newAuthorizationCodeExpiry,
  newRefreshTokenExpiry,
  refreshTokens,
} from "./store.js";
import { ACCESS_TOKEN_TTL, AccessTokenError, signAccessToken, verifyAccessTokenJwt } from "./tokens.js";

export const DEFAULT_SCOPES = ["shopify"];

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function assertCanonicalResource(resource: URL | undefined): void {
  if (resource && resource.href !== config.mcpResourceUrl.href) {
    throw new InvalidTargetError(
      `This authorization server only issues tokens for resource ${config.mcpResourceUrl.href}`,
    );
  }
}

export const shopifyMcpOAuthProvider: OAuthServerProvider = {
  get clientsStore(): OAuthRegisteredClientsStore {
    return clientsStore;
  },

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    assertCanonicalResource(params.resource);

    const scopes = params.scopes && params.scopes.length > 0 ? params.scopes : DEFAULT_SCOPES;
    const req = res.req;
    const submittedPassword = req.method === "POST" ? req.body?.password : undefined;

    const pageParams = {
      clientName: client.client_name || client.client_id,
      redirectUri: params.redirectUri,
      clientId: client.client_id,
      responseType: "code" as const,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: "S256" as const,
      state: params.state,
      scope: scopes.join(" "),
      resource: params.resource?.href,
    };

    if (typeof submittedPassword !== "string") {
      res.status(200).type("html").send(renderConsentPage(pageParams));
      return;
    }

    if (!safeCompare(submittedPassword, config.mcpAdminPassword)) {
      res
        .status(200)
        .type("html")
        .send(renderConsentPage({ ...pageParams, error: "Incorrect password. Try again." }));
      return;
    }

    const code = randomToken();
    authorizationCodes.set(code, {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      resource: params.resource?.href,
      scopes,
      expiresAt: newAuthorizationCodeExpiry(),
    });

    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state) redirectUrl.searchParams.set("state", params.state);
    res.redirect(302, redirectUrl.href);
  },

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    try {
      const entry = authorizationCodes.get(authorizationCode);
      if (!entry || entry.clientId !== client.client_id) {
        throw new InvalidGrantError("Invalid authorization code");
      }
      if (entry.expiresAt < Date.now()) {
        authorizationCodes.delete(authorizationCode);
        throw new InvalidGrantError("Authorization code has expired");
      }
      return entry.codeChallenge;
    } catch (error) {
      logOAuthServerError(
        {
          stage: "challengeForAuthorizationCode",
          grantType: "authorization_code",
          clientId: client.client_id,
          params: { hasAuthorizationCode: Boolean(authorizationCode) },
        },
        error,
      );
      throw error;
    }
  },

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    try {
      const entry = authorizationCodes.get(authorizationCode);
      if (!entry || entry.clientId !== client.client_id) {
        throw new InvalidGrantError("Invalid authorization code");
      }
      authorizationCodes.delete(authorizationCode);

      if (entry.expiresAt < Date.now()) {
        throw new InvalidGrantError("Authorization code has expired");
      }
      if (redirectUri !== undefined && redirectUri !== entry.redirectUri) {
        throw new InvalidGrantError("redirect_uri does not match the authorization request");
      }
      assertCanonicalResource(resource);
      if (entry.resource !== undefined && resource !== undefined && entry.resource !== resource.href) {
        throw new InvalidTargetError("resource does not match the authorization request");
      }

      const { token, expiresAt } = await signAccessToken({
        clientId: client.client_id,
        scopes: entry.scopes,
        resource: config.mcpResourceUrl.href,
      });
      const refreshToken = randomToken();
      refreshTokens.set(refreshToken, {
        clientId: client.client_id,
        scopes: entry.scopes,
        resource: entry.resource,
        expiresAt: newRefreshTokenExpiry(),
      });

      return {
        access_token: token,
        token_type: "Bearer",
        expires_in: expiresAt - Math.floor(Date.now() / 1000),
        scope: entry.scopes.join(" "),
        refresh_token: refreshToken,
      };
    } catch (error) {
      logOAuthServerError(
        {
          stage: "exchangeAuthorizationCode",
          grantType: "authorization_code",
          clientId: client.client_id,
          params: {
            hasAuthorizationCode: Boolean(authorizationCode),
            hasCodeVerifier: Boolean(_codeVerifier),
            hasRedirectUri: Boolean(redirectUri),
            hasResource: Boolean(resource),
          },
        },
        error,
      );
      throw error;
    }
  },

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    try {
      const entry = refreshTokens.get(refreshToken);
      if (!entry || entry.clientId !== client.client_id) {
        throw new InvalidGrantError("Invalid refresh token");
      }
      refreshTokens.delete(refreshToken);

      if (entry.expiresAt < Date.now()) {
        throw new InvalidGrantError("Refresh token has expired");
      }
      assertCanonicalResource(resource);

      const grantedScopes =
        scopes && scopes.length > 0 ? scopes.filter((scope) => entry.scopes.includes(scope)) : entry.scopes;
      if (grantedScopes.length === 0) {
        throw new InvalidGrantError("Requested scope exceeds the scope originally granted");
      }

      const { token, expiresAt } = await signAccessToken({
        clientId: client.client_id,
        scopes: grantedScopes,
        resource: config.mcpResourceUrl.href,
      });
      const newRefresh = randomToken();
      refreshTokens.set(newRefresh, {
        clientId: client.client_id,
        scopes: grantedScopes,
        resource: entry.resource,
        expiresAt: newRefreshTokenExpiry(),
      });

      return {
        access_token: token,
        token_type: "Bearer",
        expires_in: expiresAt - Math.floor(Date.now() / 1000),
        scope: grantedScopes.join(" "),
        refresh_token: newRefresh,
      };
    } catch (error) {
      logOAuthServerError(
        {
          stage: "exchangeRefreshToken",
          grantType: "refresh_token",
          clientId: client.client_id,
          params: {
            hasRefreshToken: Boolean(refreshToken),
            hasScope: Boolean(scopes && scopes.length > 0),
            hasResource: Boolean(resource),
          },
        },
        error,
      );
      throw error;
    }
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const claims = await verifyAccessTokenJwt(token);
      return {
        token,
        clientId: claims.clientId,
        scopes: claims.scopes,
        expiresAt: claims.expiresAt,
        resource: new URL(claims.resource),
      };
    } catch (error) {
      if (error instanceof AccessTokenError) {
        throw new InvalidTokenError(error.message);
      }
      throw error;
    }
  },

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const { token } = request;

    const refreshEntry = refreshTokens.get(token);
    if (refreshEntry && refreshEntry.clientId === client.client_id) {
      refreshTokens.delete(token);
      return;
    }

    try {
      const claims = await verifyAccessTokenJwt(token);
      if (claims.clientId === client.client_id) {
        markTokenRevoked(claims.jti);
      }
    } catch {
      // Invalid, expired, or already-revoked tokens are a no-op per RFC 7009.
    }
  },
};

export { ACCESS_TOKEN_TTL };
