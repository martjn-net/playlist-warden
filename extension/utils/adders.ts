/**
 * Pure extraction of the per-video "added by" avatar from a YouTube playlist
 * page's `ytInitialData`. Faithful port of check_playlist_web.py
 * (find_all / added_by / owner / playlist_page). No extension/WXT dependency so
 * it runs under `node --test`.
 *
 * The adder is exposed ONLY as an avatar image overlaid on the item thumbnail
 * (`thumbnailOverlayAvatarStackViewModel`); the ggpht photo id in the URL is the
 * stable per-account contributor key. No name/channelId is present (owner name
 * comes from the header byline). Input is untrusted deep JSON → traversed as
 * `unknown` with narrow guards.
 */

import { isRecord } from './guards.ts';

type Rec = Record<string, unknown>;

/** First `url` string inside a YouTube `sources: [{url}]` node, or null. */
function firstSourceUrl(node: unknown): string | null {
  for (const sources of findAll(node, 'sources')) {
    if (Array.isArray(sources) && isRecord(sources[0])) {
      const url = sources[0].url;
      if (typeof url === 'string') return url;
    }
  }
  return null;
}

/** ggpht photo id embedded in an avatar URL (stable per account). */
function photoIdFromUrl(url: string): string {
  const last = url.split('/').pop() ?? url;
  return last.split('=')[0] ?? '';
}

/** Collect every value stored under `key` anywhere in a nested structure. */
export function findAll(obj: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(obj)) {
    for (const v of obj) findAll(v, key, out);
  } else if (isRecord(obj)) {
    for (const k of Object.keys(obj)) {
      if (k === key) out.push(obj[k]);
      findAll(obj[k], key, out);
    }
  }
  return out;
}

/** Avatar photo id of the account that added the item, or null. */
export function addedBy(item: unknown): string | null {
  if (!isRecord(item) || !Array.isArray(item.thumbnailOverlays)) return null;
  for (const ov of item.thumbnailOverlays) {
    if (!isRecord(ov)) continue;
    const tov = ov.thumbnailOverlayAvatarStackViewModel;
    if (!tov) continue;
    const url = firstSourceUrl(tov);
    if (url) return photoIdFromUrl(url);
  }
  return null;
}

/** playlistVideoRenderer records from the real playlist container(s). */
export function playlistItems(data: unknown): Rec[] {
  const items: Rec[] = [];
  const collect = (contents: unknown): void => {
    if (!Array.isArray(contents)) return;
    for (const c of contents) {
      if (!isRecord(c)) continue;
      const pvr = c.playlistVideoRenderer;
      if (isRecord(pvr)) items.push(pvr);
    }
  };
  for (const plvl of findAll(data, 'playlistVideoListRenderer')) {
    if (isRecord(plvl)) collect(plvl.contents);
  }
  // Continuations already present in the payload; skip recommendation shelves
  // (an appendContinuationItemsAction with no playlistVideoRenderer).
  for (const app of findAll(data, 'appendContinuationItemsAction')) {
    if (!isRecord(app) || !Array.isArray(app.continuationItems)) continue;
    if (!app.continuationItems.some((c) => isRecord(c) && 'playlistVideoRenderer' in c)) continue;
    collect(app.continuationItems);
  }
  return items;
}

export interface Owner {
  name: string | null;
  photoId: string | null;
}

/** Playlist owner from the header byline + first header avatar. */
export function ownerFrom(data: unknown): Owner {
  const header = isRecord(data) ? data.header : undefined;
  let name: string | null = null;
  for (const content of findAll(header, 'content')) {
    if (typeof content === 'string' && content.startsWith('by ')) {
      name = content.slice(3).replace(/\s+and\s+\d+\s+others?$/, '').trim();
      break;
    }
  }
  let photoId: string | null = null;
  const stack = findAll(header, 'avatarStackViewModel')[0];
  if (isRecord(stack) && Array.isArray(stack.avatars) && stack.avatars.length > 0) {
    const url = firstSourceUrl(stack.avatars[0]);
    if (url) photoId = photoIdFromUrl(url);
  }
  return { name, photoId };
}

export interface AdderResult {
  adders: Record<string, string>; // videoId -> avatar photo id
  owner: Owner;
  count: number;
  contributors: number;
}

/** Build {videoId: avatarPhotoId} + owner from ytInitialData. */
export function extractAdders(data: unknown): AdderResult {
  const adders: Record<string, string> = {};
  for (const item of playlistItems(data)) {
    const vid = item.videoId;
    const avatar = addedBy(item);
    if (typeof vid === 'string' && avatar) adders[vid] = avatar;
  }
  return {
    adders,
    owner: ownerFrom(data),
    count: Object.keys(adders).length,
    contributors: new Set(Object.values(adders)).size,
  };
}
