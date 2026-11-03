-- Preserve upload provenance without changing historical invoice rows.
ALTER TABLE invoices
 ADD COLUMN IF NOT EXISTS original_filename varchar,
 ADD COLUMN IF NOT EXISTS uploaded_by varchar;
