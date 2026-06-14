-- Maps alternate Creem order/transaction identifiers to the canonical order
-- that owns the subscription license. This preserves refund handling when
-- paid events arrive out of order with different identifiers.

CREATE TABLE IF NOT EXISTS creem_order_aliases (
  creem_order_id  text PRIMARY KEY,
  order_id        uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creem_order_aliases_order_idx
  ON creem_order_aliases (order_id);
