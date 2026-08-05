/**
 * Pure Google-OAuth helpers — no extension/WXT dependency, so they run under
 * `node --test`. The storage + `browser.identity` orchestration lives in
 * session.ts (mirrors the schema.ts/store.ts split).
 *
 * Flow: implicit (`response_type=token`) against a Google **Web** OAuth client,
 * driven cross-browser by `browser.identity.launchWebAuthFlow`. Only the YouTube
 * scope is requested (reads + writes go through it). See session.ts for why
 * implicit + silent-renew is used instead of PKCE+refresh.
 */

export const AUTH_URI = 'https://accounts.google.com/o/oauth2/v2/auth';
export const YT_SCOPE = 'https://www.googleapis.com/auth/youtube';

/** Renew this long before the real expiry to avoid mid-request 401s. */
export const EXPIRY_SKEW_MS = 60_000;

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
}): string {
  const p = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'token',
    scope: opts.scope,
    include_granted_scopes: 'true',
    state: opts.state,
    prompt: 'consent',
  });
  return `${AUTH_URI}?${p.toString()}`;
}

export interface ParsedToken {
  accessToken?: string;
  expiresIn?: number;
  state?: string;
  error?: string;
}

/** Parse the access token (or error) from a launchWebAuthFlow redirect URL. */
export function parseTokenFromRedirect(redirectUrl: string): ParsedToken {
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    return { error: 'invalid redirect url' };
  }
  const frag = new URLSearchParams(url.hash.replace(/^#/, ''));
  const error = frag.get('error') ?? url.searchParams.get('error');
  if (error) return { error };
  const accessToken = frag.get('access_token');
  if (!accessToken) return { error: 'no access_token in redirect' };
  const expiresRaw = frag.get('expires_in');
  return {
    accessToken,
    expiresIn: expiresRaw ? parseInt(expiresRaw, 10) : undefined,
    state: frag.get('state') ?? undefined,
  };
}

export function isExpired(expiry: number, now: number = Date.now()): boolean {
  return now >= expiry - EXPIRY_SKEW_MS;
}
