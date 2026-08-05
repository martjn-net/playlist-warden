import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_CONTENT_RULES,
  mergeAdderMap,
  normalizePlaylist,
  normalizeRules,
} from '../utils/schema.ts';

test('normalizeRules fills defaults and coerces types', () => {
  assert.deepEqual(normalizeRules({}), DEFAULT_CONTENT_RULES);
  const r = normalizeRules({
    require_music_category: false,
    max_duration_seconds: '600',
    min_duration_seconds: -5,
    allow_topics: ['Rock', 42, 'Pop'],
    block_if_region_blocked: 'DE',
    unknown_field: 'dropped',
  });
  assert.equal(r.require_music_category, false);
  assert.equal(r.block_age_restricted, true); // untouched default
  assert.equal(r.max_duration_seconds, 600); // string → int
  assert.equal(r.min_duration_seconds, 0); // negative → 0
  assert.deepEqual(r.allow_topics, ['Rock', 'Pop']); // non-strings filtered
  assert.equal(r.block_if_region_blocked, 'DE');
  assert.equal((r as Record<string, unknown>).unknown_field, undefined);
});

test('normalizeRules tolerates garbage input', () => {
  assert.deepEqual(normalizeRules(null), DEFAULT_CONTENT_RULES);
  assert.deepEqual(normalizeRules('nope'), DEFAULT_CONTENT_RULES);
  assert.deepEqual(normalizeRules(undefined), DEFAULT_CONTENT_RULES);
});

test('normalizePlaylist requires an id and coerces fields', () => {
  assert.equal(normalizePlaylist({}), null);
  assert.equal(normalizePlaylist('x'), null);
  const p = normalizePlaylist({ title: 'Mix', cap: '2', shuffle: 1 }, 'PL123');
  assert.deepEqual(p, { id: 'PL123', title: 'Mix', privacy: '', cap: 2, shuffle: true, autoIntervalDays: 0, updatedAt: '' });
  assert.equal(normalizePlaylist({ id: 'PLx', autoIntervalDays: '7' })?.autoIntervalDays, 7);
  // explicit id wins over fallback
  assert.equal(normalizePlaylist({ id: 'PLself' }, 'PLfallback')?.id, 'PLself');
});

test('mergeAdderMap: incoming wins per video, others kept, empties ignored', () => {
  const merged = mergeAdderMap(
    { v1: 'A', v2: 'B' },
    { v2: 'C', v3: 'D', v4: '' },
  );
  assert.deepEqual(merged, { v1: 'A', v2: 'C', v3: 'D' });
});
