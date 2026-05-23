// Identifies a visitor for like-dedup without storing PII.
// Hashes IP + User-Agent + a server-side seed; output is the only thing
// persisted in `likes.visitor_hash`. The raw IP never lands in the DB.

export async function visitorHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ua = request.headers.get('User-Agent') || '';
  const seed = env.DAILY_SALT_SEED || 'dev-fallback-seed';
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${ip}|${ua}|${seed}`)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
export function validSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}
