import express from "express";
import {
  createOAuthMetadata,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { config } from "../config.js";
import { DEFAULT_SCOPES, shopifyMcpOAuthProvider } from "./provider.js";
import { requireStaticClaudeClientSecret } from "./staticClientTokenAuth.js";

const oauthMetadata = createOAuthMetadata({
  provider: shopifyMcpOAuthProvider,
  issuerUrl: config.mcpIssuerUrl,
  scopesSupported: DEFAULT_SCOPES,
});

// Advertise Client ID Metadata Document support (draft-ietf-oauth-client-id-metadata-document).
// Claude only selects CIMD when this flag AND "none" in token_endpoint_auth_methods_supported
// are both present; createOAuthMetadata already includes "none".
oauthMetadata.client_id_metadata_document_supported = true;

export const oauthRouter = express.Router();

oauthRouter.use(
  new URL(oauthMetadata.authorization_endpoint).pathname,
  authorizationHandler({ provider: shopifyMcpOAuthProvider }),
);

// A body parser here lets requireStaticClaudeClientSecret inspect
// client_id/client_secret before tokenHandler runs. tokenHandler applies its
// own express.urlencoded() too, which is a documented no-op once the body
// has already been parsed, so this doesn't affect other clients (CIMD/DCR).
oauthRouter.use(
  new URL(oauthMetadata.token_endpoint).pathname,
  express.urlencoded({ extended: false }),
  requireStaticClaudeClientSecret,
);

oauthRouter.use(
  new URL(oauthMetadata.token_endpoint).pathname,
  tokenHandler({ provider: shopifyMcpOAuthProvider }),
);

oauthRouter.use(
  mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: config.mcpResourceUrl,
    scopesSupported: DEFAULT_SCOPES,
    resourceName: "Shopify Admin MCP Server",
  }),
);

if (oauthMetadata.registration_endpoint) {
  oauthRouter.use(
    new URL(oauthMetadata.registration_endpoint).pathname,
    clientRegistrationHandler({
      clientsStore: shopifyMcpOAuthProvider.clientsStore,
      clientIdGeneration: false,
    }),
  );
}

if (oauthMetadata.revocation_endpoint) {
  oauthRouter.use(
    new URL(oauthMetadata.revocation_endpoint).pathname,
    revocationHandler({ provider: shopifyMcpOAuthProvider }),
  );
}

export const protectedResourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(config.mcpResourceUrl);

export const requireShopifyMcpBearerAuth = requireBearerAuth({
  verifier: shopifyMcpOAuthProvider,
  resourceMetadataUrl: protectedResourceMetadataUrl,
});
