-- supabase/seed.sql
-- Idempotent local-dev seed: 1 admin + 4 servants + 20 persons.
-- Wraps in a transaction; truncates persons / assignment_history /
-- servants / auth.users for the seeded emails before inserting so the
-- script is safe to re-run.
--
-- Login: priest@stmina.de / password123 (dev only)
--        servant1@stmina.de … servant4@stmina.de / password123

begin;

-- Clean slate for the seeded data. Order matters because the FK chain
-- isn't fully cascading:
--   * auth.users → servants  : ON DELETE CASCADE  ✓
--   * servants → persons     : (no cascade — would bite on re-run)
--   * persons → attendance   : (no cascade — phase 12)
-- So we delete from the leaves up: attendance referencing seeded
-- persons, then the seeded persons, then the auth.users (which
-- cascades into servants). assignment_history rows cascade from
-- persons automatically.

delete from public.attendance
 where person_id in (
   select id from public.persons
    where registered_by in (
      select id from public.servants
       where email in (
         'priest@stmina.de',
         'servant1@stmina.de',
         'servant2@stmina.de',
         'servant3@stmina.de',
         'servant4@stmina.de'
       )
    )
 );

delete from public.persons
 where assigned_servant in (
   select id from public.servants
    where email in (
      'priest@stmina.de',
      'servant1@stmina.de',
      'servant2@stmina.de',
      'servant3@stmina.de',
      'servant4@stmina.de'
    )
 );

delete from auth.users where email in (
  'priest@stmina.de',
  'servant1@stmina.de',
  'servant2@stmina.de',
  'servant3@stmina.de',
  'servant4@stmina.de'
);

