import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ShopifyGraphQLError } from "../shopify/graphqlClient.js";

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorResult(error: unknown): CallToolResult {
  const message =
    error instanceof ShopifyGraphQLError || error instanceof Error
      ? error.message
      : String(error);

  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

export function toGid(resourceType: string, idOrGid: string): string {
  if (idOrGid.startsWith("gid://shopify/")) {
    return idOrGid;
  }
  return `gid://shopify/${resourceType}/${idOrGid}`;
}
