import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildUrl,
  chunk,
  entriesFromItems,
  ownsFrom,
  shapeStatuses,
  ytApiMessage,
  shapeVideoInfo,
} from '../utils/yt.ts';

test('buildUrl drops null/empty params and encodes the rest', () => {
  const url = buildUrl('videos', { part: 'status', id: 'a,b', empty: '', nul: null, undef: undefined });
  assert.ok(url.startsWith('https://www.googleapis.com/youtube/v3/videos?'));
  assert.match(url, /part=status/);
  assert.match(url, /id=a%2Cb/);
  assert.doesNotMatch(url, /empty=/);
  assert.doesNotMatch(url, /nul=/);
  assert.equal(buildUrl('channels', {}), 'https://www.googleapis.com/youtube/v3/channels');
});

test('chunk splits into fixed-size batches', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 50), []);
});

test('entriesFromItems normalizes raw playlistItems (defaults for missing fields)', () => {
  const entries = entriesFromItems([
    { id: 'i1', snippet: { resourceId: { videoId: 'vA' }, title: 'T', position: 0, publishedAt: '2024-01-01' } },
    { id: 'i2', snippet: { resourceId: { videoId: 'vB' } } },
    'garbage',
  ]);
  assert.deepEqual(entries[0], { item_id: 'i1', video_id: 'vA', title: 'T', position: 0, added_at: '2024-01-01' });
  assert.deepEqual(entries[1], { item_id: 'i2', video_id: 'vB', title: '?', position: 1, added_at: '' });
  assert.deepEqual(entries[2], { item_id: '', video_id: '', title: '?', position: 2, added_at: '' });
});

test('shapeVideoInfo maps a videos.list resource into VideoInfo', () => {
  const info = shapeVideoInfo({
    vA: {
      snippet: { categoryId: '10', title: 'S', tags: ['x'], channelId: 'UC', channelTitle: 'CT' },
      contentDetails: {
        duration: 'PT3M',
        contentRating: { ytRating: 'ytAgeRestricted' },
        regionRestriction: { blocked: ['DE'] },
      },
      topicDetails: { topicCategories: ['t/Pop_music'] },
    },
  });
  assert.deepEqual(info.vA, {
    categoryId: '10',
    ytRating: 'ytAgeRestricted',
    title: 'S',
    tags: ['x'],
    channelId: 'UC',
    channelTitle: 'CT',
    duration_s: 180,
    topics: ['t/Pop_music'],
    region_blocked: ['DE'],
  });
});

test('shapeVideoInfo defaults every field for a bare resource', () => {
  const info = shapeVideoInfo({ vB: {} });
  assert.deepEqual(info.vB, {
    categoryId: null,
    ytRating: null,
    title: '',
    tags: [],
    channelId: null,
    channelTitle: '',
    duration_s: 0,
    topics: [],
    region_blocked: [],
  });
});

test('shapeStatuses extracts the status resource', () => {
  const st = shapeStatuses({
    vA: { status: { privacyStatus: 'public', uploadStatus: 'processed' } },
    vB: {},
  });
  assert.equal(st.vA.privacyStatus, 'public');
  assert.equal(st.vA.uploadStatus, 'processed');
  assert.equal(st.vB.privacyStatus, undefined);
  assert.equal(st.vB.uploadStatus, undefined);
});

test('ownsFrom: owner channel must be in the user channel set', () => {
  assert.equal(ownsFrom(['UC1', 'UC2'], 'UC1'), true);
  assert.equal(ownsFrom(['UC1'], 'UC2'), false);
  assert.equal(ownsFrom([], null), false);
});

test('ytApiMessage surfaces the API reason and a quota hint', () => {
  assert.equal(
    ytApiMessage(403, '{"error":{"message":"Quota exceeded.","errors":[{"reason":"quotaExceeded"}]}}'),
    'YouTube API 403: Quota exceeded. (quotaExceeded) — daily API quota may be exhausted',
  );
  assert.equal(
    ytApiMessage(401, '{"error":{"message":"Invalid Credentials","errors":[{"reason":"authError"}]}}'),
    'YouTube API 401: Invalid Credentials (authError)',
  );
  assert.equal(ytApiMessage(404, 'not json'), 'YouTube API 404');
});