-- Helper: build an auth.users row + matching servants row. The display
-- name lives in two places — `auth.users.raw_user_meta_data.display_name`
-- (where Supabase Auth surfaces it on the dashboard / in invite emails)
-- and `public.servants.display_name` (the source of truth for the app).
-- Both are written from the same `*_name` variable so they can't drift.
do $$
declare
  admin_id    uuid := gen_random_uuid();
  s1_id       uuid := gen_random_uuid();
  s2_id       uuid := gen_random_uuid();
  s3_id       uuid := gen_random_uuid();
  s4_id       uuid := gen_random_uuid();
  admin_name  text := 'Father Mina';
  s1_name     text := 'Tasoni Mariam';
  s2_name     text := 'Servant Mina';
  s3_name     text := 'Servant Beshoy';
  s4_name     text := 'Servant Verena';
  encrypted   text := crypt('password123', gen_salt('bf'));
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
     'priest@stmina.de', encrypted, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', admin_name), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s1_id, 'authenticated', 'authenticated',
     'servant1@stmina.de', encrypted, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', s1_name), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s2_id, 'authenticated', 'authenticated',
     'servant2@stmina.de', encrypted, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', s2_name), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s3_id, 'authenticated', 'authenticated',
     'servant3@stmina.de', encrypted, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', s3_name), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s4_id, 'authenticated', 'authenticated',
     'servant4@stmina.de', encrypted, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', s4_name), '', '', '', '');

  insert into public.servants (id, email, display_name, role) values
    (admin_id, 'priest@stmina.de',   admin_name, 'admin'),
    (s1_id,    'servant1@stmina.de', s1_name,    'servant'),
    (s2_id,    'servant2@stmina.de', s2_name,    'servant'),
    (s3_id,    'servant3@stmina.de', s3_name,    'servant'),
    (s4_id,    'servant4@stmina.de', s4_name,    'servant');

  -- 20 persons, fake names, distributed across regions / languages /
  -- priorities; 3 in on_break.
  insert into public.persons (
    first_name, last_name, phone, region, language, priority,
    assigned_servant, comments, status, paused_until,
    registration_type, registered_by, registered_at
  ) values
    -- 10 EN
    ('Mariam',  'Saad',     '+491700000001', 'Schwabing',     'en', 'high',     s1_id, 'Recent newcomer, looking for a Bible study group', 'active',   null, 'full',     admin_id, now()),
    ('Mina',    'Ibrahim',  '+491700000002', 'Schwabing',     'en', 'medium',   s1_id, 'Helps with Sunday school',                          'active',   null, 'full',     admin_id, now()),
    ('Beshoy',  'Hanna',    '+491700000003', 'Maxvorstein',   'en', 'low',      s2_id, null,                                                'inactive', null, 'quick_add', admin_id, now()),
    ('Verena',  'Wagdy',    '+491700000004', 'Maxvorstein',   'en', 'medium',   s2_id, 'New to Munich, prefers email contact',              'active',   null, 'full',     admin_id, now()),
    ('John',    'Kamel',    null,            'Sendling',      'en', 'very_low', s3_id, null,                                                'on_break', '2026-06-01', 'quick_add', admin_id, now()),
    ('Mary',    'Sobhy',    '+491700000006', 'Sendling',      'en', 'high',     s3_id, 'Visits regularly with her family',                  'active',   null, 'full',     admin_id, now()),
    ('Andrew',  'Nashed',   '+491700000007', 'Pasing',        'en', 'medium',   s4_id, null,                                                'active',   null, 'full',     admin_id, now()),
    ('Sara',    'Maged',    '+491700000008', 'Pasing',        'en', 'low',      s4_id, null,                                                'new',      null, 'quick_add', admin_id, now()),
    -- Three persons (one per language) are assigned to the admin so
    -- priest@stmina.de also has a populated "My Group" on the roster.
    -- Admins are servants-with-extra-powers in the data model; the
    -- registrar role and the shepherd role overlap by design.
    ('Peter',   'Adel',     '+491700000009', 'outside Munich','en', 'medium',   admin_id, 'Drives in once a month',                            'active',   null, 'full',     admin_id, now()),
    ('Martha',  'Wahba',    null,            'outside Munich','en', 'very_low', s2_id, null,                                                'on_break', '2026-07-15', 'quick_add', admin_id, now()),
    -- 5 DE
    ('Markus',  'Schmidt',  '+491701000001', 'Schwabing',     'de', 'medium',   s2_id, 'Konvertit, lernt Liturgie kennen',                  'active',   null, 'full',     admin_id, now()),
    ('Anna',    'Müller',   '+491701000002', 'Maxvorstein',   'de', 'high',     admin_id, null,                                                'active',   null, 'full',     admin_id, now()),
    ('Stefan',  'Weber',    '+491701000003', 'Sendling',      'de', 'low',      s4_id, null,                                                'new',      null, 'quick_add', admin_id, now()),
    ('Lena',    'Koch',     '+491701000004', 'Pasing',        'de', 'medium',   s1_id, null,                                                'active',   null, 'full',     admin_id, now()),
    ('Klaus',   'Becker',   null,            'outside Munich','de', 'very_low', s2_id, null,                                                'on_break', '2026-05-20', 'quick_add', admin_id, now()),
    -- 5 AR
    ('مينا',     'سامي',     '+491702000001', 'Schwabing',     'ar', 'high',     admin_id, 'يفضّل المتابعة باللغة العربية',                       'active',   null, 'full',     admin_id, now()),
    ('مريم',     'فايز',     '+491702000002', 'Maxvorstein',   'ar', 'medium',   s4_id, null,                                                'active',   null, 'full',     admin_id, now()),
    ('بيشوي',    'شنودة',    '+491702000003', 'Sendling',      'ar', 'low',      s1_id, null,                                                'new',      null, 'quick_add', admin_id, now()),
    ('فيرينا',   'صبحي',     '+491702000004', 'Pasing',        'ar', 'medium',   s2_id, 'تشارك في فريق التسبحة',                              'active',   null, 'full',     admin_id, now()),
    ('أبانوب',   'مكرم',     null,            'outside Munich','ar', 'very_low', s3_id, null,                                                'inactive', null, 'quick_add', admin_id, now());
end
$$;

-- Counted-event patterns (admin-configurable in-app via the Counted Events
-- screen, but seeded here so a fresh local DB has the German liturgy + youth
-- patterns the church actually uses). `pattern` is UNIQUE; ON CONFLICT keeps
-- the seed re-runnable without surfacing a constraint violation.
insert into public.counted_event_patterns (pattern) values
  ('Lobpreis'),
  ('Gebetsabend'),
  ('Jugendversammlung'),
  ('Jugendkonferenz')
  on conflict (pattern) do nothing;

commit;
