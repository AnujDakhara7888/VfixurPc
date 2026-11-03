-- Give legacy active offers explicit customer-entered codes.
UPDATE offers
SET promo_code = CASE title
  WHEN 'Free Device Health Check' THEN 'HEALTHCHECK'
  WHEN 'Free SSD / RAM Installation' THEN 'FREEINSTALL'
  WHEN 'Diagnosis charge waived' THEN 'DIAGFREE'
  WHEN 'Free Backup & NAS Consultation' THEN 'NASCONSULT'
  WHEN 'Free Custom PC Consultation' THEN 'PCCONSULT'
END
WHERE promo_code IS NULL
  AND title IN (
    'Free Device Health Check',
    'Free SSD / RAM Installation',
    'Diagnosis charge waived',
    'Free Backup & NAS Consultation',
    'Free Custom PC Consultation'
  );

CREATE UNIQUE INDEX IF NOT EXISTS offers_promo_code_unique_idx
  ON offers (UPPER(promo_code))
  WHERE promo_code IS NOT NULL;
