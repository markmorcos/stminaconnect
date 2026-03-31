-- ============================================================
-- SEED DATA for local development
-- ============================================================
-- Note: In local Supabase, auth.users must be created via the Auth API.
-- This seed file populates the application tables assuming auth users exist.
-- Use supabase dashboard or `scripts/seed-auth-users.ts` to create auth users first.
--
-- Fixed UUIDs for predictable local development.
-- ============================================================

-- ============================================================
-- Servants
-- ============================================================
-- 2 admins, 3 servants, spread across languages/regions.
-- Uncomment after creating matching auth.users (see docs/local-dev.md)

-- INSERT INTO servants (id, first_name, last_name, phone, email, role, regions, preferred_language)
-- VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Fr. Mina',  'Abdel-Malak', '+491000000001', 'fr.mina@stmina.de',   'admin',   ARRAY['Munich'],                  'ar'),
--   ('00000000-0000-0000-0000-000000000002', 'Deacon',    'Bishoy',      '+491000000002', 'bishoy@stmina.de',    'admin',   ARRAY['Munich', 'Augsburg'],      'en'),
--   ('00000000-0000-0000-0000-000000000003', 'Sarah',     'Ibrahim',     '+491000000003', 'sarah@stmina.de',     'servant', ARRAY['Sendling', 'Westpark'],    'de'),
--   ('00000000-0000-0000-0000-000000000004', 'Mark',      'Girgis',      '+491000000004', 'mark@stmina.de',      'servant', ARRAY['Schwabing', 'Maxvorstadt'],'en'),
--   ('00000000-0000-0000-0000-000000000005', 'Marina',    'Hanna',       '+491000000005', 'marina@stmina.de',    'servant', ARRAY['Augsburg'],                 'ar');

