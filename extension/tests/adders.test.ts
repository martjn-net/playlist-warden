import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addedBy, continuationTokenOf, extractAdders, findAll, ownerFrom } from '../utils/adders.ts';

/** Minimal synthetic ytInitialData mirroring the real nesting we depend on. */
function avatarNode(photoId: string): unknown {
  return {
    avatarViewModel: { image: { sources: [{ url: `https://yt3.ggpht.com/${photoId}=s48-c-k-c0x00ffffff-no-rj` }] } },
  };
}

function videoRenderer(videoId: string, adderPhoto: string | null): unknown {
  const overlays = adderPhoto
    ? [{ thumbnailOverlayAvatarStackViewModel: { avatars: [avatarNode(adderPhoto)] } }]
    : [];
  return { playlistVideoRenderer: { videoId, thumbnailOverlays: overlays } };
}

function fixture(): unknown {
  return {
    header: {
      pageHeaderRenderer: {
        byline: { text: { content: 'by Martjn and 1 other' } },
        avatar: { avatarStackViewModel: { avatars: [avatarNode('OWNERPHOTO')] } },
      },
    },
    contents: {
      playlistVideoListRenderer: {
        contents: [
          videoRenderer('vidA', 'PHOTO_OWNER'),
          videoRenderer('vidB', 'PHOTO_COLLAB'),
          videoRenderer('vidC', 'PHOTO_OWNER'),
          videoRenderer('vidNoAdder', null),
        ],
      },
    },
  };
}

test('extractAdders maps videoId -> avatar photo id (skips items without an adder)', () => {
  const r = extractAdders(fixture());
  assert.deepEqual(r.adders, {
    vidA: 'PHOTO_OWNER',
    vidB: 'PHOTO_COLLAB',
    vidC: 'PHOTO_OWNER',
  });
  assert.equal(r.count, 3);
  assert.equal(r.contributors, 2);
});

test('ownerFrom reads byline name and first header avatar', () => {
  const o = ownerFrom(fixture());
  assert.equal(o.name, 'Martjn');
  assert.equal(o.photoId, 'OWNERPHOTO');
});

test('addedBy returns null when there is no avatar overlay', () => {
  assert.equal(addedBy({ videoId: 'x', thumbnailOverlays: [] }), null);
  assert.equal(addedBy({}), null);
  assert.equal(addedBy(null), null);
});

test('findAll collects nested values by key', () => {
  assert.deepEqual(findAll({ a: 1, b: { a: 2, c: [{ a: 3 }] } }, 'a'), [1, 2, 3]);
});

test('empty / malformed data yields empty result, no throw', () => {
  assert.deepEqual(extractAdders({}).adders, {});
  assert.deepEqual(extractAdders(null).adders, {});
  assert.deepEqual(extractAdders(undefined).owner, { name: null, photoId: null });
});

test('continuationTokenOf: finds the trailing continuation token, null without one', () => {
  const payload = {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [{
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [{
                  itemSectionRenderer: {
                    contents: [{
                      playlistVideoListRenderer: {
                        contents: [
                          { playlistVideoRenderer: { videoId: 'v1' } },
                          { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'TOK123' } } } },
                        ],
                      },
                    }],
                  },
                }],
              },
            },
          },
        }],
      },
    },
  };
  assert.equal(continuationTokenOf(payload), 'TOK123');
  assert.equal(continuationTokenOf({ playlistVideoListRenderer: { contents: [{ playlistVideoRenderer: {} }] } }), null);
  assert.equal(continuationTokenOf(null), null);
});

test('extractAdders also reads appendContinuationItemsAction pages', () => {
  const page = {
    onResponseReceivedActions: [{
      appendContinuationItemsAction: {
        continuationItems: [
          {
            playlistVideoRenderer: {
              videoId: 'vid-new',
              lengthSeconds: 1,
              thumbnailOverlays: [
                { thumbnailOverlayAvatarStackViewModel: { avatars: [{ avatarViewModel: { image: { sources: [{ url: 'https://yt3.ggpht.com/PH_TN_ID=s64' }] } } }] } },
              ],
            },
          },
          { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'NEXT' } } } },
        ],
      },
    }],
  };
  const out = extractAdders(page);
  assert.equal(out.adders['vid-new'], 'PH_TN_ID');
  assert.equal(continuationTokenOf(page), 'NEXT');
});
