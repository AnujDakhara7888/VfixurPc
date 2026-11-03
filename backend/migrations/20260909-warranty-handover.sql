BEGIN;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS handover_method varchar;
CREATE TABLE IF NOT EXISTS repair_warranties (
  service_request_id uuid PRIMARY KEY REFERENCES service_requests(id) ON DELETE CASCADE,
  starts_on date NOT NULL, ends_on date NOT NULL CHECK (ends_on >= starts_on),
  coverage text NOT NULL, updated_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  description text NOT NULL,
  status varchar NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','IN_PROGRESS','DECLINED','RESOLVED')),
  coverage_snapshot jsonb NOT NULL, history jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warranty_claims_ticket ON warranty_claims(service_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS warranty_claims_one_open ON warranty_claims(service_request_id) WHERE status IN ('REQUESTED','IN_PROGRESS');
ALTER TABLE repair_warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON repair_warranties, warranty_claims FROM anon, authenticated;
COMMIT;
