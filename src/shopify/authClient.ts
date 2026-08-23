import { config } from "../config.js";

// Shopify's Admin API does not support an OAuth "client_credentials" grant.
// For a single-store custom app, Shopify issues a static Admin API access
// token (shpat_...) when you install the app — that token is used directly
// in the X-Shopify-Access-Token header. No token exchange is needed.
//
// Set SHOPIFY_ADMIN_ACCESS_TOKEN in the environment to that value:
// Shopify Admin -> Settings -> Apps and sales channels -> Develop apps ->
// (your app) -> API credentials -> Admin API access token.

export async function getAccessToken(): Promise<string> {
    return config.shopifyAdminAccessToken;
}
