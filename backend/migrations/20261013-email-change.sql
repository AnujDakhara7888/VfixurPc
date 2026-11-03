CREATE TABLE IF NOT EXISTS email_change_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  new_email varchar(254) NOT NULL,
  digest varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS email_change_challenges_expiry_idx
  ON email_change_challenges(expires_at);

ALTER TABLE email_change_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE email_change_challenges FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON TABLE email_change_challenges FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON TABLE email_change_challenges FROM authenticated;
  END IF;
END $$;
