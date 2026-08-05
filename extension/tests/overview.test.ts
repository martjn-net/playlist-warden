import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeOverview } from '../utils/overview.ts';
import type { PlaylistEntry, VideoInfo, VideoStatus } from '../utils/checks.ts';
import { normalizeRules } from '../utils/schema.ts';

const music: VideoInfo = {
  categoryId: '10',
  ytRating: null,
  title: 'S',
  tags: [],
  channelId: 'UC',
  channelTitle: 'Owner',
  duration_s: 200,
  topics: [],
  region_blocked: [],
};

const entries: PlaylistEntry[] = [
  { item_id: 'i1', video_id: 'v1', title: 'a', position: 0, added_at: '2024-01-01' },
  { item_id: 'i2', video_id: 'v2', title: 'b', position: 1, added_at: '2024-01-02' },
  { item_id: 'i3', video_id: 'v1', title: 'a', position: 2, added_at: '2024-01-03' },
  { item_id: 'i4', video_id: 'v3', title: 'c', position: 3, added_at: '2024-01-04' },
];

const statuses: Record<string, VideoStatus> = {
  v1: { privacyStatus: 'public', uploadStatus: 'processed' },
  v2: { privacyStatus: 'private' },
  v3: { privacyStatus: 'public', uploadStatus: 'processed' },
};

const info: Record<string, VideoInfo> = {
  v1: music,
  v2: music,
  v3: { ...music, categoryId: '1' }, // not music
};

const rawItems = [
  { snippet: { channelId: 'UCowner', channelTitle: 'Owner' } },
  { snippet: { channelId: 'UCowner', channelTitle: 'Owner' } },
  { snippet: { channelId: 'UCowner', channelTitle: 'Owner' } },
  { snippet: { channelId: 'UCother', channelTitle: 'Other' } },
];

test('computeOverview derives every check + dry-run plans from shared data', () => {
  const r = computeOverview({
    entries,
    statuses,
    info,
    rawItems,
    rules: normalizeRules({}),
    adderMap: { v1: 'avaX', v3: 'avaY' },
    cap: 1,
    shuffle: true,
  });

  assert.equal(r.entries, 4);

  // dead: v2 is private
  assert.equal(r.dead.length, 1);
  assert.equal(r.dead[0].item_id, 'i2');
  assert.equal(r.dead[0].reason, 'private');

  // duplicates: v1 twice
  assert.deepEqual(Object.keys(r.dups), ['v1']);
  assert.equal(r.dupRemovable, 1);

  // content: v3 not music
  assert.equal(r.flagged.length, 1);
  assert.equal(r.flagged[0].item_id, 'i4');
  assert.equal(r.flagged[0].reason, 'not music (category 1)');

  // contributor spread: two channels → not owner-only
  assert.equal(r.counts.length, 2);
  assert.equal(r.ownerOnly, false);

  // cap plan: avaX has i1+i3 (>1) → oldest i1 surplus
  assert.equal(r.capPlan.length, 1);
  assert.equal(r.capPlan[0].item_id, 'i1');
  assert.equal(r.attributed, 2);

  // prune plan: i3 duplicate + i4 not music, in playlist order
  const byItem = new Map(r.prunePlan.map(([e, why]) => [e.item_id, why]));
  assert.equal(byItem.get('i3'), 'duplicate');
  assert.equal(byItem.get('i4'), 'not music (category 1)');
  assert.deepEqual(r.prunePlan.map(([e]) => e.item_id), ['i3', 'i4']);

  assert.equal(r.cap, 1);
  assert.equal(r.shuffle, true);
});

test('computeOverview: no cap or no adder map → empty cap plan', () => {
  const base = { entries, statuses, info, rawItems, rules: normalizeRules({}), shuffle: false };
  assert.deepEqual(computeOverview({ ...base, adderMap: { v1: 'avaX' }, cap: 0 }).capPlan, []);
  assert.deepEqual(computeOverview({ ...base, adderMap: {}, cap: 2 }).capPlan, []);
});
