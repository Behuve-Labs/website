// Shared "start OAuth flow" implementation used by /api/auth/github and
// /api/auth/google. Generates a CSRF state token, stashes it + the return URL
// in HttpOnly cookies, then 302s the browser to the provider.

import { buildCookie } from '../../_lib/cookies.js';

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const PROVIDERS = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scope: 'read:user user:email',
    clientIdEnv: 'GITHUB_CLIENT_ID',
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    extra: { response_type: 'code', access_type: 'online', prompt: 'select_account' },
  },
};

export async function startOAuth(provider, { request, env }) {
  const cfg = PROVIDERS[provider];
  if (!cfg) return new Response('unknown provider', { status: 400 });
  const clientId = env[cfg.clientIdEnv];
  if (!clientId) return new Response(`missing ${cfg.clientIdEnv}`, { status: 500 });

  const url = new URL(request.url);
  const state = randomToken();
  const returnTo = sanitizeReturn(url.searchParams.get('return'));

  const authorize = new URL(cfg.authorizeUrl);
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set(
    'redirect_uri',
    `${url.origin}/api/auth/callback/${provider}`
  );
  authorize.searchParams.set('scope', cfg.scope);
  authorize.searchParams.set('state', state);
  if (cfg.extra) for (const [k, v] of Object.entries(cfg.extra)) authorize.searchParams.set(k, v);

  const headers = new Headers({ Location: authorize.toString() });
  const cookieOpts = { maxAge: 600, secureFromUrl: request.url };
  headers.append('Set-Cookie', buildCookie('bv_oauth_state', state, cookieOpts));
  headers.append('Set-Cookie', buildCookie('bv_oauth_return', encodeURIComponent(returnTo), cookieOpts));
  return new Response(null, { status: 302, headers });
}

// Refuse off-site return URLs — must be a same-origin path.
function sanitizeReturn(input) {
  if (!input) return '/';
  if (!input.startsWith('/') || input.startsWith('//')) return '/';
  return input;
}
