ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS return_delivery_fee_total integer;

ALTER TABLE service_requests
  DROP CONSTRAINT IF EXISTS service_requests_return_delivery_fee_total_check;

ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_return_delivery_fee_total_check
  CHECK (return_delivery_fee_total IS NULL OR return_delivery_fee_total = 590);
