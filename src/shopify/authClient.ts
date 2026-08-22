import { config } from "../config.js";

interface TokenResponse {
  access_token: string;
  scope: string;
  expires_in: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let inFlightRequest: Promise<string> | null = null;

const EXPIRY_BUFFER_MS = 60_000;

async function fetchAccessToken(): Promise<string> {
  const url = `https://${config.shopifyStore}/admin/oauth/access_token`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: config.shopifyClientId,
      client_secret: config.shopifyClientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to obtain Shopify access token (${response.status} ${response.statusText}): ${body}`,
    );
  }

  const data = (await response.json()) as TokenResponse;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - EXPIRY_BUFFER_MS,
  };

  return cachedToken.accessToken;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  if (!inFlightRequest) {
    inFlightRequest = fetchAccessToken().finally(() => {
      inFlightRequest = null;
    });
  }

  return inFlightRequest;
}
