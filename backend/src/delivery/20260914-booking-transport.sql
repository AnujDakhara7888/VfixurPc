-- Apply after the parent booking migration. No assigned per-device tasks are changed.
BEGIN;
CREATE TABLE IF NOT EXISTS booking_transport_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  request_ids uuid[] NOT NULL CHECK (cardinality(request_ids) > 0),
  direction varchar(10) NOT NULL CHECK (direction IN ('PICKUP', 'RETURN')),
  status varchar(16) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ASSIGNED', 'COMPLETED', 'CANCELLED')),
  agent_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  scheduled_date date,
  scheduled_slot varchar(80),
  version integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid,
  received_by varchar(120),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_booking_transport_direction" UNIQUE (booking_id, direction)
);
ALTER TABLE booking_transport_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_transport_tasks FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON booking_transport_tasks FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON booking_transport_tasks FROM authenticated;
  END IF;
END $$;
COMMIT;
