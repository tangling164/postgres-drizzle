-- Account-level Free send quota reservations for the Local Mode add-on.
-- Stores quota reservation metadata only.

CREATE TABLE IF NOT EXISTS send_reservations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS send_reservations_account_created_idx
  ON send_reservations (account_id, created_at DESC);
