import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AUTH_URI, buildAuthUrl, isExpired, parseTokenFromRedirect, YT_SCOPE } from '../utils/auth.ts';

test('buildAuthUrl builds a Google implicit-flow consent URL', () => {
  const url = buildAuthUrl({
    clientId: 'cid.apps.googleusercontent.com',
    redirectUri: 'https://ext-id.chromiumapp.org/',
    scope: YT_SCOPE,
    state: 'st4te',
  });
  assert.ok(url.startsWith(AUTH_URI + '?'));
  const p = new URL(url).searchParams;
  assert.equal(p.get('client_id'), 'cid.apps.googleusercontent.com');
  assert.equal(p.get('redirect_uri'), 'https://ext-id.chromiumapp.org/');
  assert.equal(p.get('response_type'), 'token');
  assert.equal(p.get('scope'), YT_SCOPE);
  assert.equal(p.get('state'), 'st4te');
  assert.equal(p.get('include_granted_scopes'), 'true');
});

test('parseTokenFromRedirect reads the access token from the fragment', () => {
  const parsed = parseTokenFromRedirect(
    'https://ext-id.chromiumapp.org/#access_token=ya29.tok&token_type=Bearer&expires_in=3599&state=abc',
  );
  assert.equal(parsed.accessToken, 'ya29.tok');
  assert.equal(parsed.expiresIn, 3599);
  assert.equal(parsed.state, 'abc');
  assert.equal(parsed.error, undefined);
});

test('parseTokenFromRedirect surfaces errors and missing tokens', () => {
  assert.equal(parseTokenFromRedirect('https://ext-id.chromiumapp.org/#error=access_denied').error, 'access_denied');
  assert.equal(parseTokenFromRedirect('https://ext-id.chromiumapp.org/#foo=bar').error, 'no access_token in redirect');
  assert.equal(parseTokenFromRedirect('not a url').error, 'invalid redirect url');
});

test('isExpired accounts for a renewal skew', () => {
  const now = 1_000_000_000_000;
  assert.equal(isExpired(now + 120_000, now), false); // >1min left
  assert.equal(isExpired(now + 30_000, now), true); // <1min left → renew
  assert.equal(isExpired(now - 1, now), true); // already past
});
