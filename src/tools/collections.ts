import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shopifyGraphQL } from "../shopify/graphqlClient.js";
import {
  LIST_COLLECTIONS_QUERY,
  UPDATE_COLLECTION_MUTATION,
} from "../shopify/queries.js";
import { errorResult, jsonResult, toGid } from "./helpers.js";

const COLLECTION_SORT_ORDER = z.enum([
  "ALPHA_ASC",
  "ALPHA_DESC",
  "BEST_SELLING",
  "CREATED",
  "CREATED_DESC",
  "MANUAL",
  "PRICE_ASC",
  "PRICE_DESC",
]);

export function registerCollectionTools(server: McpServer): void {
  server.registerTool(
    "list_collections",
    {
      title: "List collections",
      description:
        "List collections in the Shopify store, with optional search query and pagination.",
      inputSchema: {
        first: z
          .number()
          .int()
          .min(1)
          .max(250)
          .default(20)
          .describe("Number of collections to return (max 250)."),
        after: z
          .string()
          .optional()
          .describe("Cursor to fetch the next page of results."),
        query: z
          .string()
          .optional()
          .describe(
            "Shopify search syntax to filter collections, e.g. \"title:sale\".",
          ),
      },
    },
    async ({ first, after, query }) => {
      try {
        const data = await shopifyGraphQL(LIST_COLLECTIONS_QUERY, {
          first,
          after,
          query,
        });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_collection",
    {
      title: "Update a collection",
      description: "Update an existing collection in the Shopify store.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The collection ID, either numeric or a full GID (e.g. \"gid://shopify/Collection/123456789\").",
          ),
        title: z.string().optional().describe("The collection title."),
        descriptionHtml: z
          .string()
          .optional()
          .describe("The collection description, as HTML."),
        handle: z
          .string()
          .optional()
          .describe("A unique human-friendly handle for the collection."),
        templateSuffix: z
          .string()
          .optional()
          .describe("The theme template suffix used to view the collection."),
        sortOrder: COLLECTION_SORT_ORDER.optional().describe(
          "The order in which the collection's products are sorted.",
        ),
      },
    },
    async ({ id, ...rest }) => {
      try {
        const data = await shopifyGraphQL(UPDATE_COLLECTION_MUTATION, {
          collection: { id: toGid("Collection", id), ...rest },
        });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
