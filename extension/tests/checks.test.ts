import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  contentViolation,
  deadReason,
  duplicates,
  durationSeconds,
  planCap,
  planShuffle,
  prunePlanRemovals,
  type PlaylistEntry,
  type VideoInfo,
} from '../utils/checks.ts';
import { DEFAULT_CONTENT_RULES, normalizeRules } from '../utils/schema.ts';

// Mirrors web/tests/run.php 1:1 — the ported logic must behave identically.

test('durationSeconds parses ISO-8601 PT#H#M#S, else 0', () => {
  assert.equal(durationSeconds('PT3M30S'), 210);
  assert.equal(durationSeconds('PT1H2M3S'), 3723);
  assert.equal(durationSeconds('PT45S'), 45);
  assert.equal(durationSeconds('PT10M'), 600);
  assert.equal(durationSeconds(''), 0);
  assert.equal(durationSeconds('garbage'), 0);
  assert.equal(durationSeconds('P1DT1H'), 0); // unsupported day form
});

test('rules loader merges over defaults', () => {
  assert.deepEqual(normalizeRules(null), DEFAULT_CONTENT_RULES);
  const merged = normalizeRules({ require_music_category: false, max_duration_seconds: 900 });
  assert.equal(merged.require_music_category, false);
  assert.equal(merged.max_duration_seconds, 900);
  assert.equal(merged.block_age_restricted, true); // kept default
});

const base: VideoInfo = {
  categoryId: '10',
  ytRating: null,
  title: 'Nice Song',
  tags: [],
  channelId: 'UCabc',
  channelTitle: 'Some Artist',
  duration_s: 200,
  topics: ['https://en.wikipedia.org/wiki/Pop_music'],
  region_blocked: [],
};
const R = normalizeRules({
  title_blocklist: ['[explicit]'],
  deny_channels: ['UCbad'],
  max_duration_seconds: 900,
  min_duration_seconds: 30,
  block_if_region_blocked: 'DE',
});

test('contentViolation: first violated rule wins, else null', () => {
  assert.equal(contentViolation('v', { v: base }, R), null);
  assert.equal(contentViolation('missing', {}, R), 'unavailable (cannot check -- deleted/private)');
  assert.equal(contentViolation('v', { v: { ...base, categoryId: '24' } }, R), 'not music (category 24)');
  assert.equal(contentViolation('v', { v: { ...base, ytRating: 'ytAgeRestricted' } }, R), 'age-restricted');
  assert.equal(contentViolation('v', { v: { ...base, title: 'Song [Explicit]' } }, R), 'blocked keyword ([explicit])');
  assert.equal(contentViolation('v', { v: { ...base, channelId: 'UCbad' } }, R), 'denied channel (Some Artist)');
  assert.equal(contentViolation('v', { v: { ...base, duration_s: 1000 } }, R), 'too long (1000s > 900s)');
  assert.equal(contentViolation('v', { v: { ...base, duration_s: 10 } }, R), 'too short (10s < 30s)');
  assert.equal(contentViolation('v', { v: { ...base, region_blocked: ['DE', 'AT'] } }, R), 'blocked in DE');
});

test('contentViolation: deny/allow topics', () => {
  const Rt = normalizeRules({ deny_topics: ['Hip_hop'], require_music_category: false });
  assert.equal(contentViolation('v', { v: { ...base, topics: ['x/Hip_hop_music'] } }, Rt), 'denied genre/topic');
  const Ra = normalizeRules({ allow_topics: ['Classical'], require_music_category: false });
  assert.equal(contentViolation('v', { v: { ...base, topics: ['x/Pop_music'] } }, Ra), 'genre not in allowlist');
  assert.equal(contentViolation('v', { v: { ...base, topics: ['x/Classical_music'] } }, Ra), null);
});

test('contentViolation: not-music beats a title hit (first rule wins)', () => {
  const Rboth = normalizeRules({ title_blocklist: ['nope'] });
  assert.equal(contentViolation('v', { v: { ...base, categoryId: '1', title: 'nope' } }, Rboth), 'not music (category 1)');
});

test('deadReason: missing/private/rejected/alive', () => {
  assert.equal(deadReason('a', {}), 'unavailable (deleted or removed)');
  assert.equal(deadReason('a', { a: { privacyStatus: 'private' } }), 'private');
  assert.equal(deadReason('a', { a: { uploadStatus: 'rejected' } }), 'unavailable (uploadStatus=rejected)');
  assert.equal(deadReason('a', { a: { privacyStatus: 'public', uploadStatus: 'processed' } }), null);
});

const entries: PlaylistEntry[] = [
  { item_id: 'i1', video_id: 'A', title: 'a', position: 0, added_at: '2024-01-01' },
  { item_id: 'i2', video_id: 'B', title: 'b', position: 1, added_at: '2024-01-02' },
  { item_id: 'i3', video_id: 'A', title: 'a', position: 2, added_at: '2024-01-03' },
  { item_id: 'i4', video_id: '', title: 'x', position: 3, added_at: '2024-01-04' },
];

test('duplicates: only video_ids used more than once', () => {
  const dups = duplicates(entries);
  assert.deepEqual(Object.keys(dups), ['A']);
  assert.equal(dups.A.length, 2);
});

test('prunePlanRemovals: dupes keep earliest position', () => {
  const rem = prunePlanRemovals(entries, { duplicates: true });
  assert.equal(rem.length, 1);
  assert.equal(rem[0][0].item_id, 'i3');
  assert.equal(rem[0][1], 'duplicate');
});

test('prunePlanRemovals: dupes + content, first reason wins, playlist order', () => {
  const info: Record<string, VideoInfo> = { A: { ...base, categoryId: '1' }, B: { ...base } };
  const rem2 = prunePlanRemovals(entries, { duplicates: true, content: true }, info, normalizeRules({}));
  const byItem: Record<string, string> = {};
  for (const [e, why] of rem2) byItem[e.item_id] = why;
  assert.equal(byItem.i1, 'not music (category 1)');
  assert.equal(byItem.i3, 'duplicate');
  assert.equal(byItem.i4, 'unavailable (cannot check -- deleted/private)');
  assert.deepEqual(Object.keys(byItem), ['i1', 'i3', 'i4']); // playlist order preserved
});

const items: PlaylistEntry[] = [
  { video_id: 'V1', item_id: 'c1', title: 't1', position: 0, added_at: '2024-01-01' },
  { video_id: 'V2', item_id: 'c2', title: 't2', position: 1, added_at: '2024-01-02' },
  { video_id: 'V3', item_id: 'c3', title: 't3', position: 2, added_at: '2024-01-03' },
  { video_id: 'V4', item_id: 'c4', title: 't4', position: 3, added_at: '2024-02-01' },
];

test('planCap: removes oldest surplus beyond cap per contributor', () => {
  const avatarOf = { V1: 'avaX', V2: 'avaX', V3: 'avaX', V4: 'avaY' };
  const surplus = planCap(items, avatarOf, 2);
  assert.equal(surplus.length, 1);
  assert.equal(surplus[0].item_id, 'c1'); // oldest of avaX
  assert.deepEqual(planCap(items, { V1: 'a', V2: 'b' }, 2), []); // all under cap
  assert.deepEqual(planCap(items, {}, 2), []); // no avatars
});

test('planShuffle: preserves membership and count', () => {
  const sh = planShuffle(items);
  assert.equal(sh.length, items.length);
  const ids = sh.map((x) => x.item_id).sort();
  assert.deepEqual(ids, ['c1', 'c2', 'c3', 'c4']);
});
