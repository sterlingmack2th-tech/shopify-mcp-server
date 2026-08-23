import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { config } from "../config.js";
import { isTokenRevoked } from "./store.js";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

const signingKey = new TextEncoder().encode(config.mcpOAuthSigningSecret);

export interface AccessTokenClaims {
  clientId: string;
  scopes: string[];
  resource: string;
  jti: string;
  expiresAt: number;
}

export async function signAccessToken(params: {
  clientId: string;
  scopes: string[];
  resource: string;
}): Promise<{ token: string; expiresAt: number; jti: string }> {
  const jti = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({
    scope: params.scopes.join(" "),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(config.mcpIssuerUrl.href)
    .setAudience(config.mcpResourceUrl.href)
    .setSubject(params.clientId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(signingKey);

  return { token, expiresAt, jti };
}

export class AccessTokenError extends Error {}

export async function verifyAccessTokenJwt(token: string): Promise<AccessTokenClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, signingKey, {
      issuer: config.mcpIssuerUrl.href,
      audience: config.mcpResourceUrl.href,
    }));
  } catch (error) {
    if (error instanceof joseErrors.JOSEError) {
      throw new AccessTokenError(error.message);
    }
    throw error;
  }

  const jti = payload.jti;
  const sub = payload.sub;
  const exp = payload.exp;
  const scope = payload.scope;

  if (!jti || !sub || !exp || typeof scope !== "string") {
    throw new AccessTokenError("Malformed access token payload");
  }

  if (isTokenRevoked(jti)) {
    throw new AccessTokenError("Token has been revoked");
  }

  return {
    clientId: sub,
    scopes: scope.length > 0 ? scope.split(" ") : [],
    resource: config.mcpResourceUrl.href,
    jti,
    expiresAt: exp,
  };
}

export function ACCESS_TOKEN_TTL(): number {
  return ACCESS_TOKEN_TTL_SECONDS;
}