-- ============================================================
-- Alert config (singleton)
-- ============================================================
INSERT INTO alert_config (counted_event_patterns, default_threshold, priority_thresholds, notify_admin)
VALUES (
  ARRAY['Sunday Liturgy', 'Youth Meeting'],
  3,
  '{"high": 1, "medium": 2, "low": 3, "very_low": 5}',
  true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Persons (20 members — uncomment after servants are created)
-- ============================================================
-- Varied: statuses, priorities, languages, regions, registration types
--
-- INSERT INTO persons (
--   id, first_name, last_name, phone, region, language, priority,
--   assigned_servant_id, registration_type, registered_by, status, comments
-- ) VALUES
--   -- Sarah's group (Sendling/Westpark) — 7 persons
--   ('10000000-0000-0000-0000-000000000001', 'Nour',    'Aziz',      '+491111111101', 'Sendling',    'ar', 'high',    '00000000-0000-0000-0000-000000000003', 'full',      '00000000-0000-0000-0000-000000000003', 'active',   'Very interested, call weekly'),
--   ('10000000-0000-0000-0000-000000000002', 'Karim',   'Matta',     '+491111111102', 'Sendling',    'ar', 'medium',  '00000000-0000-0000-0000-000000000003', 'full',      '00000000-0000-0000-0000-000000000003', 'active',   NULL),
--   ('10000000-0000-0000-0000-000000000003', 'Jana',    'Schneider', '+491111111103', 'Westpark',    'de', 'low',     '00000000-0000-0000-0000-000000000003', 'quick_add', '00000000-0000-0000-0000-000000000003', 'new',      NULL),
--   ('10000000-0000-0000-0000-000000000004', 'Michael', 'Wahba',     '+491111111104', 'Sendling',    'en', 'medium',  '00000000-0000-0000-0000-000000000003', 'full',      '00000000-0000-0000-0000-000000000003', 'inactive', 'Moved to Berlin, check in quarterly'),
--   ('10000000-0000-0000-0000-000000000005', 'Sandra',  'Bahr',      '+491111111105', 'Westpark',    'de', 'very_low','00000000-0000-0000-0000-000000000003', 'quick_add', '00000000-0000-0000-0000-000000000003', 'new',      NULL),
--   ('10000000-0000-0000-0000-000000000006', 'Hana',    'Girgis',    '+491111111106', 'Sendling',    'ar', 'high',    '00000000-0000-0000-0000-000000000003', 'full',      '00000000-0000-0000-0000-000000000003', 'active',   'Needs Arabic-speaking servant'),
--   ('10000000-0000-0000-0000-000000000007', 'Peter',   'Lotz',      '+491111111107', 'Westpark',    'de', 'low',     '00000000-0000-0000-0000-000000000003', 'quick_add', '00000000-0000-0000-0000-000000000003', 'new',      NULL),
--
--   -- Mark's group (Schwabing/Maxvorstadt) — 7 persons
--   ('10000000-0000-0000-0000-000000000008', 'David',   'Khalil',    '+491111111108', 'Schwabing',   'en', 'medium',  '00000000-0000-0000-0000-000000000004', 'full',      '00000000-0000-0000-0000-000000000004', 'active',   NULL),
--   ('10000000-0000-0000-0000-000000000009', 'Mariam',  'Farag',     '+491111111109', 'Maxvorstadt', 'ar', 'high',    '00000000-0000-0000-0000-000000000004', 'full',      '00000000-0000-0000-0000-000000000004', 'active',   'Recently baptized, needs follow-up'),
--   ('10000000-0000-0000-0000-000000000010', 'Lukas',   'Braun',     '+491111111110', 'Schwabing',   'de', 'low',     '00000000-0000-0000-0000-000000000004', 'quick_add', '00000000-0000-0000-0000-000000000004', 'new',      NULL),
--   ('10000000-0000-0000-0000-000000000011', 'Anna',    'Richter',   '+491111111111', 'Schwabing',   'de', 'medium',  '00000000-0000-0000-0000-000000000004', 'full',      '00000000-0000-0000-0000-000000000004', 'active',   NULL),
--   ('10000000-0000-0000-0000-000000000012', 'Antony',  'Saad',      '+491111111112', 'Maxvorstadt', 'ar', 'very_low','00000000-0000-0000-0000-000000000004', 'quick_add', '00000000-0000-0000-0000-000000000004', 'inactive', NULL),
--   ('10000000-0000-0000-0000-000000000013', 'Lena',    'Wolf',      '+491111111113', 'Maxvorstadt', 'de', NULL,      '00000000-0000-0000-0000-000000000004', 'quick_add', '00000000-0000-0000-0000-000000000004', 'new',      NULL),
--   ('10000000-0000-0000-0000-000000000014', 'George',  'Sidhom',    '+491111111114', 'Schwabing',   'en', 'medium',  '00000000-0000-0000-0000-000000000004', 'full',      '00000000-0000-0000-0000-000000000004', 'active',   NULL),
--
--   -- Marina's group (Augsburg) — 6 persons
--   ('10000000-0000-0000-0000-000000000015', 'Irene',   'Gerges',    '+491111111115', 'Augsburg',    'ar', 'high',    '00000000-0000-0000-0000-000000000005', 'full',      '00000000-0000-0000-0000-000000000005', 'active',   'Husband also attends'),
--   ('10000000-0000-0000-0000-000000000016', 'Jonas',   'Huber',     '+491111111116', 'Augsburg',    'de', 'medium',  '00000000-0000-0000-0000-000000000005', 'quick_add', '00000000-0000-0000-0000-000000000005', 'new',      NULL),
--   ('10000000-0000-0000-0000-000000000017', 'Christine','Mansour',  '+491111111117', 'Augsburg',    'ar', 'low',     '00000000-0000-0000-0000-000000000005', 'full',      '00000000-0000-0000-0000-000000000005', 'active',   NULL),
--   ('10000000-0000-0000-0000-000000000018', 'Felix',   'Mayr',      '+491111111118', 'Augsburg',    'de', NULL,      '00000000-0000-0000-0000-000000000005', 'quick_add', '00000000-0000-0000-0000-000000000005', 'new',      NULL),
--   ('10000000-0000-0000-0000-000000000019', 'Mary',    'Botros',    '+491111111119', 'Augsburg',    'ar', 'medium',  '00000000-0000-0000-0000-000000000005', 'full',      '00000000-0000-0000-0000-000000000005', 'inactive', 'Traveling, resume contact in summer'),
--   ('10000000-0000-0000-0000-000000000020', 'Stefan',  'Klein',     '+491111111120', 'Augsburg',    'de', 'low',     '00000000-0000-0000-0000-000000000005', 'quick_add', '00000000-0000-0000-0000-000000000005', 'new',      NULL);

-- ============================================================
-- Cached Events (3 recurring event types)
-- ============================================================
-- INSERT INTO cached_events (google_event_id, title, start_time, end_time, date) VALUES
--   ('evt_liturgy_20260405', 'Sunday Liturgy', '2026-04-05 09:00:00+02', '2026-04-05 12:00:00+02', '2026-04-05'),
--   ('evt_youth_20260402',   'Youth Meeting',  '2026-04-02 18:00:00+02', '2026-04-02 20:00:00+02', '2026-04-02'),
--   ('evt_bible_20260403',   'Bible Study',    '2026-04-03 19:00:00+02', '2026-04-03 21:00:00+02', '2026-04-03'),
--   ('evt_liturgy_20260329', 'Sunday Liturgy', '2026-03-29 09:00:00+02', '2026-03-29 12:00:00+02', '2026-03-29'),
--   ('evt_liturgy_20260322', 'Sunday Liturgy', '2026-03-22 09:00:00+02', '2026-03-22 12:00:00+02', '2026-03-22');

-- NOTE: Person, attendance, and follow_up seed data requires servant IDs.
-- See docs/local-dev.md for the full setup procedure.
