import { config } from "../config.js";
import { getAccessToken } from "./authClient.js";

interface GraphQLError {
  message: string;
  [key: string]: unknown;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
  extensions?: unknown;
}

export class ShopifyGraphQLError extends Error {
  constructor(
    message: string,
    public readonly errors?: GraphQLError[],
  ) {
    super(message);
    this.name = "ShopifyGraphQLError";
  }
}

export async function shopifyGraphQL<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getAccessToken();
  const url = `https://${config.shopifyStore}/admin/api/${config.shopifyApiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ShopifyGraphQLError(
      `Shopify Admin API request failed (${response.status} ${response.statusText}): ${body}`,
    );
  }

  const payload = (await response.json()) as GraphQLResponse<T>;

  if (payload.errors && payload.errors.length > 0) {
    throw new ShopifyGraphQLError(
      `Shopify Admin API returned GraphQL errors: ${payload.errors
        .map((e) => e.message)
        .join("; ")}`,
      payload.errors,
    );
  }

  if (!payload.data) {
    throw new ShopifyGraphQLError("Shopify Admin API returned no data");
  }

  return payload.data;
}
