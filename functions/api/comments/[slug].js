import { validSlug, json } from '../../_lib/visitor.js';

const MAX_BODY = 2000;

// GET /api/comments/:slug — list comments oldest→newest, joined with users
// so the response carries a display name per comment.
export async function onRequestGet({ params, env }) {
  if (!validSlug(params.slug)) return json({ error: 'bad slug' }, { status: 400 });

  const rows = await env.DB.prepare(
    `SELECT c.id, c.body, c.created_at, u.display_name AS author
     FROM comments c
     JOIN users u ON u.email = c.email
     WHERE c.slug = ?
     ORDER BY c.created_at ASC`
  )
    .bind(params.slug)
    .all();

  return json({ comments: rows.results || [] });
}

// POST /api/comments/:slug — add a comment. Auth required; the
// `_middleware` populates ctx.data.user from the bv_session JWT.
export async function onRequestPost({ params, request, env, data }) {
  if (!validSlug(params.slug)) return json({ error: 'bad slug' }, { status: 400 });
  if (!data.user) return json({ error: 'auth required' }, { status: 401 });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad json' }, { status: 400 });
  }
  const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
  if (!body) return json({ error: 'empty body' }, { status: 400 });
  if (body.length > MAX_BODY) return json({ error: 'too long' }, { status: 400 });

  const now = Date.now();
  const result = await env.DB.prepare(
    'INSERT INTO comments (slug, email, body, created_at) VALUES (?, ?, ?, ?)'
  )
    .bind(params.slug, data.user.email, body, now)
    .run();

  return json({
    comment: {
      id: result.meta.last_row_id,
      body,
      created_at: now,
      author: data.user.name,
    },
  });
}
