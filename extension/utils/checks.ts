/**
 * Pure check/plan logic — behaviour-faithful port of web/lib/checks.php
 * (itself a port of the Python CLIs: check_dead_links, check_duplicates,
 * check_content, cap_shuffle, prune). Side-effect free so it is unit-tested
 * against the same cases as web/tests/run.php (see tests/checks.test.ts).
 *
 * The Data API reads that feed these functions (playlistItems.list /
 * videos.list, and the raw→VideoInfo shaping) need the signed-in user's OAuth
 * token and live with the transport layer (utils/yt.ts, milestone M4).
 */

import type { ContentRules } from './schema.ts';

/** Per-video metadata the content rules inspect (shaped from videos.list). */
export interface VideoInfo {
  categoryId: string | null;
  ytRating: string | null;
  title: string;
  tags: string[];
  channelId: string | null;
  channelTitle: string;
  duration_s: number;
  topics: string[];
  region_blocked: string[];
}

/** A video's status resource (from videos.list status part). */
export interface VideoStatus {
  privacyStatus?: string;
  uploadStatus?: string;
}

/** One playlist entry (a video at a position, with its playlistItem id). */
export interface PlaylistEntry {
  item_id: string;
  video_id: string;
  title: string;
  position: number;
  added_at: string;
}

/** upload statuses that mean the video is gone. */
export const DEAD_UPLOAD_STATUS = ['rejected', 'failed', 'deleted'];

/** ISO-8601 duration (PT#H#M#S) → seconds. Unparsable → 0. */
export function durationSeconds(iso: string | null | undefined): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const mi = m[2] ? parseInt(m[2], 10) : 0;
  const s = m[3] ? parseInt(m[3], 10) : 0;
  return h * 3600 + mi * 60 + s;
}

/** True if any needle (case-insensitive substring) occurs in any haystack. */
function matchesAny(needles: string[], haystacks: string[]): boolean {
  for (const n of needles) {
    if (!n) continue;
    const nl = n.toLowerCase();
    for (const h of haystacks) {
      if (String(h).toLowerCase().includes(nl)) return true;
    }
  }
  return false;
}

/** First content rule the entry violates, or null if it passes all. */
export function contentViolation(
  videoId: string,
  info: Record<string, VideoInfo>,
  rules: ContentRules,
): string | null {
  const m = info[videoId];
  if (!m) return 'unavailable (cannot check -- deleted/private)';

  if (rules.require_music_category && m.categoryId !== '10') {
    return `not music (category ${m.categoryId ?? 'null'})`;
  }
  if (rules.block_age_restricted && m.ytRating === 'ytAgeRestricted') {
    return 'age-restricted';
  }
  if (rules.deny_topics.length > 0 && matchesAny(rules.deny_topics, m.topics)) {
    return 'denied genre/topic';
  }
  if (rules.allow_topics.length > 0 && !matchesAny(rules.allow_topics, m.topics)) {
    return 'genre not in allowlist';
  }
  if (rules.title_blocklist.length > 0 && matchesAny(rules.title_blocklist, [m.title, ...m.tags])) {
    let hit = '';
    for (const kw of rules.title_blocklist) {
      if (matchesAny([kw], [m.title, ...m.tags])) {
        hit = kw;
        break;
      }
    }
    return `blocked keyword (${hit})`;
  }
  for (const ch of rules.deny_channels) {
    if (ch !== '' && (ch === m.channelId || m.channelTitle.toLowerCase().includes(ch.toLowerCase()))) {
      return `denied channel (${m.channelTitle})`;
    }
  }
  const maxd = rules.max_duration_seconds;
  const mind = rules.min_duration_seconds;
  if (maxd && m.duration_s && m.duration_s > maxd) {
    return `too long (${m.duration_s}s > ${maxd}s)`;
  }
  if (mind && m.duration_s && m.duration_s < mind) {
    return `too short (${m.duration_s}s < ${mind}s)`;
  }
  const reg = rules.block_if_region_blocked;
  if (reg !== '' && m.region_blocked.includes(reg)) {
    return `blocked in ${reg}`;
  }
  return null;
}

