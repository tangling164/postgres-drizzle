-- Retire every pre-cutover Test license before accepting email-only formal codes.
-- Safety: the migration aborts instead of downgrading an activated account.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM licenses
    WHERE created_at < timestamptz '2026-06-14 04:00:00+00'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Pre-cutover active license found; review before retiring Test licenses';
  END IF;
END $$;

UPDATE licenses
SET status = 'revoked',
    cancelled_at = COALESCE(cancelled_at, now())
WHERE created_at < timestamptz '2026-06-14 04:00:00+00'
  AND status = 'pending';
