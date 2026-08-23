import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { clientIdMetadataDocumentCache, newCimdCacheExpiry } from "./store.js";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 64 * 1024;

export function looksLikeClientIdUrl(clientId: string): boolean {
  if (!clientId.startsWith("https://")) return false;
  try {
    const url = new URL(clientId);
    return url.protocol === "https:" && url.pathname !== "" && url.pathname !== "/";
  } catch {
    return false;
  }
}

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0);
}

function isPrivateOrReservedIp(ip: string, family: number): boolean {
  if (family === 4) {
    const n = ipv4ToInt(ip) >>> 0;
    const inRange = (base: string, maskBits: number) => {
      const baseInt = ipv4ToInt(base) >>> 0;
      const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
      return (n & mask) === (baseInt & mask);
    };
    return (
      inRange("10.0.0.0", 8) ||
      inRange("172.16.0.0", 12) ||
      inRange("192.168.0.0", 16) ||
      inRange("127.0.0.0", 8) ||
      inRange("169.254.0.0", 16) ||
      inRange("0.0.0.0", 8) ||
      inRange("100.64.0.0", 10)
    );
  }
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fe80:") ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:169.254.")
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname, isIP(hostname))) {
      throw new Error("client_id metadata host resolves to a private/reserved address");
    }
    return;
  }
  const { address, family } = await lookup(hostname);
  if (isPrivateOrReservedIp(address, family)) {
    throw new Error("client_id metadata host resolves to a private/reserved address");
  }
}

/**
 * Fetches and validates an OAuth Client ID Metadata Document, per
 * draft-ietf-oauth-client-id-metadata-document. The client_id itself is the
 * HTTPS URL of the document; we fetch it, validate the required fields, and
 * synthesize an OAuthClientInformationFull for the SDK's auth handlers.
 */
export async function fetchClientIdMetadataDocument(
  clientId: string,
): Promise<OAuthClientInformationFull | undefined> {
  const cached = clientIdMetadataDocumentCache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
  }

  const url = new URL(clientId);
  await assertPublicHost(url.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return undefined;
  }

  const reader = response.body?.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
  }
  const text = Buffer.concat(chunks).toString("utf-8");

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return undefined;
  }

  if (typeof doc !== "object" || doc === null) return undefined;
  const record = doc as Record<string, unknown>;

  if (record.client_id !== clientId) return undefined;
  if (typeof record.client_name !== "string" || record.client_name.length === 0) return undefined;
  if (!Array.isArray(record.redirect_uris) || record.redirect_uris.length === 0) return undefined;
  if (!record.redirect_uris.every((uri) => typeof uri === "string")) return undefined;

  const client: OAuthClientInformationFull = {
    client_id: clientId,
    client_name: record.client_name,
    redirect_uris: record.redirect_uris as string[],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_uri: typeof record.client_uri === "string" ? record.client_uri : undefined,
    logo_uri: typeof record.logo_uri === "string" ? record.logo_uri : undefined,
  };

  clientIdMetadataDocumentCache.set(clientId, { client, expiresAt: newCimdCacheExpiry() });
  return client;
}
