import { visitorHash, validSlug, json } from '../../_lib/visitor.js';

// Parse a `Cookie` header into a plain object.
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

// Single source of truth for the page-state response shape.
async function readState(env, slug, hash) {
  const [stats, liked] = await Promise.all([
    env.DB.prepare(
      'SELECT view_count, like_count FROM post_stats WHERE slug = ?'
    )
      .bind(slug)
      .first(),
    env.DB.prepare(
      'SELECT 1 AS hit FROM likes WHERE slug = ? AND visitor_hash = ?'
    )
      .bind(slug, hash)
      .first(),
  ]);
  return {
    views: stats?.view_count ?? 0,
    likes: stats?.like_count ?? 0,
    liked: !!liked,
  };
}

// GET /api/stats/:slug — read-only state.
export async function onRequestGet({ params, request, env }) {
  if (!validSlug(params.slug)) return json({ error: 'bad slug' }, { status: 400 });
  const hash = await visitorHash(request, env);
  return json(await readState(env, params.slug, hash));
}

// POST /api/stats/:slug — record a view (cookie-deduped per slug per day),
// then return state. Idempotent within the dedup window.
export async function onRequestPost({ params, request, env }) {
  const slug = params.slug;
  if (!validSlug(slug)) return json({ error: 'bad slug' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const cookieName = `bv_v_${slug.replace(/[^a-z0-9-]/gi, '')}`;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const alreadyViewed = cookies[cookieName] === today;

  if (!alreadyViewed) {
    await env.DB.prepare(
      `INSERT INTO post_stats (slug, view_count) VALUES (?, 1)
       ON CONFLICT(slug) DO UPDATE SET view_count = view_count + 1`
    )
      .bind(slug)
      .run();
  }

  const hash = await visitorHash(request, env);
  const state = await readState(env, slug, hash);

  const headers = {};
  if (!alreadyViewed) {
    headers['Set-Cookie'] =
      `${cookieName}=${today}; Path=/; Max-Age=86400; SameSite=Lax`;
  }
  return json(state, { headers });
}
