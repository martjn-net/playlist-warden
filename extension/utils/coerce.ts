/**
 * Canonical coercions from untrusted `unknown` (imported/serialized JSON,
 * deep YouTube API payloads) to well-typed values. One source of truth so the
 * schema layer and the API client don't each re-invent these. Pure, no deps
 * beyond the record guard → unit-tested.
 */

/** A string, or `dflt` (default `''`) when the value is not a string. */
export function asString(v: unknown, dflt = ''): string {
  return typeof v === 'string' ? v : dflt;
}

/** A string, or `null` when the value is not a string. */
export function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** A boolean; missing (`undefined`/`null`) falls back to `dflt`. */
export function asBool(v: unknown, dflt: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null) return dflt;
  return Boolean(v);
}

/** A positive integer, else 0 (matches PHP `(int)` + truthiness gating). */
export function asInt(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The string members of an array, else `[]`. */
export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
