-- supabase/seed.sql
-- Idempotent local-dev seed.
--
-- One file, two concerns:
--   1. People + counted-event patterns (always runs, including under
--      `supabase db reset` which streams the seed through pgx — NOT
--      psql — so backslash directives are not available here).
--   2. Vault secrets for `trigger_calendar_sync()` — only runs when
--      the session GUC `app.service_role_key` is set (the Makefile
--      `seed` target prepends a `SET` before piping this file).
--
-- Login (dev only): every account uses `password123`.
--   priest1@stmina.de … priest5@stmina.de    — admin role
--   servant1@stmina.de … servant20@stmina.de — servant role
--
-- Re-runnable: every block deletes its prior seeded rows first, so the
-- script can be replayed to refresh fixtures without manual cleanup.

begin;

-- ---------------------------------------------------------------------------
-- 1. Clean slate. Order matters because the FK chain isn't fully cascading:
--   * auth.users → servants  : ON DELETE CASCADE  ✓
--   * servants → persons     : (no cascade — would bite on re-run)
--   * persons → attendance   : (no cascade — phase 12)
--   * persons → assignment_history : ON DELETE CASCADE ✓
-- So delete from the leaves up.
-- ---------------------------------------------------------------------------

with seeded_servant_ids as (
  select id from public.servants
   where email like 'priest%@stmina.de'
      or email like 'servant%@stmina.de'
      or email = 'priest@stmina.de'         -- legacy single-priest fixture
)
delete from public.attendance
 where person_id in (
   select id from public.persons
    where registered_by in (select id from seeded_servant_ids)
 );

delete from public.persons
 where assigned_servant in (
   select id from public.servants
    where email like 'priest%@stmina.de'
       or email like 'servant%@stmina.de'
       or email = 'priest@stmina.de'
 )
    or registered_by in (
   select id from public.servants
    where email like 'priest%@stmina.de'
       or email like 'servant%@stmina.de'
       or email = 'priest@stmina.de'
 );

delete from auth.users
 where email like 'priest%@stmina.de'
    or email like 'servant%@stmina.de'
    or email = 'priest@stmina.de';

-- ---------------------------------------------------------------------------
-- 2. People — 5 priests (admin) + 20 servants + 200 persons.
--
-- The DO block builds:
--   * 25 auth.users rows (5 admin + 20 servant), email-confirmed,
--     password=`password123`. The display_name lives both on
--     auth.users.raw_user_meta_data (Supabase Dashboard surface) and
--     public.servants.display_name (app source-of-truth).
--   * 25 public.servants rows mirroring the above with role.
--   * 200 public.persons rows distributed across:
--       - 60% AR / 30% DE / 10% EN (matches Munich Coptic demographics)
--       - 5 regions + an "outside Munich" bucket
--       - 4 priorities (skewed to medium)
--       - 5% on_break, 8% new, 5% inactive, ~82% active
--     Assignment is round-robin across the 25 servants so every account
--     has a populated My Group on first login. registered_at spans the
--     last 90 days so dashboards have something interesting to show.
--
-- Names are intentionally authentic (Egyptian Coptic + German Konvertit
-- + a few EN newcomers) so the UX in dev looks the way it will look in
-- production rather than `Lorem Ipsum`.
-- ---------------------------------------------------------------------------

