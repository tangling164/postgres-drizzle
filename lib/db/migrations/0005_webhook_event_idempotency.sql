-- Provider event idempotency prevents repeated lifecycle emails and side effects.
-- Only provider metadata and a payload hash are stored, never the raw payload.

DO $$ BEGIN
  CREATE TYPE webhook_event_status AS ENUM ('processing', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS webhook_events (
  provider        text NOT NULL,
  event_id        text NOT NULL,
  event_type      text NOT NULL,
  payload_sha256  text NOT NULL,
  status          webhook_event_status NOT NULL DEFAULT 'processing',
  attempt_count   integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_status_updated_idx
  ON webhook_events (status, updated_at);
