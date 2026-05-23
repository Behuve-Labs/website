import { visitorHash, validSlug, json } from '../../_lib/visitor.js';

async function readState(env, slug, hash) {
  const [stats, liked] = await Promise.all([
    env.DB.prepare('SELECT view_count, like_count FROM post_stats WHERE slug = ?')
      .bind(slug)
      .first(),
    env.DB.prepare('SELECT 1 AS hit FROM likes WHERE slug = ? AND visitor_hash = ?')
      .bind(slug, hash)
      .first(),
  ]);
  return {
    views: stats?.view_count ?? 0,
    likes: stats?.like_count ?? 0,
    liked: !!liked,
  };
}

// POST /api/likes/:slug — toggle the current visitor's like and return new state.
// Dedup is on the (slug, visitor_hash) primary key in `likes`, so the toggle is
// safe under double-clicks: a duplicate INSERT throws, a missing DELETE no-ops.
export async function onRequestPost({ params, request, env }) {
  const slug = params.slug;
  if (!validSlug(slug)) return json({ error: 'bad slug' }, { status: 400 });

  const hash = await visitorHash(request, env);

  const existing = await env.DB.prepare(
    'SELECT 1 AS hit FROM likes WHERE slug = ? AND visitor_hash = ?'
  )
    .bind(slug, hash)
    .first();

  if (existing) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM likes WHERE slug = ? AND visitor_hash = ?')
        .bind(slug, hash),
      env.DB.prepare(
        'UPDATE post_stats SET like_count = MAX(like_count - 1, 0) WHERE slug = ?'
      ).bind(slug),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO post_stats (slug) VALUES (?)')
        .bind(slug),
      env.DB.prepare(
        'UPDATE post_stats SET like_count = like_count + 1 WHERE slug = ?'
      ).bind(slug),
      env.DB.prepare(
        'INSERT INTO likes (slug, visitor_hash, created_at) VALUES (?, ?, ?)'
      ).bind(slug, hash, Date.now()),
    ]);
  }

  return json(await readState(env, slug, hash));
}

// GET /api/likes/:slug — just the like portion of state. Mostly useful for debugging;
// the widget reads state from /api/stats on mount.
export async function onRequestGet({ params, request, env }) {
  if (!validSlug(params.slug)) return json({ error: 'bad slug' }, { status: 400 });
  const hash = await visitorHash(request, env);
  return json(await readState(env, params.slug, hash));
}
