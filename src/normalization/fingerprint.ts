import crypto from "node:crypto";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function buildFingerprint(parts: Record<string, unknown>): string {
  // Stable stringification for deterministic hashing (sort keys shallowly).
  const keys = Object.keys(parts).sort();
  const stable: Record<string, unknown> = {};
  for (const k of keys) stable[k] = parts[k];
  return sha256Hex(JSON.stringify(stable));
}

