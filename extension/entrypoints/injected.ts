import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

import { continuationTokenOf, extractAdders } from '@/utils/adders';

/** Safety cap for the continuation chain (~100 items per page). */
const MAX_PAGES = 50;

/**
 * Runs in the page's MAIN world (via injectScript from the content script) so it
 * can read `ytInitialData` AND call the same-origin InnerTube endpoint with the
 * page's own cookies. Large playlists (> ~100 items) render lazily — the adder
 * map is therefore gathered across all continuation pages, then posted back to
 * the isolated content script in ONE message.
 */
export default defineUnlistedScript(() => {
  // Library boundary: `window` has no typed `ytInitialData`/`ytcfg`; read both as unknown.
  const pageWindow = window as unknown as {
    ytInitialData?: unknown;
    ytcfg?: { get?: (key: string) => unknown; data_?: Record<string, unknown> };
  };

  function innertubeConfig(): { key: string | null; clientVersion: string | null } {
    const c = pageWindow.ytcfg;
    const read = (k: string): string | null => {
      const viaGet = typeof c?.get === 'function' ? c.get(k) : undefined;
      if (typeof viaGet === 'string' && viaGet) return viaGet;
      const viaData = c?.data_?.[k];
      return typeof viaData === 'string' && viaData ? viaData : null;
    };
    return { key: read('INNERTUBE_API_KEY'), clientVersion: read('INNERTUBE_CLIENT_VERSION') };
  }

  /** Merge a continuation response's renderers into `merged`. Returns next token. */
  function mergeContinuationPage(json: unknown, merged: Record<string, string>): string | null {
    const page = extractAdders(json);
    Object.assign(merged, page.adders);
    return continuationTokenOf(json);
  }

  async function collectAll(): Promise<{ adders: Record<string, string>; pages: number; truncated: boolean }> {
    const initial = extractAdders(pageWindow.ytInitialData);
    const merged = { ...initial.adders };
    const { key, clientVersion } = innertubeConfig();
    if (!key || !clientVersion) return { adders: merged, pages: 0, truncated: false };

    let token = continuationTokenOf(pageWindow.ytInitialData);
    let pages = 0;
    while (token && pages < MAX_PAGES) {
      let json: unknown = null;
      try {
        const resp = await fetch(`/youtubei/v1/browse?key=${key}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-youtube-client-name': '1',
            'x-youtube-client-version': clientVersion,
          },
          body: JSON.stringify({
            context: { client: { clientName: 'WEB', clientVersion } },
            continuation: token,
          }),
          credentials: 'include',
        });
        if (!resp.ok) break;
        json = await resp.json();
      } catch {
        break; // network hiccup — deliver what we have
      }
      token = mergeContinuationPage(json, merged);
      pages += 1;
    }
    return { adders: merged, pages, truncated: token !== null };
  }

  void collectAll()
    .catch(() => ({ adders: extractAdders(pageWindow.ytInitialData).adders, pages: 0, truncated: false }))
    .then((out) => {
      const owner = extractAdders(pageWindow.ytInitialData).owner;
      window.postMessage(
        {
          source: 'ytpl-adders',
          adders: out.adders,
          owner,
          count: Object.keys(out.adders).length,
          contributors: new Set(Object.values(out.adders)).size,
          pages: out.pages,
          truncated: out.truncated,
        },
        '*',
      );
    });
});
