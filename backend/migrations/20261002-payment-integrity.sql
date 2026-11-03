BEGIN;

-- Keep only the newest unfinished gateway order per request before enforcing
-- idempotency. Historical completed/failed/refunded payments are unaffected.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY service_request_id ORDER BY created_at DESC, id DESC
  ) AS position
  FROM payments
  WHERE status = 'PENDING'
)
UPDATE payments
SET status = 'FAILED'
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payments_one_pending_per_request"
  ON payments (service_request_id)
  WHERE status = 'PENDING';

COMMIT;
