export const MIN_SCHEMA_VERSION = 6;
export const EXPECTED_SCHEMA_VERSION = 10;

export function isSupportedSchemaVersion(version: unknown): boolean {
  const n = typeof version === "number" ? version : Number(version);
  return Number.isFinite(n) && n >= MIN_SCHEMA_VERSION;
}
export const VISIBLE_POLL_MS = 1000;
export const HIDDEN_POLL_MS = 5000;
