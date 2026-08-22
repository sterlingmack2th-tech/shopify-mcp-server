function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  shopifyStore: requireEnv("SHOPIFY_STORE"),
  shopifyClientId: requireEnv("SHOPIFY_CLIENT_ID"),
  shopifyClientSecret: requireEnv("SHOPIFY_CLIENT_SECRET"),
  shopifyApiVersion: process.env.SHOPIFY_API_VERSION || "2026-07",
};
