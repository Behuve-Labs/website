// OAuth callback for both providers. Verifies the CSRF state cookie matches
// the `?state=` query param, exchanges the `?code=` for an access token,
// fetches the user's email + display name, upserts the `users` row, mints a
// JWT, sets the session cookie, and redirects back to the original page.

import { parseCookies, buildCookie, clearCookieHeader } from '../../../_lib/cookies.js';
import { signJwt } from '../../../_lib/jwt.js';

const SESSION_DAYS = 30;

export async function onRequestGet({ params, request, env }) {
  const provider = params.provider;
  if (provider !== 'github' && provider !== 'google') {
    return new Response('unknown provider', { status: 400 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateQ = url.searchParams.get('state');
  if (!code || !stateQ) return new Response('missing code/state', { status: 400 });

  const cookies = parseCookies(request.headers.get('Cookie'));
  if (stateQ !== cookies.bv_oauth_state) {
    return new Response('state mismatch', { status: 400 });
  }

  let userInfo;
  try {
    userInfo = provider === 'github'
      ? await exchangeGithub(code, env)
      : await exchangeGoogle(code, env, url.origin);
  } catch (err) {
    return new Response(`oauth exchange failed: ${err.message}`, { status: 502 });
  }

  const { email, name } = userInfo;
  if (!email) return new Response('no email from provider', { status: 502 });

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO users (email, display_name, provider, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name`
  )
    .bind(email, name, provider, now)
    .run();

  const iat = Math.floor(now / 1000);
  const jwt = await signJwt(
    {
      sub: email,
      name,
      provider,
      iat,
      exp: iat + 60 * 60 * 24 * SESSION_DAYS,
    },
    env.JWT_SECRET
  );

  const returnTo = decodeURIComponent(cookies.bv_oauth_return || '/');
  const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

  const headers = new Headers({ Location: safeReturn });
  headers.append(
    'Set-Cookie',
    buildCookie('bv_session', jwt, {
      maxAge: 60 * 60 * 24 * SESSION_DAYS,
      secureFromUrl: request.url,
    })
  );
  headers.append('Set-Cookie', clearCookieHeader('bv_oauth_state'));
  headers.append('Set-Cookie', clearCookieHeader('bv_oauth_return'));
  return new Response(null, { status: 302, headers });
}

async function exchangeGithub(code, env) {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenBody = await tokenRes.json();
  if (!tokenBody.access_token) throw new Error(tokenBody.error_description || 'no token');

  const authHeaders = {
    'Authorization': `Bearer ${tokenBody.access_token}`,
    'User-Agent': 'Behuve-Research',
    'Accept': 'application/vnd.github+json',
  };

  const profile = await (await fetch('https://api.github.com/user', { headers: authHeaders })).json();

  // Profile email is often null when the user has email privacy on.
  let email = profile.email;
  if (!email) {
    const emails = await (
      await fetch('https://api.github.com/user/emails', { headers: authHeaders })
    ).json();
    if (Array.isArray(emails)) {
      const primary = emails.find((e) => e.primary && e.verified)
        || emails.find((e) => e.verified);
      email = primary?.email;
    }
  }

  return {
    email,
    // GitHub `name` can be blank; the login (handle) always exists.
    name: profile.name?.trim() || profile.login,
  };
}

async function exchangeGoogle(code, env, origin) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${origin}/api/auth/callback/google`,
    }),
  });
  const tokenBody = await tokenRes.json();
  if (!tokenBody.access_token) throw new Error(tokenBody.error_description || 'no token');

  const profile = await (
    await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenBody.access_token}` },
    })
  ).json();

  return {
    email: profile.email,
    name: profile.given_name || profile.name || profile.email?.split('@')[0],
  };
}
