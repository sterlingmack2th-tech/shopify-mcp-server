import type { NextFunction, Request, Response } from "express";
import { InvalidClientError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { safeCompare } from "./crypto.js";
import { staticClaudeClient } from "./staticClient.js";

/**
 * Validates client_secret for the pre-registered static Claude client with a
 * constant-time comparison, before the request reaches the SDK's
 * tokenHandler (whose own client-secret check is a plain `!==`). Requests
 * for any other client_id — CIMD, DCR, or unknown — pass through untouched
 * and are left to the normal SDK flow.
 *
 * Must be mounted after a body parser (req.body.client_id/client_secret).
 */
export function requireStaticClaudeClientSecret(req: Request, res: Response, next: NextFunction): void {
  const clientId = typeof req.body?.client_id === "string" ? req.body.client_id : undefined;

  if (!staticClaudeClient || clientId !== staticClaudeClient.client_id) {
    next();
    return;
  }

  const submittedSecret = typeof req.body?.client_secret === "string" ? req.body.client_secret : "";
  if (!safeCompare(submittedSecret, staticClaudeClient.client_secret as string)) {
    const error = new InvalidClientError("Invalid client_secret");
    res.status(400).json(error.toResponseObject());
    return;
  }

  next();
}
