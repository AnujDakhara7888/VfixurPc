ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS promotional_whatsapp_opt_in boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS login_otp_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  digest varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS login_otp_challenges_user_idx ON login_otp_challenges(user_id, requested_at DESC);
ALTER TABLE login_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE login_otp_challenges FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE login_otp_challenges FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE login_otp_challenges FROM authenticated; END IF;
END $$;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS whatsapp_template_name varchar(120),
  ADD COLUMN IF NOT EXISTS whatsapp_language varchar(12) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS whatsapp_parameters jsonb NOT NULL DEFAULT '[]'::jsonb;
