CREATE TABLE IF NOT EXISTS registration_otp_challenges (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(16) NOT NULL,
  username varchar(80) NOT NULL,
  password_hash varchar(255) NOT NULL,
  date_of_birth date,
  referral_username varchar(80),
  digest varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS registration_otp_phone_idx
  ON registration_otp_challenges(phone, requested_at DESC);
CREATE INDEX IF NOT EXISTS registration_otp_expiry_idx
  ON registration_otp_challenges(expires_at);

ALTER TABLE registration_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE registration_otp_challenges FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON TABLE registration_otp_challenges FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON TABLE registration_otp_challenges FROM authenticated;
  END IF;
END $$;
