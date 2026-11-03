BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS referral_discount_used_at timestamptz;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS referral_discount_percent integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_referral_discount_percent_check
    CHECK (referral_discount_percent IN (0, 10));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
