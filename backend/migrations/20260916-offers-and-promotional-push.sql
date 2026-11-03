ALTER TABLE users ADD COLUMN IF NOT EXISTS promotional_push_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title varchar(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS offer_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deep_link varchar(300);
CREATE INDEX IF NOT EXISTS notifications_promo_frequency_idx ON notifications(user_id, sent_at DESC) WHERE offer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(120) NOT NULL,
  short_description varchar(240) NOT NULL, offer_type varchar(32) NOT NULL,
  discount_value numeric(10,2) NOT NULL DEFAULT 0, maximum_discount_cap integer NOT NULL DEFAULT 0,
  minimum_billing_amount integer NOT NULL DEFAULT 0, eligible_service_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  eligible_customer_segment varchar(32) NOT NULL DEFAULT 'ALL_CUSTOMERS', inactive_days integer NOT NULL DEFAULT 90,
  start_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, promo_code varchar(40), active boolean NOT NULL DEFAULT false,
  usage_limit_per_customer integer NOT NULL DEFAULT 1, deep_link_destination varchar(200) NOT NULL DEFAULT 'offer',
  cta_label varchar(40) NOT NULL DEFAULT 'View Offer', push_title varchar(100) NOT NULL, push_body varchar(220) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_dates_check CHECK (expires_at > start_at),
  CONSTRAINT offers_cap_check CHECK (maximum_discount_cap IN (0,150,250)),
  CONSTRAINT offers_segment_check CHECK (eligible_customer_segment IN ('ALL_CUSTOMERS','RETURNING_CUSTOMERS','INACTIVE_CUSTOMERS')),
  CONSTRAINT offers_type_check CHECK (offer_type IN ('PERCENTAGE','FIXED_DISCOUNT','FREE_ADD_ON','CONSULTATION'))
);
CREATE TABLE IF NOT EXISTS offer_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  claimed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(offer_id,user_id,booking_id)
);
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE offers, offer_claims FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE offers, offer_claims FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE offers, offer_claims FROM authenticated; END IF;
END $$;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES offers(id) ON DELETE RESTRICT;

INSERT INTO offers (title,short_description,offer_type,discount_value,maximum_discount_cap,minimum_billing_amount,eligible_service_categories,eligible_customer_segment,start_at,expires_at,promo_code,active,cta_label,push_title,push_body)
SELECT * FROM (VALUES
 ('Up to ₹150 OFF','Save on an eligible repair booked through the app.','FIXED_DISCOUNT',150,150,999,'["laptop","desktop","mac","virus","upgrade"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','APP150',true,'Book Now','Up to ₹150 OFF on your next repair','Book your next Vfixurpc repair through the app and save up to ₹150 on eligible services.'),
 ('Save up to ₹250','A higher-value benefit for eligible repairs.','FIXED_DISCOUNT',250,250,2499,'["laptop","desktop","mac","upgrade"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','APP250',true,'View Offer','Save up to ₹250 on your repair','Book an eligible repair through the Vfixurpc app and get up to ₹250 OFF.'),
 ('Welcome back offer','Returning customers can save up to ₹150.','FIXED_DISCOUNT',150,150,999,'[]'::jsonb,'RETURNING_CUSTOMERS',now(),now()+interval '60 days','BACK150',true,'Book a Service','Welcome back to Vfixurpc','Book your next eligible service through the app and save up to ₹150.'),
 ('Comeback offer','A special benefit for inactive customers.','FIXED_DISCOUNT',250,250,2499,'[]'::jsonb,'INACTIVE_CUSTOMERS',now(),now()+interval '60 days','RETURN250',true,'Claim Offer','A special offer for your next service','Come back to Vfixurpc and save up to ₹250 on your next eligible app booking.'),
 ('Free Device Health Check','Included with an eligible paid repair.','FREE_ADD_ON',0,0,999,'["laptop","desktop","mac"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','HEALTHCHECK',true,'Book Repair','Complimentary Device Health Check','Book an eligible paid repair through the app and receive a complimentary device health check.'),
 ('Free SSD / RAM Installation','Installation is complimentary when hardware is purchased from Vfixurpc.','FREE_ADD_ON',0,0,0,'["upgrade"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','FREEINSTALL',true,'Upgrade Now','Planning an SSD or RAM upgrade?','Purchase your SSD or RAM through Vfixurpc and get installation complimentary.'),
 ('Diagnosis charge waived','Diagnosis charges are waived when the recommended repair is approved.','FREE_ADD_ON',0,0,0,'["laptop","desktop","mac"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','DIAGFREE',true,'Book Diagnosis','Not sure what is wrong with your device?','Book a diagnosis through the app. Diagnosis charges are waived when you approve the recommended repair.'),
 ('Free Backup & NAS Consultation','Consultation only; hardware and implementation are separate.','CONSULTATION',0,0,0,'["backup"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','NASCONSULT',true,'Book Consultation','Is your important data properly backed up?','Book a complimentary Backup and NAS consultation through the Vfixurpc app.'),
 ('Free Custom PC Consultation','Share your budget and receive a configuration recommendation.','CONSULTATION',0,0,0,'["custom"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','PCCONSULT',true,'Plan My PC','Planning a Custom PC?','Share your budget and usage through the app and get a complimentary Custom PC consultation.'),
 ('Up to ₹150 OFF Security + Performance','For eligible malware cleanup and performance services.','FIXED_DISCOUNT',150,150,999,'["virus"]'::jsonb,'ALL_CUSTOMERS',now(),now()+interval '60 days','SECURE150',true,'Check My PC','Is your PC slow or behaving unusually?','Book an eligible Security + Performance service through the app and save up to ₹150.')
) seeded(title,short_description,offer_type,discount_value,maximum_discount_cap,minimum_billing_amount,eligible_service_categories,eligible_customer_segment,start_at,expires_at,promo_code,active,cta_label,push_title,push_body)
WHERE NOT EXISTS (SELECT 1 FROM offers);
