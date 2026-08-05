/**
 * Pure data model + normalisation for the extension store. No extension/WXT
 * dependency, so it runs under `node --test`. Mirrors the PHP panel's schema
 * (web/lib/db.php) and content-rule defaults (web/lib/checks.php
 * CONTENT_DEFAULT_RULES). The browser binding (wxt/storage) lives in store.ts.
 *
 * Everything here is a pure function over `unknown` input (imported/serialized
 * JSON is untrusted) → a well-typed, defaulted value.
 */

import { isRecord } from './guards.ts';
import { asBool as toBool, asInt as toInt, asString as toStr, asStringArray as toStringArray } from './coerce.ts';

export const SCHEMA_VERSION = 1;

/** Content rules per playlist — 1:1 with PHP CONTENT_DEFAULT_RULES. */
export interface ContentRules {
  require_music_category: boolean;
  block_age_restricted: boolean;
  allow_topics: string[];
  deny_topics: string[];
  title_blocklist: string[];
  deny_channels: string[];
  max_duration_seconds: number;
  min_duration_seconds: number;
  block_if_region_blocked: string;
}

export const DEFAULT_CONTENT_RULES: ContentRules = {
  require_music_category: true,
  block_age_restricted: true,
  allow_topics: [],
  deny_topics: [],
  title_blocklist: [],
  deny_channels: [],
  max_duration_seconds: 0,
  min_duration_seconds: 0,
  block_if_region_blocked: '',
};

/** Managed playlist metadata (playlist table). */
export interface PlaylistMeta {
  id: string;
  title: string;
  privacy: string; // 'public' | 'unlisted' | 'private' | ''
  cap: number; // cap_per_contributor, 0 = no cap
  shuffle: boolean;
  updatedAt: string;
}

/** Append-only write log (audit table). */
export interface AuditEntry {
  ts: string;
  playlistId: string;
  action: string;
  videoId: string | null;
  contributorAvatar: string | null;
  reason: string | null;
  detail: string | null;
}

/** A run record (job table). */
export interface Job {
  id: string;
  command: string;
  playlistId: string | null;
  apply: boolean;
  status: string;
  createdAt: string;
  result: string | null;
}

/** The whole store, as exported/imported JSON. */
export interface StoreData {
  version: number;
  playlists: Record<string, PlaylistMeta>;
  rules: Record<string, ContentRules>;
  adderMap: Record<string, Record<string, string>>; // playlistId → videoId → avatarPhotoId
  audit: AuditEntry[];
  jobs: Job[];
}

export function emptyStore(): StoreData {
  return {
    version: SCHEMA_VERSION,
    playlists: {},
    rules: {},
    adderMap: {},
    audit: [],
    jobs: [],
  };
}

// --- normalisers ------------------------------------------------------------

/** Merge a raw rules object over the defaults, coercing every field. */
export function normalizeRules(raw: unknown): ContentRules {
  const r = isRecord(raw) ? raw : {};
  return {
    require_music_category: toBool(r.require_music_category, DEFAULT_CONTENT_RULES.require_music_category),
    block_age_restricted: toBool(r.block_age_restricted, DEFAULT_CONTENT_RULES.block_age_restricted),
    allow_topics: toStringArray(r.allow_topics),
    deny_topics: toStringArray(r.deny_topics),
    title_blocklist: toStringArray(r.title_blocklist),
    deny_channels: toStringArray(r.deny_channels),
    max_duration_seconds: toInt(r.max_duration_seconds),
    min_duration_seconds: toInt(r.min_duration_seconds),
    block_if_region_blocked: toStr(r.block_if_region_blocked),
  };
}

/** A playlist needs at least an id; `fallbackId` supplies it for keyed maps. */
export function normalizePlaylist(raw: unknown, fallbackId = ''): PlaylistMeta | null {
  const r = isRecord(raw) ? raw : {};
  const id = toStr(r.id) || fallbackId;
  if (!id) return null;
  return {
    id,
    title: toStr(r.title),
    privacy: toStr(r.privacy),
    cap: toInt(r.cap),
    shuffle: toBool(r.shuffle, false),
    updatedAt: toStr(r.updatedAt),
  };
}

/** Adder maps merge per video: incoming wins, other videos are kept. */
export function mergeAdderMap(
  existing: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...existing };
  for (const [videoId, avatar] of Object.entries(incoming)) {
    if (typeof avatar === 'string' && avatar !== '') out[videoId] = avatar;
  }
  return out;
}
