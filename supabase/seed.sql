-- ============================================================
-- SEED DATA for local development
-- ============================================================
-- Note: In local Supabase, auth.users must be created via the Auth API.
-- This seed file populates the application tables assuming auth users exist.
-- Use supabase dashboard or scripts to create auth users first.

-- For local dev, we'll use fixed UUIDs to make relationships predictable.
-- In production, these would come from auth.users.

-- Servants (assumes matching auth.users exist)
-- Admin: Father Mina (priest)
-- INSERT INTO servants (id, first_name, last_name, phone, email, role, regions, preferred_language)
-- VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Fr. Mina', 'Abdel-Malak', '+491234567890', 'fr.mina@stmina.de', 'admin', ARRAY['Munich'], 'ar'),
--   ('00000000-0000-0000-0000-000000000002', 'Sarah', 'Ibrahim', '+491234567891', 'sarah@stmina.de', 'servant', ARRAY['Sendling', 'Westpark'], 'de'),
--   ('00000000-0000-0000-0000-000000000003', 'Mark', 'Girgis', '+491234567892', 'mark@stmina.de', 'servant', ARRAY['Schwabing', 'Maxvorstadt'], 'en'),
--   ('00000000-0000-0000-0000-000000000004', 'Marina', 'Hanna', '+491234567893', 'marina@stmina.de', 'servant', ARRAY['Augsburg'], 'ar');

-- Alert config (singleton)
INSERT INTO alert_config (counted_event_patterns, default_threshold, priority_thresholds, notify_admin)
VALUES (
  ARRAY['Sunday Liturgy', 'Youth Meeting'],
  3,
  '{"high": 1, "medium": 2, "low": 3, "very_low": 5}',
  true
)
ON CONFLICT DO NOTHING;

-- NOTE: Person and attendance seed data requires servant IDs from auth.users.
-- After creating auth users via the Supabase dashboard, uncomment and run:
-- See docs/local-dev.md for full setup instructions.
