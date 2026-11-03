-- Idempotent guard for columns required by the current production entities.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS referral_discount_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS promotional_push_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS referral_discount_percent integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_referral_discount_percent_check
    CHECK (referral_discount_percent IN (0, 10));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS return_delivery_fee_total integer;

ALTER TABLE service_requests
  DROP CONSTRAINT IF EXISTS service_requests_return_delivery_fee_total_check;

ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_return_delivery_fee_total_check
  CHECK (return_delivery_fee_total IS NULL OR return_delivery_fee_total = 590);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS original_filename varchar,
  ADD COLUMN IF NOT EXISTS uploaded_by varchar;
