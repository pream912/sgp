-- Migration 0002: Genni chat-first redesign
-- Run: wrangler d1 execute genweb-db --remote --file=cf-worker/migrations/0002-genni-redesign.sql
-- Additive-only: safe to apply while the previous server version is still running.

-- users: chat language preference + free first-build entitlement
ALTER TABLE users ADD COLUMN preferred_language TEXT;
ALTER TABLE users ADD COLUMN free_build_used INTEGER NOT NULL DEFAULT 0;

-- projects: which engine built it, CSS state (runtime draft vs compiled), free-build marker
ALTER TABLE projects ADD COLUMN pipeline TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE projects ADD COLUMN compile_state TEXT NOT NULL DEFAULT 'compiled';
ALTER TABLE projects ADD COLUMN is_free_build INTEGER NOT NULL DEFAULT 0;

-- Genni conversations
CREATE TABLE IF NOT EXISTS genni_conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL DEFAULT 'assistant',
  language    TEXT NOT NULL DEFAULT 'en',
  state       TEXT,
  project_id  TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_genni_conv_user ON genni_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS genni_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES genni_conversations(id),
  user_id          TEXT NOT NULL,
  role             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'text',
  content          TEXT,
  meta             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_genni_msgs_conv ON genni_messages(conversation_id, created_at ASC);

-- Backfill: existing users already used their "first build"
UPDATE users SET free_build_used = 1
 WHERE id IN (SELECT DISTINCT user_id FROM projects);

-- Build pipeline flag (engine stays legacy until flipped from admin)
INSERT OR IGNORE INTO platform_config (key, value, updated_at) VALUES
 ('build_pipeline', '{"engine":"legacy","freeFirstBuild":false,"tailwindRuntimeDrafts":false}', datetime('now'));
