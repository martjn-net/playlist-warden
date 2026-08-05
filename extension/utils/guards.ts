/**
 * Canonical type guards for this package (see project rule: no per-call-site
 * `isRecord`). `ytInitialData` is enormous, highly variable YouTube-internal
 * JSON that we traverse for a few fields via `findAll`; a full schema parse is
 * impractical, so we narrow with this one guard plus per-field
 * `typeof`/`Array.isArray`/`in` checks at the point of use.
 */

/** Value is a plain object (not null, not an array). Fields stay `unknown`. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
