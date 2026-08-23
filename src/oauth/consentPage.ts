function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ConsentPageParams {
  clientName: string;
  redirectUri: string;
  clientId: string;
  responseType: "code";
  codeChallenge: string;
  codeChallengeMethod: "S256";
  state?: string;
  scope: string;
  resource?: string;
  error?: string;
}

export function renderConsentPage(params: ConsentPageParams): string {
  const redirectHost = (() => {
    try {
      return new URL(params.redirectUri).hostname;
    } catch {
      return params.redirectUri;
    }
  })();
  const isLoopback = redirectHost === "localhost" || redirectHost === "127.0.0.1";

  const hiddenFields: Array<[string, string | undefined]> = [
    ["client_id", params.clientId],
    ["redirect_uri", params.redirectUri],
    ["response_type", params.responseType],
    ["code_challenge", params.codeChallenge],
    ["code_challenge_method", params.codeChallengeMethod],
    ["state", params.state],
    ["scope", params.scope],
    ["resource", params.resource],
  ];

  const hiddenInputs = hiddenFields
    .filter(([, value]) => value !== undefined)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value as string)}">`,
    )
    .join("\n    ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize connection</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); padding: 32px; max-width: 420px; width: 100%; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #444; font-size: 14px; line-height: 1.5; }
  .redirect { font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
  .warning { color: #8a5a00; background: #fff6e5; border: 1px solid #f0d58c; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin: 12px 0; }
  .error { color: #a30d11; background: #fdeceb; border: 1px solid #f3b7b4; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin: 12px 0; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
  input[type="password"] { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; }
  button { width: 100%; margin-top: 20px; padding: 10px 12px; border: none; border-radius: 8px; background: #d97757; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:hover { background: #c96a4c; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(params.clientName)} wants to connect</h1>
    <p>This will grant access to the Shopify Admin tools on this server. It will redirect to:</p>
    <p class="redirect">${escapeHtml(params.redirectUri)}</p>
    ${isLoopback ? '<div class="warning">This redirects to a local application on your device (loopback address).</div>' : ""}
    ${params.error ? `<div class="error">${escapeHtml(params.error)}</div>` : ""}
    <form method="POST">
    ${hiddenInputs}
      <label for="password">Admin password</label>
      <input type="password" id="password" name="password" autofocus required>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>
`;
}