do $$
declare
  encrypted text := crypt('password123', gen_salt('bf'));

  -- Pre-allocated UUIDs so we can both INSERT them into auth.users and
  -- reference them in subsequent INSERTs without round-tripping.
  priest_ids  uuid[] := array(select gen_random_uuid() from generate_series(1, 5));
  servant_ids uuid[] := array(select gen_random_uuid() from generate_series(1, 20));
  all_ids     uuid[] := priest_ids || servant_ids;

  -- Display names for the 25 staff accounts.
  priest_names  text[] := array[
    'Father Mina', 'Father Bishoy', 'Father Antony',
    'Father Ruweis', 'Father Pishoy'
  ];
  servant_names text[] := array[
    'Tasoni Mariam',  'Servant Mina',     'Servant Beshoy',  'Servant Verena',
    'Servant Marina', 'Servant Bassem',   'Servant Sara',    'Servant Andrew',
    'Servant Markus', 'Servant Anna',     'Servant Philip',  'Servant Demiana',
    'Servant Stefan', 'Servant Lena',     'Servant Peter',   'Servant Mariam K.',
    'Servant Karim',  'Servant Sandy',    'Servant Tobias',  'Servant Veronika'
  ];

  -- Person-name pools, partitioned by language. Last-name lists are
  -- shared across AR/EN (same Coptic family names rendered in either
  -- script depending on the row's `language`).
  ar_first text[] := array[
    'مينا', 'مريم', 'بيشوي', 'فيرينا', 'مرقس', 'كيرلس', 'يوحنا', 'مرقوريوس',
    'ديميانة', 'مريانا', 'تكلا', 'سيمون', 'إسطفانوس', 'أبانوب', 'باخوميوس',
    'أنطونيوس', 'أرسانيوس', 'مارينا', 'تاسوني', 'فلوباتير'
  ];
  ar_last  text[] := array[
    'سامي', 'فايز', 'شنودة', 'صبحي', 'مكرم', 'حنا', 'إبراهيم', 'سعد',
    'وهبة', 'كامل', 'ناشد', 'ماجد', 'عادل', 'فؤاد'
  ];
  de_first text[] := array[
    'Markus', 'Anna', 'Stefan', 'Lena', 'Klaus', 'Sebastian', 'Julia',
    'Tobias', 'Veronika', 'Andreas', 'Sophia', 'Matthias', 'Eva',
    'Christian', 'Hannah'
  ];
  de_last  text[] := array[
    'Schmidt', 'Müller', 'Weber', 'Koch', 'Becker', 'Wagner',
    'Schneider', 'Fischer', 'Hoffmann', 'Bauer', 'Richter'
  ];
  en_first text[] := array[
    'Mariam', 'Mina', 'Beshoy', 'Verena', 'John', 'Mary', 'Andrew',
    'Sara', 'Peter', 'Martha', 'Mark', 'Cyril', 'Demiana', 'Antony'
  ];
  en_last  text[] := array[
    'Saad', 'Ibrahim', 'Hanna', 'Wagdy', 'Kamel', 'Sobhy', 'Nashed',
    'Maged', 'Adel', 'Wahba', 'Bishara', 'Ghattas'
  ];

  regions text[] := array[
    'Schwabing', 'Maxvorstadt', 'Sendling', 'Pasing',
    'Bogenhausen', 'Neuhausen', 'Au-Haidhausen', 'outside Munich'
  ];
  priorities text[] := array['high', 'medium', 'medium', 'medium', 'low', 'very_low'];

  i int;
  email text;
  display_name text;

  -- Per-person scratch.
  lang text;
  region text;
  priority text;
  status text;
  paused date;
  registration_type text;
  first_name text;
  last_name text;
  phone text;
  comments text;
  registered_at_t timestamptz;
  assigned_servant uuid;
  registered_by uuid;
begin
  -- 2a. auth.users — 5 priests then 20 servants.
  for i in 1..5 loop
    email := format('priest%s@stmina.de', i);
    display_name := priest_names[i];
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      priest_ids[i], 'authenticated', 'authenticated',
      email, encrypted, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', display_name),
      '', '', '', ''
    );
  end loop;

  for i in 1..20 loop
    email := format('servant%s@stmina.de', i);
    display_name := servant_names[i];
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      servant_ids[i], 'authenticated', 'authenticated',
      email, encrypted, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', display_name),
      '', '', '', ''
    );
  end loop;

  -- 2b. public.servants — same UUIDs, with role.
  for i in 1..5 loop
    insert into public.servants (id, email, display_name, role) values
      (priest_ids[i], format('priest%s@stmina.de', i), priest_names[i], 'admin');
  end loop;

  for i in 1..20 loop
    insert into public.servants (id, email, display_name, role) values
      (servant_ids[i], format('servant%s@stmina.de', i), servant_names[i], 'servant');
  end loop;

  -- 2c. 200 persons. Distribution rules:
  --   - i mod 10 = 0/1/2  → AR (60%)
  --   - i mod 10 = 3/4/5/6/7/8 → DE (30%) + EN (rest)
  -- Names rotate through the per-language arrays via mod arithmetic.
  -- registered_at is staggered across the last 90 days so charts have
  -- something to plot rather than a single spike.
  for i in 1..200 loop
    -- Language: 60% AR / 30% DE / 10% EN.
    if i % 10 < 6 then
      lang := 'ar';
      first_name := ar_first[1 + (i % array_length(ar_first, 1))];
      last_name  := ar_last [1 + (i % array_length(ar_last,  1))];
    elsif i % 10 < 9 then
      lang := 'de';
      first_name := de_first[1 + (i % array_length(de_first, 1))];
      last_name  := de_last [1 + (i % array_length(de_last,  1))];
    else
      lang := 'en';
      first_name := en_first[1 + (i % array_length(en_first, 1))];
      last_name  := en_last [1 + (i % array_length(en_last,  1))];
    end if;

    region   := regions[1 + (i % array_length(regions, 1))];
    priority := priorities[1 + (i % array_length(priorities, 1))];

    -- Status distribution. on_break gets a paused_until in the future.
    if i % 20 = 0 then
      status := 'on_break';
      paused := (current_date + interval '30 days')::date;
    elsif i % 13 = 0 then
      status := 'new';
      paused := null;
    elsif i % 19 = 0 then
      status := 'inactive';
      paused := null;
    else
      status := 'active';
      paused := null;
    end if;

    -- Most rows are 'full'; about a fifth came in via Quick Add.
    registration_type := case when i % 5 = 0 then 'quick_add' else 'full' end;

    -- Phones: most have one, ~15% don't.
    phone := case when i % 7 = 0 then null
                  else format('+49170%07s', i + 1000000) end;

    -- Comments only on a handful of priority rows (matches reality —
    -- servants don't write notes for everyone).
    comments := case
      when priority = 'high' and i % 3 = 0 then 'Tracking pastoral check-ins'
      when status = 'on_break'             then 'Travelling — back at end of next month'
      else null
    end;

    -- Round-robin assignment across all 25 staff, but skip the priests
    -- for assignment two-thirds of the time so servants get the bulk
    -- of the work (mirrors how a parish actually distributes load).
    if i % 3 = 0 then
      assigned_servant := all_ids[1 + (i % array_length(all_ids, 1))];
    else
      assigned_servant := servant_ids[1 + (i % array_length(servant_ids, 1))];
    end if;

    -- Half the rows are registered by the priest, half by a servant.
    registered_by := case when i % 2 = 0
      then priest_ids[1 + (i % array_length(priest_ids, 1))]
      else servant_ids[1 + (i % array_length(servant_ids, 1))]
    end;

    -- Stagger registration_at across the last 90 days.
    registered_at_t := now() - ((i % 90) || ' days')::interval;

    insert into public.persons (
      first_name, last_name, phone, region, language, priority,
      assigned_servant, comments, status, paused_until,
      registration_type, registered_by, registered_at
    ) values (
      first_name, last_name, phone, region, lang, priority,
      assigned_servant, comments, status, paused,
      registration_type, registered_by, registered_at_t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Counted-event patterns. The Counted Events admin screen lets you
--    edit these in-app, but a fresh local DB needs the German liturgy
--    + youth patterns the Munich church actually uses, otherwise no
--    events count toward streaks.
-- ---------------------------------------------------------------------------

insert into public.counted_event_patterns (pattern) values
  ('Lobpreis'),
  ('Gebetsabend'),
  ('Jugendversammlung'),
  ('Jugendkonferenz')
  on conflict (pattern) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- 4. Vault secrets — for `trigger_calendar_sync()` and the pg_cron
--    schedule. Reads the service-role key from the session GUC
--    `app.service_role_key`. The Makefile `seed` target prepends
--    `SET app.service_role_key = '...'` before piping this file;
--    `supabase db reset` doesn't set the GUC, so the block skips
--    silently with a NOTICE.
-- ---------------------------------------------------------------------------

do $$
declare
  service_role_key text;
begin
  -- `current_setting(name, missing_ok)` returns NULL when the GUC
  -- hasn't been set, instead of raising. We also treat the empty
  -- string as "not set" because the Makefile passes "" when it
  -- couldn't read the key from `supabase status`.
  service_role_key := nullif(current_setting('app.service_role_key', true), '');

  if service_role_key is null then
    raise notice
      '!! seed.sql: app.service_role_key not set — Vault block skipped.';
    raise notice
      '!! Run via `make seed` (or `SET app.service_role_key = ''<key>''`) to seed Vault too.';
    return;
  end if;

  -- Wipe prior entries so re-running is safe (vault.secrets has a
  -- unique constraint on `name`).
  delete from vault.secrets
   where name in ('sync_calendar_function_url', 'sync_calendar_service_role_key');

  -- From inside the Postgres container, the host's 127.0.0.1 is
  -- `host.docker.internal`. Kong serves Edge Functions on the same
  -- 54321 port the host sees.
  perform vault.create_secret(
    'http://host.docker.internal:54321/functions/v1/sync-calendar-events',
    'sync_calendar_function_url'
  );

  perform vault.create_secret(
    service_role_key,
    'sync_calendar_service_role_key'
  );
end
$$;
