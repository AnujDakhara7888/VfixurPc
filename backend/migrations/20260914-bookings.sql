BEGIN;
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES users(id),
  reference varchar NOT NULL UNIQUE,
  service_mode varchar NOT NULL,
  transport_base integer NOT NULL DEFAULT 0 CHECK (transport_base >= 0),
  transport_tax integer NOT NULL DEFAULT 0 CHECK (transport_tax >= 0),
  fee_policy_version varchar NOT NULL,
  accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings(customer_id);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bookings FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON bookings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON bookings FROM authenticated;
  END IF;
END $$;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS booking_position integer;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS rejection_fee_total integer;
CREATE INDEX IF NOT EXISTS service_requests_booking_idx ON service_requests(booking_id);
COMMIT;
