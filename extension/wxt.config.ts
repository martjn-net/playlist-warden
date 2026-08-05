import { defineConfig } from 'wxt';

// Chrome extension PUBLIC key for a STABLE extension id across machines/installs
// (testers loading release zips share one OAuth redirect URI). Public by design —
// it ships in every build. The matching .pem PRIVATE key is gitignored and must
// never be committed: it is the identity key that also signs the Web Store upload.
const chromeKey =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyfdg34llFYSfHe8ppCBnDEMwBSQvDWItIQQ2nMkOtRvHYO93y+H6BSoPRMDg+gwdnHPsPdLq8bWZWxhAmPd7LIssDuuL9RtCuaYDGRRIWDVxk2VBjyzG/4u7G0XfV21qitupy+0J4Grh5i9qSIz5spOeNGirxGxfRh4PYfRH18xhk5FumBsxid9+4qE6jeJL1KKF3Z0Jc5hCArhheikiX1+eo2Rk/Krh0/kof9u8TTMqyZpBoDyxqS1fbDLsotCJAVGvLc4ggszaafAZUAPVmlojiTmFPanDT0zJzMuz3mLrqWw/xGAcRKRXbhWpCF9GxMC18Im+0M/FEw/vAnKHxQIDAQAB';

// Cross-browser (chrome | firefox | safari) from one codebase, MV3.
export default defineConfig({
  // Frontend framework for the options page (Svelte 5, small bundle).
  modules: ['@wxt-dev/module-svelte'],
  manifest: ({ browser }) => ({
    name: 'Playlist Warden for YouTube',
    description: 'Fair caps, cleanup & shuffle for shared/collaborative YouTube playlists.',
    // `identity` drives the cross-browser OAuth flow (launchWebAuthFlow);
    // `storage` holds the local store + token. googleapis host = Data API reads/writes.
    permissions: ['storage', 'identity', 'alarms', 'notifications'],
    host_permissions: ['*://www.youtube.com/*', 'https://www.googleapis.com/*'],
    // injected.js runs in the page's MAIN world via injectScript() -> must be
    // web-accessible. WXT downlevels this to the MV2 array form for Firefox.
    web_accessible_resources: [{ resources: ['injected.js'], matches: ['*://www.youtube.com/*'] }],
    // CWS: 128x128 artwork is 96x96 + 16px padding (see store-assets/generate-store-assets.py).
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      96: 'icons/icon-96.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
    ...(browser === 'chrome' ? { key: chromeKey } : {}),
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: 'playlist-warden@martjn.net' } } }
      : {}),
  }),
});
