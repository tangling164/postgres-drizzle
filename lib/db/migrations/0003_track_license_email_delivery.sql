-- Persist the Resend message ID so support and M1 acceptance can distinguish
-- API acceptance from final mailbox-provider delivery.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS license_email_id text,
  ADD COLUMN IF NOT EXISTS license_email_status text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_license_email_id_unique
  ON orders (license_email_id)
  WHERE license_email_id IS NOT NULL;
