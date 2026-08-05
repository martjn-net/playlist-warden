/**
 * YouTube Data API v3 client — token-only, faithful port of web/lib/ytapi.php.
 * Every request is authenticated with the signed-in user's OAuth bearer token
 * (there is no API key). Throws YtApiError on HTTP failure.
 *
 * The pure request-shaping / response-mapping helpers (buildUrl, chunk,
 * entriesFromItems, shapeVideoInfo, shapeStatuses, ownsFrom) are unit-tested;
 * the thin fetch-backed calls are exercised live (needs a real OAuth token).
 */

import { isRecord } from './guards.ts';
import { asString as str, asStringArray as strArray, asStringOrNull as strOrNull } from './coerce.ts';
import { durationSeconds, type PlaylistEntry, type VideoInfo, type VideoStatus } from './checks.ts';

export const YT_API = 'https://www.googleapis.com/youtube/v3';

/** Turn a Google API error body into a readable one-liner (reason + quota hint). */
export function ytApiMessage(status: number, body: string): string {
  let reason = '';
  try {
    const j: unknown = JSON.parse(body);
    if (isRecord(j) && isRecord(j.error)) {
      const err = j.error;
      if (typeof err.message === 'string') reason = err.message;
      if (Array.isArray(err.errors) && isRecord(err.errors[0]) && typeof err.errors[0].reason === 'string') {
        reason = `${reason} (${err.errors[0].reason})`.trim();
      }
    }
  } catch {
    /* non-JSON error body */
  }
  const quota = status === 403 && /quota/i.test(body) ? ' — daily API quota may be exhausted' : '';
  return `YouTube API ${status}${reason ? ': ' + reason : ''}${quota}`;
}

export class YtApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(ytApiMessage(status, body));
    this.name = 'YtApiError';
    this.status = status;
    this.body = body;
  }
}

// --- pure helpers -----------------------------------------------------------

/** Build a request URL, dropping null/empty params (mirrors array_filter). */
export function buildUrl(endpoint: string, params: Record<string, unknown> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return `${YT_API}/${endpoint}${qs ? '?' + qs : ''}`;
}

/** Split ids into fixed-size batches (videos.list allows 50 per call). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}


/** Raw playlistItems → the shared entry schema every check consumes. */
export function entriesFromItems(items: unknown[]): PlaylistEntry[] {
  const entries: PlaylistEntry[] = [];
  for (const item of items) {
    const it = isRecord(item) ? item : {};
    const snip = isRecord(it.snippet) ? it.snippet : {};
    const resourceId = isRecord(snip.resourceId) ? snip.resourceId : {};
    const position = typeof snip.position === 'number' ? snip.position : entries.length;
    entries.push({
      item_id: str(it.id),
      video_id: str(resourceId.videoId),
      title: str(snip.title, '?'),
      position,
      added_at: str(snip.publishedAt),
    });
  }
  return entries;
}

/** videos.list(part=snippet,contentDetails,topicDetails) → per-video info. */
export function shapeVideoInfo(videosById: Record<string, unknown>): Record<string, VideoInfo> {
  const out: Record<string, VideoInfo> = {};
  for (const [vid, raw] of Object.entries(videosById)) {
    const v = isRecord(raw) ? raw : {};
    const s = isRecord(v.snippet) ? v.snippet : {};
    const cd = isRecord(v.contentDetails) ? v.contentDetails : {};
    const td = isRecord(v.topicDetails) ? v.topicDetails : {};
    const rating = isRecord(cd.contentRating) ? cd.contentRating : {};
    const region = isRecord(cd.regionRestriction) ? cd.regionRestriction : {};
    out[vid] = {
      categoryId: strOrNull(s.categoryId),
      ytRating: strOrNull(rating.ytRating),
      title: str(s.title),
      tags: strArray(s.tags),
      channelId: strOrNull(s.channelId),
      channelTitle: str(s.channelTitle),
      duration_s: durationSeconds(str(cd.duration)),
      topics: strArray(td.topicCategories),
      region_blocked: strArray(region.blocked),
    };
  }
  return out;
}

/** videos.list(part=status) → per-video status resource. */
export function shapeStatuses(videosById: Record<string, unknown>): Record<string, VideoStatus> {
  const out: Record<string, VideoStatus> = {};
  for (const [vid, raw] of Object.entries(videosById)) {
    const v = isRecord(raw) ? raw : {};
    const st = isRecord(v.status) ? v.status : {};
    out[vid] = { privacyStatus: strOrNull(st.privacyStatus) ?? undefined, uploadStatus: strOrNull(st.uploadStatus) ?? undefined };
  }
  return out;
}

