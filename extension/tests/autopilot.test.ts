import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DAY_MS, dueForNotification, lastRunByPlaylist } from '../utils/autopilot.ts';
import type { Job, PlaylistMeta } from '../utils/schema.ts';

const base = (over: Partial<PlaylistMeta>): PlaylistMeta => ({
  id: 'PL',
  title: 'List',
  privacy: 'public',
  cap: 5,
  shuffle: true,
  autoIntervalDays: 0,
  updatedAt: '',
  ...over,
});

const job = (over: Partial<Job>): Job => ({
  id: 'j',
  command: 'run_all',
  playlistId: 'PL',
  apply: true,
  status: 'done',
  createdAt: '2026-08-01T00:00:00Z',
  result: '',
  ...over,
});

const NOW = Date.parse('2026-08-06T00:00:00Z');

test('lastRunByPlaylist anchors on newest done run_all job, else updatedAt', () => {
  const playlists = { PL: base({ updatedAt: '2026-08-01T00:00:00Z' }), PL2: base({ id: 'PL2', updatedAt: '2026-08-04T00:00:00Z' }) };
  const jobs = [job({ createdAt: '2026-08-03T00:00:00Z' }), job({ status: 'error', createdAt: '2026-08-05T00:00:00Z' }), job({ command: 'other', createdAt: '2026-08-05T00:00:00Z' })];
  const runs = lastRunByPlaylist(jobs, playlists);
  assert.equal(runs.PL, Date.parse('2026-08-03T00:00:00Z')); // error/other-command jobs ignored
  assert.equal(runs.PL2, Date.parse('2026-08-04T00:00:00Z')); // no job -> playlist.updatedAt
});

test('dueForNotification fires only when interval elapsed and autopilot on', () => {
  const playlists = {
    OFF: base({ id: 'OFF', autoIntervalDays: 0 }),
    FRESH: base({ id: 'FRESH', autoIntervalDays: 7 }),
    OLD: base({ id: 'OLD', autoIntervalDays: 7 }),
  };
  const runs = { OFF: NOW - 30 * DAY_MS, FRESH: NOW - 3 * DAY_MS, OLD: NOW - 8 * DAY_MS };
  const due = dueForNotification(playlists, runs, {}, NOW);
  assert.deepEqual(due.map((d) => d.id), ['OLD']);
  assert.equal(due[0].daysSinceRun, 8);
});

test('dueForNotification suppresses re-alerts until a full new window passed', () => {
  const playlists = { PL: base({ autoIntervalDays: 1, title: 'Daily' }) };
  const runs = { PL: NOW - 5 * DAY_MS };
  // notified half a day ago -> suppressed
  assert.equal(dueForNotification(playlists, runs, { PL: NOW - DAY_MS / 2 }, NOW).length, 0);
  // notified more than one window ago -> fires again
  const again = dueForNotification(playlists, runs, { PL: NOW - 2 * DAY_MS }, NOW);
  assert.equal(again.length, 1);
  assert.equal(again[0].title, 'Daily');
});
