import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

import { extractAdders } from '@/utils/adders';

/**
 * Runs in the page's MAIN world (via injectScript from the content script) so it
 * can read `ytInitialData`, the global YouTube bootstraps the playlist page
 * with. Extracts the adder map and posts it back to the isolated content script.
 */
export default defineUnlistedScript(() => {
  // Library boundary: `window` has no typed `ytInitialData`; read it as unknown.
  const pageWindow = window as unknown as { ytInitialData?: unknown };
  const result = extractAdders(pageWindow.ytInitialData);
  window.postMessage(
    {
      source: 'ytpl-adders',
      adders: result.adders,
      owner: result.owner,
      count: result.count,
      contributors: result.contributors,
    },
    '*',
  );
});
