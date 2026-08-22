import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shopifyGraphQL } from "../shopify/graphqlClient.js";
import {
  CREATE_PRODUCT_MUTATION,
  GET_PRODUCT_QUERY,
  LIST_PRODUCTS_QUERY,
  UPDATE_PRODUCT_MUTATION,
} from "../shopify/queries.js";
import { errorResult, jsonResult, toGid } from "./helpers.js";

const PRODUCT_STATUS = z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]);

export function registerProductTools(server: McpServer): void {
  server.registerTool(
    "list_products",
    {
      title: "List products",
      description:
        "List products in the Shopify store, with optional search query and pagination.",
      inputSchema: {
        first: z
          .number()
          .int()
          .min(1)
          .max(250)
          .default(20)
          .describe("Number of products to return (max 250)."),
        after: z
          .string()
          .optional()
          .describe("Cursor to fetch the next page of results."),
        query: z
          .string()
          .optional()
          .describe(
            "Shopify search syntax to filter products, e.g. \"status:active\" or \"title:*shirt*\".",
          ),
      },
    },
    async ({ first, after, query }) => {
      try {
        const data = await shopifyGraphQL(LIST_PRODUCTS_QUERY, {
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
    "get_product",
    {
      title: "Get a product",
      description:
        "Retrieve a single product by ID, including variants, options, and media.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The product ID, either numeric (e.g. \"123456789\") or a full GID (e.g. \"gid://shopify/Product/123456789\").",
          ),
      },
    },
    async ({ id }) => {
      try {
        const data = await shopifyGraphQL(GET_PRODUCT_QUERY, {
          id: toGid("Product", id),
        });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_product",
    {
      title: "Create a product",
      description: "Create a new product in the Shopify store.",
      inputSchema: {
        title: z.string().describe("The product title."),
        descriptionHtml: z
          .string()
          .optional()
          .describe("The product description, as HTML."),
        vendor: z.string().optional().describe("The product vendor."),
        productType: z.string().optional().describe("The product type."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Tags to associate with the product."),
        status: PRODUCT_STATUS.optional().describe(
          "The product status: ACTIVE, ARCHIVED, or DRAFT.",
        ),
        handle: z
          .string()
          .optional()
          .describe("A unique human-friendly handle for the product."),
      },
    },
    async (input) => {
      try {
        const data = await shopifyGraphQL(CREATE_PRODUCT_MUTATION, {
          product: input,
        });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_product",
    {
      title: "Update a product",
      description: "Update an existing product in the Shopify store.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The product ID, either numeric (e.g. \"123456789\") or a full GID (e.g. \"gid://shopify/Product/123456789\").",
          ),
        title: z.string().optional().describe("The product title."),
        descriptionHtml: z
          .string()
          .optional()
          .describe("The product description, as HTML."),
        vendor: z.string().optional().describe("The product vendor."),
        productType: z.string().optional().describe("The product type."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Tags to associate with the product."),
        status: PRODUCT_STATUS.optional().describe(
          "The product status: ACTIVE, ARCHIVED, or DRAFT.",
        ),
        handle: z
          .string()
          .optional()
          .describe("A unique human-friendly handle for the product."),
      },
    },
    async ({ id, ...rest }) => {
      try {
        const data = await shopifyGraphQL(UPDATE_PRODUCT_MUTATION, {
          product: { id: toGid("Product", id), ...rest },
        });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