/** Why a video is unwatchable, or null if fine. status: {videoId: statusResource}. */
export function deadReason(videoId: string, status: Record<string, VideoStatus>): string | null {
  const st = status[videoId];
  if (!st) return 'unavailable (deleted or removed)';
  if (st.privacyStatus === 'private') return 'private';
  const upload = st.uploadStatus;
  if (upload != null && DEAD_UPLOAD_STATUS.includes(upload)) {
    return `unavailable (uploadStatus=${upload})`;
  }
  return null;
}

/** {video_id: [entries]} for every video_id used more than once. */
export function duplicates(entries: PlaylistEntry[]): Record<string, PlaylistEntry[]> {
  const byId: Record<string, PlaylistEntry[]> = {};
  for (const e of entries) {
    if (e.video_id) (byId[e.video_id] ??= []).push(e);
  }
  const out: Record<string, PlaylistEntry[]> = {};
  for (const [videoId, es] of Object.entries(byId)) {
    if (es.length > 1) out[videoId] = es;
  }
  return out;
}

/** A cap surplus entry: a playlist entry tagged with its contributor avatar. */
export interface CapSurplus extends PlaylistEntry {
  avatar: string;
}

/**
 * Surplus entries to delete: the oldest beyond `cap` per contributor (avatar).
 * avatarOf maps video_id → avatar_photo_id.
 */
export function planCap(
  items: PlaylistEntry[],
  avatarOf: Record<string, string>,
  cap: number,
): CapSurplus[] {
  const groups: Record<string, CapSurplus[]> = {};
  for (const it of items) {
    const av = avatarOf[it.video_id];
    if (av) (groups[av] ??= []).push({ ...it, avatar: av });
  }
  let surplus: CapSurplus[] = [];
  for (const its of Object.values(groups)) {
    if (its.length > cap) {
      const sorted = [...its].sort((a, b) => String(a.added_at).localeCompare(String(b.added_at)));
      surplus = surplus.concat(sorted.slice(0, its.length - cap));
    }
  }
  return surplus;
}

/** A shuffled copy of the items (order randomised; membership preserved). */
export function planShuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = order[i]!;
    order[i] = order[j]!;
    order[j] = ai;
  }
  return order;
}

/**
 * Entries to remove with a reason, in playlist order. First reason wins.
 * Duplicates: keep the earliest position, mark the rest. Content: per contentViolation().
 */
export function prunePlanRemovals(
  entries: PlaylistEntry[],
  opts: { duplicates?: boolean; content?: boolean },
  info: Record<string, VideoInfo> | null = null,
  rules: ContentRules | null = null,
): Array<[PlaylistEntry, string]> {
  const marked = new Map<string, string>();

  if (opts.duplicates) {
    for (const es of Object.values(duplicates(entries))) {
      let keep: PlaylistEntry | undefined;
      for (const e of es) if (keep === undefined || e.position < keep.position) keep = e;
      if (keep === undefined) continue;
      const keepId = keep.item_id;
      for (const e of es) {
        if (e.item_id !== keepId && !marked.has(e.item_id)) {
          marked.set(e.item_id, 'duplicate');
        }
      }
    }
  }

  if (opts.content && info !== null) {
    for (const e of entries) {
      const reason = contentViolation(e.video_id, info, rules ?? emptyRules());
      if (reason !== null && !marked.has(e.item_id)) marked.set(e.item_id, reason);
    }
  }

  const out: Array<[PlaylistEntry, string]> = [];
  for (const e of entries) {
    const reason = marked.get(e.item_id);
    if (reason !== undefined) out.push([e, reason]);
  }
  return out;
}

/** Defensive fallback so contentViolation never sees undefined rule fields. */
function emptyRules(): ContentRules {
  return {
    require_music_category: false,
    block_age_restricted: false,
    allow_topics: [],
    deny_topics: [],
    title_blocklist: [],
    deny_channels: [],
    max_duration_seconds: 0,
    min_duration_seconds: 0,
    block_if_region_blocked: '',
  };
}
