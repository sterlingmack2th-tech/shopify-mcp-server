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

  // Shopify's client_credentials token endpoint expects a form-urlencoded
  // body, not JSON. Sending JSON here causes Shopify to fail to parse the
  // fields at all, which surfaces as a misleading "missing or invalid
  // client secret" error even when the secret is correct.
  const body = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.shopifyClientId,
          client_secret: config.shopifyClientSecret,
  });

  const response = await fetch(url, {
          method: "POST",
          headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
          },
          body: body.toString(),
  });

  if (!response.ok) {
          const responseBody = await response.text();
          throw new Error(
                    `Failed to obtain Shopify access token (${response.status} ${response.statusText}): ${responseBody}`,
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
