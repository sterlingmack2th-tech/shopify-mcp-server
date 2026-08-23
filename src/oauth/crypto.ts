import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison, safe for secrets (passwords, client secrets). */
export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // Still perform a comparison of matching length so a length mismatch
    // doesn't short-circuit faster than a full comparison would.
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
