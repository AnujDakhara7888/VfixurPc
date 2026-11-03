-- Manual, targeted cleanup. No runtime filtering and no subtree deletion.
-- Exact question text is the owner-confirmed test content identifier.
BEGIN;
LOCK TABLE faq_nodes IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE matches integer;
BEGIN
  SELECT count(*) INTO matches FROM faq_nodes WHERE question = 'Why laptop are good to use';
  IF matches > 1 THEN
    RAISE EXCEPTION 'Ambiguous test FAQ: inspect duplicate rows before cleanup';
  END IF;
  IF EXISTS (
    SELECT 1 FROM faq_nodes child JOIN faq_nodes target ON child.parent_id = target.id
    WHERE target.question = 'Why laptop are good to use'
  ) THEN
    RAISE EXCEPTION 'Test FAQ has children: preserve them and review manually';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS faq_test_cleanup_archive (
  id uuid PRIMARY KEY,
  original_row jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE faq_test_cleanup_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON faq_test_cleanup_archive FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON faq_test_cleanup_archive FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON faq_test_cleanup_archive FROM authenticated;
  END IF;
END $$;
WITH removed AS (
  DELETE FROM faq_nodes WHERE question = 'Why laptop are good to use' RETURNING *
)
INSERT INTO faq_test_cleanup_archive (id, original_row)
SELECT id, to_jsonb(removed) FROM removed;
COMMIT;
