/**
 * Sign-in session binding: Google client id + YouTube access token in
 * `wxt/storage`, and the `browser.identity.launchWebAuthFlow` orchestration.
 * Pure OAuth helpers come from auth.ts.
 *
 * Why implicit + silent-renew (not PKCE + refresh): a public extension client
 * cannot hold the client secret Google requires at its token endpoint, so we
 * use the implicit flow (access token in the redirect fragment, ~1h) and
 * re-acquire silently (`interactive:false`) when it expires, falling back to an
 * interactive prompt. The redirect URI is `browser.identity.getRedirectURL()`
 * and must be registered on the Google Web client.
 */

import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';

import { buildAuthUrl, isExpired, parseTokenFromRedirect, YT_SCOPE } from './auth.ts';

const clientIdItem = storage.defineItem<string>('local:googleClientId', { fallback: '', version: 1 });
const tokenItem = storage.defineItem<{ accessToken: string; expiry: number } | null>('local:ytToken', {
  fallback: null,
  version: 1,
});

export async function getClientId(): Promise<string> {
  return clientIdItem.getValue();
}
export async function setClientId(id: string): Promise<void> {
  await clientIdItem.setValue(id.trim());
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Run the consent flow and store the access token.
 * @returns the access token, or null if cancelled/failed.
 */
export async function signIn(interactive = true): Promise<string | null> {
  const clientId = await clientIdItem.getValue();
  if (!clientId) throw new Error('No Google client id configured (set it in Options).');

  const redirectUri = browser.identity.getRedirectURL();
  const state = randomState();
  const url = buildAuthUrl({ clientId, redirectUri, scope: YT_SCOPE, state });

  let redirect: string | undefined;
  try {
    redirect = await browser.identity.launchWebAuthFlow({ url, interactive });
  } catch {
    return null; // cancelled, or no interaction allowed during silent renew
  }
  if (!redirect) return null;

  const parsed = parseTokenFromRedirect(redirect);
  if (parsed.error || !parsed.accessToken) return null;
  if (parsed.state !== state) return null; // CSRF guard

  const expiry = Date.now() + (parsed.expiresIn ?? 3600) * 1000;
  await tokenItem.setValue({ accessToken: parsed.accessToken, expiry });
  return parsed.accessToken;
}

/** A valid access token, silently renewed if expired, or null. */
export async function getToken(): Promise<string | null> {
  const tok = await tokenItem.getValue();
  if (tok && !isExpired(tok.expiry)) return tok.accessToken;
  return signIn(false);
}

export async function isSignedIn(): Promise<boolean> {
  const tok = await tokenItem.getValue();
  return tok !== null && !isExpired(tok.expiry);
}

export async function signOut(): Promise<void> {
  await tokenItem.setValue(null);
}

export function redirectUri(): string {
  return browser.identity.getRedirectURL();
}
