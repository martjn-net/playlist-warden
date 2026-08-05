import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { browser } from 'wxt/browser';

import { store } from '@/utils/store';
import { isRecord } from '@/utils/guards';
import { RUN_PORT } from '@/utils/messages';

interface AdderMessage {
  source: 'ytpl-adders';
  adders: Record<string, string>;
  owner: { name: string | null; photoId: string | null };
  count: number;
  contributors: number;
  pages?: number; // continuation requests made (0 = initial payload only)
  truncated?: boolean; // page cap reached before the continuation chain ended
}

const BUTTON_ID = 'ytpl-copy-adders';

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  runAt: 'document_idle',
  main() {
    // Ask the MAIN world for the adder map (it can read `ytInitialData`).
    function readAdders(): Promise<AdderMessage | null> {
      const { promise, resolve } = Promise.withResolvers<AdderMessage | null>();
      const onMessage = (event: MessageEvent<unknown>): void => {
        if (event.source !== window) return;
        const data = event.data;
        if (!isRecord(data) || data.source !== 'ytpl-adders' || !isRecord(data.adders)) return;
        window.removeEventListener('message', onMessage);
        const adders: Record<string, string> = {};
        for (const [videoId, avatar] of Object.entries(data.adders)) {
          if (typeof avatar === 'string') adders[videoId] = avatar;
        }
        const owner = isRecord(data.owner) ? data.owner : {};
        resolve({
          source: 'ytpl-adders',
          adders,
          owner: {
            name: typeof owner.name === 'string' ? owner.name : null,
            photoId: typeof owner.photoId === 'string' ? owner.photoId : null,
          },
          count: Object.keys(adders).length,
          contributors: new Set(Object.values(adders)).size,
        });
      };
      window.addEventListener('message', onMessage);
      void injectScript('/injected.js', { keepInDom: false });
      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, 4000);
      return promise;
    }

    function currentPlaylistId(): string {
      return new URLSearchParams(location.search).get('list') ?? '';
    }

    let running = false;

    async function runChain(button: HTMLButtonElement): Promise<void> {
      const pid = currentPlaylistId();
      if (!pid || running) return;
      running = true;
      button.disabled = true;
      const finish = (): void => {
        setTimeout(() => {
          running = false;
          button.disabled = false;
          button.textContent = 'Run maintenance';
        }, 6000);
      };
      try {
        button.textContent = 'Reading adders…';
        const message = await readAdders();
        if (!message || message.count === 0) {
          button.textContent = 'No adders (logged in & collaborative?)';
          finish();
          return;
        }
        button.textContent = `Saving ${message.contributors} contributors…`;
        await store.mergeAdders(pid, message.adders);
        await store.upsertPlaylist({ id: pid, title: document.title.replace(/ - YouTube$/, '') });

        if (!confirm('Run full maintenance on THIS playlist now?\nApplies cap, prune and shuffle — deletes/reorders on YouTube.')) {
          button.textContent = `Saved · ${message.contributors} contributors (chain cancelled)`;
          finish();
          return;
        }

        button.textContent = 'Starting…';
        const port = browser.runtime.connect({ name: RUN_PORT });
        port.onMessage.addListener((m: unknown) => {
          if (!isRecord(m)) return;
          if (typeof m.text === 'string') button.textContent = m.text;
          if (m.phase === 'done') {
            port.disconnect();
            // reload so deletions/reorder show; keep the short final text briefly
            button.textContent = typeof m.text === 'string' ? m.text : 'Done';
            setTimeout(() => location.reload(), 1500);
            return;
          }
          if (m.phase === 'error') {
            port.disconnect();
            finish();
          }
        });
        port.postMessage({ playlistId: pid });
      } catch (e) {
        button.textContent = 'Error: ' + (e instanceof Error ? e.message : 'failed');
        finish();
      }
    }

    // Embed the button in YouTube's playlist action row (Play all / Shuffle / …).
    // There are TWO `yt-flexible-actions-view-model` in the DOM (inline + sidebar
    // layout variants) — only one is visible, so pick that one. YouTube re-renders
    // and may drop foreign nodes, so we cache the node and let the MutationObserver
    // re-insert it instantly. Fallback: fixed pill bottom-right if no row is found.
    let theButton: HTMLButtonElement | null = null;

    function makeButton(): HTMLButtonElement {
      const b = document.createElement('button');
      b.id = BUTTON_ID;
      b.type = 'button';
      b.textContent = 'Run maintenance';
      b.addEventListener('click', () => void runChain(b));
      return b;
    }

    function styleUnder(b: HTMLButtonElement): void {
      b.style.cssText =
        'display:block;max-width:100%;box-sizing:border-box;margin:12px 0 4px;height:36px;padding:0 16px;' +
        'border:0;border-radius:18px;cursor:pointer;color:#fff;background:#e94560;' +
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 14px/36px 'Roboto',system-ui,sans-serif;";
    }
    function styleFloating(b: HTMLButtonElement): void {
      b.style.cssText =
        'position:fixed;z-index:2147483647;bottom:16px;right:16px;padding:10px 16px;border:0;' +
        'border-radius:18px;cursor:pointer;color:#fff;background:#e94560;' +
        "font:500 14px/1 'Roboto',system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);";
    }

    // The visible action view-model (the other layout variant is hidden).
    function visibleActions(): Element | null {
      for (const el of document.querySelectorAll('yt-flexible-actions-view-model')) {
        if (el.getClientRects().length > 0) return el;
      }
      return null;
    }

    function place(): void {
      const active =
        location.pathname === '/playlist' && new URLSearchParams(location.search).has('list');
      if (!active) {
        theButton?.remove();
        return;
      }
      theButton ??= makeButton();
      const host = visibleActions();
      if (host?.parentElement) {
        // own line, directly UNDER the whole action row
        if (host.nextElementSibling !== theButton) {
          styleUnder(theButton);
          host.insertAdjacentElement('afterend', theButton);
        }
      } else if (theButton.parentElement !== document.body) {
        styleFloating(theButton);
        document.body.appendChild(theButton);
      }
    }

    // Debounce to once per frame; YouTube mutates the DOM a lot.
    let scheduled = false;
    function schedule(): void {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        place();
      });
    }

    new MutationObserver(() => schedule()).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('yt-navigate-finish', () => schedule());
    schedule();
  },
});
