-- Behuve Research — D1 schema
-- Apply locally:  wrangler d1 execute behuve-db --local --file=schema.sql
-- Apply to prod:  wrangler d1 execute behuve-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS post_stats (
  slug         TEXT    PRIMARY KEY,
  view_count   INTEGER NOT NULL DEFAULT 0,
  like_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS likes (
  slug          TEXT    NOT NULL,
  visitor_hash  TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (slug, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_likes_slug ON likes(slug);

-- Phase 3: lightweight users. Email is the stable identity across providers;
-- display_name is whatever the OAuth provider gave us (GitHub username, Google
-- name). No passwords, no profile, no onboarding.
CREATE TABLE IF NOT EXISTS users (
  email         TEXT    PRIMARY KEY,
  display_name  TEXT    NOT NULL,
  provider      TEXT    NOT NULL,        -- 'github' | 'google'
  created_at    INTEGER NOT NULL
);

-- Phase 4: comments. Auth-gated insert; reads are public.
CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (email) REFERENCES users(email)
);

CREATE INDEX IF NOT EXISTS idx_comments_slug_created ON comments(slug, created_at);
