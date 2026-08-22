import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shopifyGraphQL } from "../shopify/graphqlClient.js";
import {
  GET_THEME_FILES_QUERY,
  LIST_THEMES_QUERY,
  UPDATE_THEME_FILES_MUTATION,
} from "../shopify/queries.js";
import { errorResult, jsonResult, toGid } from "./helpers.js";

const THEME_FILE_BODY_TYPE = z.enum(["TEXT", "BASE64", "URL"]);

export function registerThemeTools(server: McpServer): void {
  server.registerTool(
    "list_themes",
    {
      title: "List themes",
      description:
        "List the themes installed in the Shopify store, including their role (MAIN, UNPUBLISHED, etc).",
      inputSchema: {
        first: z
          .number()
          .int()
          .min(1)
          .max(250)
          .default(20)
          .describe("Number of themes to return (max 250)."),
        after: z
          .string()
          .optional()
          .describe("Cursor to fetch the next page of results."),
      },
    },
    async ({ first, after }) => {
      try {
        const data = await shopifyGraphQL(LIST_THEMES_QUERY, { first, after });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "read_theme_assets",
    {
      title: "Read theme assets",
      description:
        "Read files (templates, sections, assets, config, locales) from a theme.",
      inputSchema: {
        themeId: z
          .string()
          .describe(
            "The theme ID, either numeric or a full GID (e.g. \"gid://shopify/OnlineStoreTheme/123456789\").",
          ),
        filenames: z
          .array(z.string())
          .optional()
          .describe(
            "Specific filenames to fetch, e.g. [\"templates/index.json\", \"assets/theme.css\"]. Omit to list files.",
          ),
        first: z
          .number()
          .int()
          .min(1)
          .max(250)
          .default(50)
          .describe("Number of files to return (max 250)."),
        after: z
          .string()
          .optional()
          .describe("Cursor to fetch the next page of results."),
      },
    },
    async ({ themeId, filenames, first, after }) => {
      try {
        const data = await shopifyGraphQL(GET_THEME_FILES_QUERY, {
          themeId: toGid("OnlineStoreTheme", themeId),
          filenames,
          first,
          after,
        });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_theme_assets",
    {
      title: "Update theme assets",
      description:
        "Create or update files (templates, sections, assets, config, locales) in a theme. Up to 50 files per call.",
      inputSchema: {
        themeId: z
          .string()
          .describe(
            "The theme ID, either numeric or a full GID (e.g. \"gid://shopify/OnlineStoreTheme/123456789\").",
          ),
        files: z
          .array(
            z.object({
              filename: z
                .string()
                .describe(
                  "The file path within the theme, e.g. \"assets/theme.css\" or \"templates/index.json\".",
                ),
              type: THEME_FILE_BODY_TYPE.describe(
                "The encoding of the value: TEXT for plain text/liquid/json, BASE64 for binary content, or URL to copy a file from a URL.",
              ),
              value: z
                .string()
                .describe(
                  "The file content: raw text for TEXT, base64-encoded data for BASE64, or a source URL for URL.",
                ),
            }),
          )
          .min(1)
          .max(50)
          .describe("The files to create or update."),
      },
    },
    async ({ themeId, files }) => {
      try {
        const data = await shopifyGraphQL(UPDATE_THEME_FILES_MUTATION, {
          themeId: toGid("OnlineStoreTheme", themeId),
          files: files.map((file) => ({
            filename: file.filename,
            body: {
              type: file.type,
              value: file.value,
            },
          })),
        });
        return jsonResult(data);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
