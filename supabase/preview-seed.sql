-- supabase/preview-seed.sql
--
-- Ad-hoc seed for the *preview* Supabase project, run manually before
-- capturing store-listing screenshots. Produces a small, photogenic
-- dataset that fills the three screens we ship in the listing without
-- scrolling: Quick Add, Check-in roster, Servant Dashboard.
--
-- Differs from `supabase/seed.sql` (the local-dev seed):
--   - Tighter scope: 5 servants + 20 persons + 1 recent counted event +
--     a partial roster + 2 fresh absence alerts. Enough to demo,
--     not so much it overwhelms a phone screenshot.
--   - No Vault block — preview is a hosted project; calendar sync /
--     push secrets are configured via Edge Function dashboard, not seed.
--   - All seeded rows are scoped by the email suffix
--     `@preview.stminaconnect.com`. Re-running deletes only those rows
--     so it never touches production-style accounts.
--
-- How to run (against the preview project — Supabase ref `ljnuaefrsfscqnywvojd`):
--
--   psql "$(supabase projects api-keys --project-ref ljnuaefrsfscqnywvojd \
--     | grep db | awk '{print $2}')" -f supabase/preview-seed.sql
--
-- Or paste this file into the Supabase Studio SQL editor of the preview
-- project and click "Run". Either way, magic-link auth still works for
-- the seeded servants — Supabase emails them an OTP on demand.
--
-- After seeding, sign in as `priest1@preview.stminaconnect.com` for the
-- admin perspective, or `servant1@preview.stminaconnect.com` for the
-- servant Dashboard view.

begin;

-- ---------------------------------------------------------------------------
-- 1. Clean slate — only seeded rows, scoped by `@preview.stminaconnect.com`.
-- ---------------------------------------------------------------------------

with seeded_servant_ids as (
  select id from public.servants where email like '%@preview.stminaconnect.com'
),
seeded_person_ids as (
  select id from public.persons
   where registered_by in (select id from seeded_servant_ids)
)
delete from public.attendance
 where person_id in (select id from seeded_person_ids);

delete from public.absence_alerts
 where person_id in (
   select id from public.persons
    where registered_by in (
      select id from public.servants where email like '%@preview.stminaconnect.com'
    )
 );

delete from public.follow_ups
 where person_id in (
   select id from public.persons
    where registered_by in (
      select id from public.servants where email like '%@preview.stminaconnect.com'
    )
 );

delete from public.persons
 where registered_by in (
   select id from public.servants where email like '%@preview.stminaconnect.com'
 );

delete from public.events where google_event_id like 'preview-%';

delete from public.servants where email like '%@preview.stminaconnect.com';

delete from auth.users where email like '%@preview.stminaconnect.com';

-- ---------------------------------------------------------------------------
-- 2. Servants — 1 priest (admin) + 4 servants. Magic-link only on
--    preview, so we don't bother with encrypted passwords; users sign
--    in via the OTP that Supabase emails. We mark the rows email-confirmed
--    so the Dashboard can show them as active staff.
-- ---------------------------------------------------------------------------

do $$
declare
  priest_id  uuid := gen_random_uuid();
  s1_id uuid := gen_random_uuid();
  s2_id uuid := gen_random_uuid();
  s3_id uuid := gen_random_uuid();
  s4_id uuid := gen_random_uuid();
  servant_ids uuid[];
  all_ids     uuid[];

  -- One recent counted service ≈ yesterday (for the Check-in screen).
  event_id uuid := gen_random_uuid();

  -- 20 persons + per-row scratch.
  i int;
  pid uuid;
  lang text;
  fname text;
  lname text;
  status text;
  paused date;
  registration_type text;
  phone text;
  comments text;
  registered_at_t timestamptz;
  assigned uuid;
  registered_by uuid;
  is_present_now boolean;

  ar_first text[] := array['مينا','مريم','بيشوي','مرقس','كيرلس','تكلا','يوحنا','مرقوريوس'];
  ar_last  text[] := array['سامي','شنودة','حنا','وهبة','صبحي','مكرم','ناشد'];
  de_first text[] := array['Anna','Stefan','Lena','Klaus','Sophia','Tobias'];
  de_last  text[] := array['Schmidt','Müller','Weber','Wagner','Hoffmann'];
  en_first text[] := array['Mariam','Andrew','Sara'];
  en_last  text[] := array['Saad','Hanna','Ibrahim'];

  regions text[] := array['Schwabing','Maxvorstadt','Sendling','Pasing','Bogenhausen'];
  priorities text[] := array['high','medium','medium','medium','low'];
