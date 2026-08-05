import { defineConfig } from 'wxt';

// Cross-browser (chrome | firefox | safari) from one codebase, MV3.
export default defineConfig({
  // Frontend framework for the options page (Svelte 5, small bundle).
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Playlist Warden for YouTube',
    description: 'Fair caps, cleanup & shuffle for shared/collaborative YouTube playlists.',
    // `identity` drives the cross-browser OAuth flow (launchWebAuthFlow);
    // `storage` holds the local store + token. googleapis host = Data API reads/writes.
    permissions: ['storage', 'identity'],
    host_permissions: ['*://www.youtube.com/*', 'https://www.googleapis.com/*'],
    // injected.js runs in the page's MAIN world via injectScript() -> must be
    // web-accessible. WXT downlevels this to the MV2 array form for Firefox.
    web_accessible_resources: [
      { resources: ['injected.js'], matches: ['*://www.youtube.com/*'] },
    ],
  },
});
