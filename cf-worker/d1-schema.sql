-- GenWeb D1 schema (replaces Firestore)
-- Run: wrangler d1 execute genweb-db --remote --file=cf-worker/d1-schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  name                TEXT,
  credits             INTEGER NOT NULL DEFAULT 0,
  is_admin            INTEGER NOT NULL DEFAULT 0,
  email_verified      INTEGER NOT NULL DEFAULT 0,
  referral_code       TEXT UNIQUE,
  setup_complete      INTEGER NOT NULL DEFAULT 0,
  preferred_language  TEXT,
  free_build_used     INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

CREATE TABLE IF NOT EXISTS email_otps (
  email           TEXT PRIMARY KEY,
  code_hash       TEXT NOT NULL,
  expires_at      INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users(id),
  status                   TEXT NOT NULL,
  query                    TEXT,
  subdomain                TEXT UNIQUE,
  custom_domain            TEXT,
  is_published             INTEGER NOT NULL DEFAULT 0,
  published_plan           TEXT,
  subscription_start       TEXT,
  subscription_expiry      TEXT,
  is_expired               INTEGER NOT NULL DEFAULT 0,
  pages                    TEXT,
  build_progress           INTEGER NOT NULL DEFAULT 0,
  build_progress_message   TEXT,
  logs                     TEXT,
  url                      TEXT,
  deploy_url               TEXT,
  bucket_url               TEXT,
  style_preset             TEXT,
  user_context             TEXT,
  pipeline                 TEXT NOT NULL DEFAULT 'legacy',
  compile_state            TEXT NOT NULL DEFAULT 'compiled',
  is_free_build            INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT,
  completed_at             TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_subdomain ON projects(subdomain);
CREATE INDEX IF NOT EXISTS idx_projects_custom_domain ON projects(custom_domain);

CREATE TABLE IF NOT EXISTS leads (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  form_data       TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  amount          INTEGER NOT NULL,
  type            TEXT NOT NULL,
  description     TEXT,
  balance_after   INTEGER NOT NULL,
  razorpay_id     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS domains (
  domain          TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  order_id        TEXT,
  provider        TEXT NOT NULL,
  status          TEXT,
  auto_renew      INTEGER NOT NULL DEFAULT 1,
  lb_status       TEXT,
  ip              TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_domains_user ON domains(user_id);

CREATE TABLE IF NOT EXISTS token_usage (
  id              TEXT PRIMARY KEY,
  project_id      TEXT,
  user_id         TEXT NOT NULL,
  model           TEXT,
  service         TEXT,
  action          TEXT,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_created ON token_usage(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_totals (
  project_id      TEXT PRIMARY KEY,
  total_pageviews INTEGER NOT NULL DEFAULT 0,
  total_bandwidth INTEGER NOT NULL DEFAULT 0,
  last_updated    TEXT
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  project_id      TEXT NOT NULL,
  date            TEXT NOT NULL,
  pageviews       INTEGER NOT NULL DEFAULT 0,
  bandwidth       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date)
);

CREATE TABLE IF NOT EXISTS user_stats_totals (
  user_id         TEXT PRIMARY KEY,
  total_pageviews INTEGER NOT NULL DEFAULT 0,
  total_bandwidth INTEGER NOT NULL DEFAULT 0,
  last_updated    TEXT
);

CREATE TABLE IF NOT EXISTS user_stats_daily (
  user_id         TEXT NOT NULL,
  date            TEXT NOT NULL,
  pageviews       INTEGER NOT NULL DEFAULT 0,
  bandwidth       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS referrals (
  id                  TEXT PRIMARY KEY,
  referrer_user_id    TEXT NOT NULL REFERENCES users(id),
  referred_user_id    TEXT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'pending',
  reward_amount       INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT,
  UNIQUE (referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);

CREATE TABLE IF NOT EXISTS platform_config (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updated_at      TEXT,
  updated_by      TEXT
);

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

INSERT OR IGNORE INTO platform_config (key, value, updated_at)
VALUES (
  'general',
  '{"signupGiftCredits":10,"referralEnabled":true,"referralRewardAmount":5,"referralBonusAmount":5}',
  datetime('now')
);

INSERT OR IGNORE INTO platform_config (key, value, updated_at)
VALUES (
  'build_pipeline',
  '{"engine":"legacy","freeFirstBuild":false,"tailwindRuntimeDrafts":false}',
  datetime('now')
);