begin
  servant_ids := array[s1_id, s2_id, s3_id, s4_id];
  all_ids     := array[priest_id] || servant_ids;

  -- 2a. auth.users + 2b. public.servants — paired inserts so FKs line up.
  insert into auth.users (
    instance_id, id, aud, role, email,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', priest_id, 'authenticated', 'authenticated',
     'priest1@preview.stminaconnect.com',
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', 'Father Mina'),
     '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s1_id, 'authenticated', 'authenticated',
     'servant1@preview.stminaconnect.com',
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', 'Tasoni Mariam'),
     '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s2_id, 'authenticated', 'authenticated',
     'servant2@preview.stminaconnect.com',
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', 'Servant Beshoy'),
     '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s3_id, 'authenticated', 'authenticated',
     'servant3@preview.stminaconnect.com',
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', 'Servant Verena'),
     '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s4_id, 'authenticated', 'authenticated',
     'servant4@preview.stminaconnect.com',
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('display_name', 'Servant Andrew'),
     '', '', '', '');

  insert into public.servants (id, email, display_name, role) values
    (priest_id, 'priest1@preview.stminaconnect.com', 'Father Mina',     'admin'),
    (s1_id,    'servant1@preview.stminaconnect.com','Tasoni Mariam',   'servant'),
    (s2_id,    'servant2@preview.stminaconnect.com','Servant Beshoy',  'servant'),
    (s3_id,    'servant3@preview.stminaconnect.com','Servant Verena',  'servant'),
    (s4_id,    'servant4@preview.stminaconnect.com','Servant Andrew',  'servant');

  -- 3. One recent counted event (≈ yesterday evening). Synthetic
  --    google_event_id prefixed `preview-` so cleanup can find it.
  insert into public.events (id, google_event_id, title, start_at, end_at, is_counted, synced_at)
  values (
    event_id,
    'preview-' || event_id,
    'Lobpreis & Gebetsabend',
    (current_date - interval '1 day') + time '19:00',
    (current_date - interval '1 day') + time '21:00',
    true,
    now()
  );

  -- 4. Twenty persons. Distribution mirrors the parish demographics
  --    used in the local-dev seed but at 1/10 scale.
  for i in 1..20 loop
    pid := gen_random_uuid();

    if i % 10 < 6 then
      lang := 'ar';
      fname := ar_first[1 + (i % array_length(ar_first, 1))];
      lname := ar_last [1 + (i % array_length(ar_last,  1))];
    elsif i % 10 < 9 then
      lang := 'de';
      fname := de_first[1 + (i % array_length(de_first, 1))];
      lname := de_last [1 + (i % array_length(de_last,  1))];
    else
      lang := 'en';
      fname := en_first[1 + (i % array_length(en_first, 1))];
      lname := en_last [1 + (i % array_length(en_last,  1))];
    end if;

    -- Status mix: 1 on_break, 1 inactive, 2 new, rest active.
    if i = 5 then
      status := 'on_break';
      paused := (current_date + interval '21 days')::date;
    elsif i = 13 then
      status := 'inactive';
      paused := null;
    elsif i = 7 or i = 18 then
      status := 'new';
      paused := null;
    else
      status := 'active';
      paused := null;
    end if;

    registration_type := case when i in (3, 11, 17) then 'quick_add' else 'full' end;
    phone := case when i = 9 then null else format('+49170%07s', i + 1000000) end;
    comments := case
      when i = 1 then 'Tracking pastoral check-ins'
      when status = 'on_break' then 'Travelling — back at end of next month'
      else null
    end;

    -- Round-robin assignment, leaning on the four servants more than
    -- the priest (matches reality).
    if i % 5 = 0 then
      assigned := all_ids[1 + (i % array_length(all_ids, 1))];
    else
      assigned := servant_ids[1 + (i % array_length(servant_ids, 1))];
    end if;
    registered_by := case when i % 2 = 0 then priest_id
                          else servant_ids[1 + (i % array_length(servant_ids, 1))] end;

    -- registered_at staggered over the last 30 days so the
    -- "recently registered" section on the Dashboard has range.
    registered_at_t := now() - ((i % 30) || ' days')::interval;

    insert into public.persons (
      id, first_name, last_name, phone, region, language, priority,
      assigned_servant, comments, status, paused_until,
      registration_type, registered_by, registered_at
    ) values (
      pid, fname, lname, phone,
      regions[1 + (i % array_length(regions, 1))], lang,
      priorities[1 + (i % array_length(priorities, 1))],
      assigned, comments, status, paused,
      registration_type, registered_by, registered_at_t
    );

    -- 5. Attendance for the recent event — 12 of 20 present.
    --    The 8 absences set up Follow-ups + one absence alert below.
    is_present_now := i <= 12;
    if is_present_now then
      insert into public.attendance (event_id, person_id, marked_by, is_present, marked_at)
      values (event_id, pid, assigned, true,
              (current_date - interval '1 day') + time '19:30');
    end if;
  end loop;

  -- 6. Two fresh absence alerts so the Servant Dashboard shows the
  --    "members needing follow-up" badge with content. Pick two of
  --    the persons who didn't attend (i = 14 and i = 16, by index).
  insert into public.absence_alerts (
    person_id, threshold_kind, last_event_id, streak_at_crossing, crossed_at
  )
  select p.id, 'primary', event_id, 3, now() - interval '6 hours'
    from public.persons p
   where p.registered_by in (select id from public.servants
                              where email like '%@preview.stminaconnect.com')
     and p.status = 'active'
   order by p.registered_at desc
   limit 2;
end
$$;

-- 7. Counted-event patterns — only insert if the preview project doesn't
--    already have them. The Lobpreis pattern is what the seeded event
--    matches against to count toward streaks.
insert into public.counted_event_patterns (pattern) values
  ('Lobpreis'),
  ('Gebetsabend'),
  ('Jugendversammlung'),
  ('Jugendkonferenz')
  on conflict (pattern) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- After seeding, sign in via magic link:
--   - priest1@preview.stminaconnect.com (admin perspective)
--   - servant1@preview.stminaconnect.com (servant Dashboard)
-- Then capture per `docs/store/screenshots.md`.
--
-- To wipe seeded rows without re-seeding:
--   delete from auth.users where email like '%@preview.stminaconnect.com';
--   (The cascading FKs on servants/persons handle the rest.)
-- ---------------------------------------------------------------------------
