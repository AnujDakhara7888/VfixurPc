-- This app uses NestJS authentication and a direct server-side DB connection.
-- Supabase's anon/authenticated roles must not access application tables.
-- Run transactionally, before and again after the owner-workflow migration.
DO $$
DECLARE
 table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY[
  'users', 'devices', 'service_requests', 'status_history', 'issue_selections',
  'quote_items', 'payments', 'invoices', 'notifications', 'delivery_assignments',
  'condition_photos', 'faq_nodes', 'pickup_slots', 'service_definitions',
  'ticket_attachments', 'web_push_subscriptions'
 ] LOOP
  IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
   EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated, PUBLIC', table_name);
  END IF;
 END LOOP;
END $$;

-- New tables created by the backend's migration role must be private by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