/** Ownership: does the user's channel set include the playlist owner channel? */
export function ownsFrom(myChannels: string[], ownerChannel: string | null): boolean {
  return ownerChannel !== null && myChannels.includes(ownerChannel);
}

// --- fetch-backed transport (live) ------------------------------------------

async function ytRequest(
  method: string,
  endpoint: string,
  opts: { params?: Record<string, unknown>; token?: string | null; body?: unknown } = {},
): Promise<Record<string, unknown>> {
  const url = buildUrl(endpoint, opts.params ?? {});
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
  let payload: string | undefined;
  if (opts.body != null) {
    payload = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
  }
  if (res.status < 200 || res.status >= 300) {
    throw new YtApiError(res.status, text || 'request failed');
  }
  return isRecord(json) ? json : {};
}

async function paginate(
  endpoint: string,
  params: Record<string, unknown>,
  token: string | null,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let page = '';
  do {
    const data = await ytRequest('GET', endpoint, { params: { ...params, pageToken: page || null }, token });
    if (Array.isArray(data.items)) items.push(...data.items);
    page = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
  } while (page !== '');
  return items;
}

/** {videoId: video resource} for the ids the API still returns (batched by 50). */
export async function videos(
  videoIds: string[],
  part: string,
  token: string | null,
): Promise<Record<string, unknown>> {
  const ids = [...new Set(videoIds.filter((x) => x))];
  const out: Record<string, unknown> = {};
  for (const batch of chunk(ids, 50)) {
    const data = await ytRequest('GET', 'videos', { params: { part, id: batch.join(',') }, token });
    if (Array.isArray(data.items)) {
      for (const v of data.items) {
        if (isRecord(v) && typeof v.id === 'string') out[v.id] = v;
      }
    }
  }
  return out;
}

export async function playlistEntries(playlistId: string, token: string | null): Promise<PlaylistEntry[]> {
  return entriesFromItems(
    await paginate('playlistItems', { part: 'snippet', playlistId, maxResults: 50 }, token),
  );
}

export async function playlistItemsRaw(playlistId: string, token: string | null): Promise<unknown[]> {
  return paginate('playlistItems', { part: 'snippet', playlistId, maxResults: 50 }, token);
}

export async function videoInfo(ids: string[], token: string | null): Promise<Record<string, VideoInfo>> {
  return shapeVideoInfo(await videos(ids, 'snippet,contentDetails,topicDetails', token));
}

export async function videoStatuses(ids: string[], token: string | null): Promise<Record<string, VideoStatus>> {
  return shapeStatuses(await videos(ids, 'status', token));
}

export async function myChannelIds(token: string): Promise<string[]> {
  const data = await ytRequest('GET', 'channels', { params: { part: 'id', mine: 'true', maxResults: 50 }, token });
  const out: string[] = [];
  if (Array.isArray(data.items)) {
    for (const c of data.items) if (isRecord(c) && typeof c.id === 'string') out.push(c.id);
  }
  return out;
}

export interface Ownership {
  owner: boolean;
  ownerChannel: string | null;
  myChannels: string[];
  exists: boolean;
}

export async function ownsPlaylist(playlistId: string, token: string): Promise<Ownership> {
  const mine = await myChannelIds(token);
  const pl = await ytRequest('GET', 'playlists', { params: { part: 'snippet', id: playlistId }, token });
  const item = Array.isArray(pl.items) && isRecord(pl.items[0]) ? pl.items[0] : null;
  const snip = item && isRecord(item.snippet) ? item.snippet : {};
  const ownerChannel = strOrNull(snip.channelId);
  return {
    owner: ownsFrom(mine, ownerChannel),
    ownerChannel,
    myChannels: mine,
    exists: item !== null,
  };
}

// --- write helpers ----------------------------------------------------------

export async function createPlaylist(
  token: string,
  title: string,
  description: string,
  privacy: string,
): Promise<Record<string, unknown>> {
  return ytRequest('POST', 'playlists', {
    params: { part: 'snippet,status' },
    token,
    body: { snippet: { title, description }, status: { privacyStatus: privacy } },
  });
}

export async function deleteItem(itemId: string, token: string): Promise<void> {
  await ytRequest('DELETE', 'playlistItems', { params: { id: itemId }, token });
}

export async function setPosition(
  item: PlaylistEntry,
  position: number,
  playlistId: string,
  token: string,
): Promise<void> {
  await ytRequest('PUT', 'playlistItems', {
    params: { part: 'snippet' },
    token,
    body: {
      id: item.item_id,
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId: item.video_id },
        position,
      },
    },
  });
}
