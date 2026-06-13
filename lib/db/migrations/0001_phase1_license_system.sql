-- FormAlert Phase 1 schema (Full_Backend_Spec v4.1 §3.2 / §3.4 / §3.5 / §3.12 / §3.14)
-- Scope: license system only. forms / alert_configs / form_watches / response_deliveries
-- are V2 tables and are intentionally NOT created here (OD-4 PoC adjudication pending).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE plan_tier AS ENUM ('free', 'standard', 'business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE entitlement_status AS ENUM ('active', 'expired', 'exhausted', 'payment_issue', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'revoked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'completed', 'refunded', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE license_status AS ENUM ('pending', 'active', 'revoked', 'expired', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trial_status AS ENUM ('active', 'expired', 'exhausted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- §3.2 accounts
CREATE TABLE IF NOT EXISTS accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_subject      text NOT NULL UNIQUE,
  email               text,
  plan                plan_tier NOT NULL DEFAULT 'free',
  plan_expires_at     timestamptz,
  entitlement_status  entitlement_status NOT NULL DEFAULT 'active',
  status              account_status NOT NULL DEFAULT 'active',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- §3.4 orders (Creem)
CREATE TABLE IF NOT EXISTS orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creem_order_id         text NOT NULL UNIQUE,
  creem_subscription_id  text,
  buyer_email            text NOT NULL,
  plan                   plan_tier NOT NULL,
  billing_cycle          billing_cycle NOT NULL,
  amount_cents           integer NOT NULL DEFAULT 0,
  currency               text NOT NULL DEFAULT 'USD',
  status                 order_status NOT NULL DEFAULT 'pending',
  -- Resend delivery marker: lets Creem webhook retries re-send a failed email
  -- without generating a second license (idempotency stays on creem_order_id).
  license_email_sent_at  timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_subscription_idx ON orders (creem_subscription_id);

-- §3.5 licenses
CREATE TABLE IF NOT EXISTS licenses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash              text NOT NULL UNIQUE,
  order_id               uuid NOT NULL REFERENCES orders (id),
  plan                   plan_tier NOT NULL,
  status                 license_status NOT NULL DEFAULT 'pending',
  activated_account_id   uuid REFERENCES accounts (id),
  activated_at           timestamptz,
  valid_until            timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  cancelled_at           timestamptz,
  creem_subscription_id  text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- §3.5: one active license per account (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS licenses_one_active_per_account
  ON licenses (activated_account_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS licenses_subscription_idx ON licenses (creem_subscription_id);

-- §3.12 free_trials (one-time trial quota, pre-reservation model)
CREATE TABLE IF NOT EXISTS free_trials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL UNIQUE REFERENCES accounts (id),
  started_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  send_limit   integer NOT NULL DEFAULT 30,
  send_used    integer NOT NULL DEFAULT 0,
  status       trial_status NOT NULL DEFAULT 'active',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- §3.14 deleted_accounts (tombstone; no FK — source rows are gone)
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              uuid NOT NULL,
  google_subject_hash     text NOT NULL,
  creem_subscription_ids  text[] NOT NULL DEFAULT '{}',
  reason                  text NOT NULL DEFAULT 'user_request',
  deleted_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deleted_accounts_subject_idx ON deleted_accounts (google_subject_hash);
CREATE INDEX IF NOT EXISTS deleted_accounts_subs_idx ON deleted_accounts USING gin (creem_subscription_ids);

-- §8.3 rate limits (DB-backed fixed window; serverless-safe)
CREATE TABLE IF NOT EXISTS rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
