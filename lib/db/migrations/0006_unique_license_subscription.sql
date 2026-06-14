-- A Creem subscription owns at most one open FormAlert license. Revoked,
-- expired, and superseded rows remain as immutable history.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM licenses
    WHERE creem_subscription_id IS NOT NULL
      AND status IN ('pending', 'active')
    GROUP BY creem_subscription_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Creem subscriptions found; review licenses before applying 0006';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS licenses_one_per_subscription
  ON licenses (creem_subscription_id)
  WHERE creem_subscription_id IS NOT NULL
    AND status IN ('pending', 'active');
