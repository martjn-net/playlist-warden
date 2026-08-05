/**
 * Pure one-shot overview compose — port of web/controllers/overview.php's
 * derive section. Given data already fetched from the Data API (entries,
 * statuses, video info, raw items) plus the playlist's rules/adder map/cap, it
 * derives every read check and the cap/prune dry-run plans. No network, no
 * mutation → unit-tested. The Svelte handler fetches once and calls this.
 */

import { isRecord } from './guards.ts';
import {
  contentViolation,
  deadReason,
  duplicates,
  planCap,
  prunePlanRemovals,
  type CapSurplus,
  type PlaylistEntry,
  type VideoInfo,
  type VideoStatus,
} from './checks.ts';
import type { ContentRules } from './schema.ts';

export interface FlaggedEntry extends PlaylistEntry {
  reason: string;
}

export interface ContributorCount {
  channelId: string;
  title: string;
  count: number;
}

export interface OverviewResult {
  entries: number;
  dead: FlaggedEntry[];
  dups: Record<string, PlaylistEntry[]>;
  dupRemovable: number;
  flagged: FlaggedEntry[];
  counts: ContributorCount[];
  ownerOnly: boolean;
  cap: number;
  shuffle: boolean;
  capPlan: CapSurplus[];
  attributed: number;
  prunePlan: Array<[PlaylistEntry, string]>;
}

export interface OverviewInput {
  entries: PlaylistEntry[];
  statuses: Record<string, VideoStatus>;
  info: Record<string, VideoInfo>;
  rawItems: unknown[];
  rules: ContentRules;
  adderMap: Record<string, string>;
  cap: number;
  shuffle: boolean;
}

export function computeOverview(input: OverviewInput): OverviewResult {
  const { entries, statuses, info, rawItems, rules, adderMap, cap, shuffle } = input;

  const dead: FlaggedEntry[] = [];
  for (const e of entries) {
    const reason = deadReason(e.video_id, statuses);
    if (reason !== null) dead.push({ ...e, reason });
  }

  const dups = duplicates(entries);
  let dupRemovable = 0;
  for (const es of Object.values(dups)) dupRemovable += es.length - 1;

  const flagged: FlaggedEntry[] = [];
  for (const e of entries) {
    const reason = contentViolation(e.video_id, info, rules);
    if (reason !== null) flagged.push({ ...e, reason });
  }

  // contributor spread (channelId per raw playlist item)
  const countsMap = new Map<string, ContributorCount>();
  for (const raw of rawItems) {
    const it = isRecord(raw) ? raw : {};
    const snip = isRecord(it.snippet) ? it.snippet : {};
    const channelId = typeof snip.channelId === 'string' ? snip.channelId : '?';
    const title = typeof snip.channelTitle === 'string' ? snip.channelTitle : '?';
    const existing = countsMap.get(channelId);
    if (existing) existing.count++;
    else countsMap.set(channelId, { channelId, title, count: 1 });
  }
  const counts = [...countsMap.values()];
  const ownerOnly = counts.length <= 1;

  const capPlan = cap > 0 && Object.keys(adderMap).length > 0 ? planCap(entries, adderMap, cap) : [];
  const prunePlan = prunePlanRemovals(entries, { duplicates: true, content: true }, info, rules);

  return {
    entries: entries.length,
    dead,
    dups,
    dupRemovable,
    flagged,
    counts,
    ownerOnly,
    cap,
    shuffle,
    capPlan,
    attributed: Object.keys(adderMap).length,
    prunePlan,
  };
}
