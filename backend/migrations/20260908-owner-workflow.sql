-- Apply once before deploying the updated backend. Existing records are preserved.
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'REQUEST_RECEIVED';
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'DIAGNOSING';
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'QUOTE_APPROVED';
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'QUOTE_REJECTED';
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'AWAITING_PARTS';
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'TESTING';
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'READY_FOR_HANDOVER';
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'CANCELLED';
-- TypeORM creates a separate enum for each history column.
DO $$
DECLARE
 enum_name text;
 status_value text;
BEGIN
 FOREACH enum_name IN ARRAY ARRAY['status_history_from_status_enum', 'status_history_to_status_enum'] LOOP
  FOREACH status_value IN ARRAY ARRAY['REQUEST_RECEIVED', 'DIAGNOSING', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'AWAITING_PARTS', 'TESTING', 'READY_FOR_HANDOVER', 'CANCELLED'] LOOP
   EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, status_value);
  END LOOP;
 END LOOP;
END $$;
ALTER TABLE service_requests
 ADD COLUMN IF NOT EXISTS service_category varchar,
 ADD COLUMN IF NOT EXISTS service_mode varchar NOT NULL DEFAULT 'PICKUP',
 ADD COLUMN IF NOT EXISTS booking_answers jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS policy_version varchar,
 ADD COLUMN IF NOT EXISTS consented_at timestamptz,
 ADD COLUMN IF NOT EXISTS quote_version integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS quote_archive jsonb NOT NULL DEFAULT '[]';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id) WHERE read_at IS NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_data bytea,
 ADD COLUMN IF NOT EXISTS document_kind varchar NOT NULL DEFAULT 'Invoice',
 ADD COLUMN IF NOT EXISTS original_filename varchar,
 ADD COLUMN IF NOT EXISTS uploaded_by varchar;
ALTER TABLE condition_photos ADD COLUMN IF NOT EXISTS file_data bytea;
CREATE TABLE IF NOT EXISTS service_definitions (id varchar PRIMARY KEY, definition jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS ticket_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service_request_id uuid NOT NULL REFERENCES service_requests(id),
 caption varchar NOT NULL,
 mime varchar NOT NULL,
 uploaded_by varchar NOT NULL,
 file_data bytea NOT NULL,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_attachments_request_idx ON ticket_attachments(service_request_id);
