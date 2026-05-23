// Cookie helpers used across all Functions.

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

// Builds a Set-Cookie header value. `secureFromUrl` adds the Secure flag iff
// the request is HTTPS — so cookies still work over http://localhost in dev.
export function buildCookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  if (opts.secureFromUrl) {
    const proto = new URL(opts.secureFromUrl).protocol;
    if (proto === 'https:') parts.push('Secure');
  } else if (opts.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function clearCookieHeader(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
