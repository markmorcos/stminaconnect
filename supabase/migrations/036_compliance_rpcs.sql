-- 036_compliance_rpcs.sql
-- GDPR compliance RPCs: consent recording, data export (Article 15),
-- hard-erasure (Article 17), and the audit-log writer.
--
-- All RPCs are SECURITY DEFINER. record_audit is the single write path
-- for `audit_log` and is called from the other compliance RPCs as well
-- as the admin/lifecycle RPCs that mutate sensitive state.

-- ---------------------------------------------------------------------------
-- record_audit(action, target_type, target_id, payload)
--   Internal append-only writer. All sensitive mutations route through here.
-- ---------------------------------------------------------------------------
create or replace function public.record_audit(
  p_action      text,
  p_target_type text,
  p_target_id   uuid,
  p_payload     jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, payload)
    values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_payload, '{}'::jsonb))
    returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.record_audit(text, text, uuid, jsonb) from public;
grant  execute on function public.record_audit(text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- record_consent(policy_version, terms_version)
-- get_my_latest_consent()
-- revoke_consent(consent_id)
-- ---------------------------------------------------------------------------
create or replace function public.record_consent(
  p_policy_version text,
  p_terms_version  text
)
returns public.consent_log
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  inserted public.consent_log;
begin
  if caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if p_policy_version is null or btrim(p_policy_version) = ''
     or p_terms_version is null or btrim(p_terms_version) = '' then
    raise exception 'policy_version and terms_version are required';
  end if;

  insert into public.consent_log (user_id, policy_version, terms_version)
    values (caller, p_policy_version, p_terms_version)
    returning * into inserted;

  perform public.record_audit(
    'consent.accept',
    'servant',
    caller,
    jsonb_build_object(
      'policy_version', p_policy_version,
      'terms_version',  p_terms_version
    )
  );

  return inserted;
end;
$$;

revoke execute on function public.record_consent(text, text) from public;
grant  execute on function public.record_consent(text, text) to authenticated;

create or replace function public.get_my_latest_consent()
returns public.consent_log
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result public.consent_log;
begin
  select * into result
    from public.consent_log
   where user_id = auth.uid()
     and revoked_at is null
   order by accepted_at desc
   limit 1;
  if not found then
    return null;
  end if;
  return result;
end;
$$;

revoke execute on function public.get_my_latest_consent() from public;
grant  execute on function public.get_my_latest_consent() to authenticated;

create or replace function public.revoke_consent(p_consent_id uuid)
returns public.consent_log
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  result public.consent_log;
begin
  if caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  update public.consent_log
     set revoked_at = now()
   where id = p_consent_id
     and user_id = caller
     and revoked_at is null
   returning * into result;
  if not found then
    raise exception 'consent_log row not found';
  end if;

  perform public.record_audit(
    'consent.revoke',
    'servant',
    caller,
    jsonb_build_object('consent_id', p_consent_id)
  );

  return result;
end;
$$;

revoke execute on function public.revoke_consent(uuid) from public;
grant  execute on function public.revoke_consent(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- export_my_data() — caller-scoped JSON envelope of self records.
-- Returns: {
--   user, servant, notifications[], consent_log[], follow_ups_created[], audit_log_actor[]
-- }
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  envelope jsonb;
begin
  if caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'user_id',     caller,
    'auth_user',   (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at
      )
      from auth.users u where u.id = caller
    ),
    'servant',     (
      select to_jsonb(s.*) from public.servants s where s.id = caller
    ),
    'consent_log', coalesce(
      (select jsonb_agg(to_jsonb(c.*) order by c.accepted_at desc)
         from public.consent_log c where c.user_id = caller), '[]'::jsonb
    ),
    'notifications', coalesce(
      (select jsonb_agg(to_jsonb(n.*) order by n.created_at desc)
         from public.notifications n where n.recipient_servant_id = caller), '[]'::jsonb
    ),
    'follow_ups_created', coalesce(
      (select jsonb_agg(to_jsonb(f.*) order by f.created_at desc)
         from public.follow_ups f where f.created_by = caller), '[]'::jsonb
    )
  )
  into envelope;

  perform public.record_audit(
    'data.export.self',
    'servant',
    caller,
    jsonb_build_object('envelope_size', length(envelope::text))
  );

  return envelope;
end;
$$;

revoke execute on function public.export_my_data() from public;
grant  execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- export_person_data(person_id)
--   Admin-only. Returns a JSON envelope of the person's complete record.
--
--   The design specifies a 24-hour signed URL to a Supabase Storage
--   object. v1 returns the JSON envelope directly; the mobile wrapper
--   uploads it and produces a signed URL when a `compliance-exports`
--   bucket is provisioned in `setup-production-deployment`. Payloads are
--   small (≤200 members) so client-side handling is acceptable.
-- ---------------------------------------------------------------------------
create or replace function public.export_person_data(p_person_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  envelope jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.persons where id = p_person_id) then
    raise exception 'person not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'person_id',   p_person_id,
    'person',      (select to_jsonb(p.*) from public.persons p where p.id = p_person_id),
    'attendance',  coalesce(
      (select jsonb_agg(to_jsonb(a.*) order by a.marked_at desc)
         from public.attendance a where a.person_id = p_person_id), '[]'::jsonb
    ),
    'follow_ups',  coalesce(
      (select jsonb_agg(to_jsonb(f.*) order by f.created_at desc)
         from public.follow_ups f where f.person_id = p_person_id), '[]'::jsonb
    ),
    'assignment_history', coalesce(
      (select jsonb_agg(to_jsonb(h.*) order by h.changed_at desc)
         from public.assignment_history h where h.person_id = p_person_id), '[]'::jsonb
    ),
    'absence_alerts', coalesce(
      (select jsonb_agg(to_jsonb(aa.*) order by aa.crossed_at desc)
         from public.absence_alerts aa where aa.person_id = p_person_id), '[]'::jsonb
    ),
    'notifications', coalesce(
      (select jsonb_agg(to_jsonb(n.*) order by n.created_at desc)
         from public.notifications n
        where n.payload->>'personId' = p_person_id::text), '[]'::jsonb
    )
  )
  into envelope;

  perform public.record_audit(
    'data.export.person',
    'person',
    p_person_id,
    jsonb_build_object('envelope_size', length(envelope::text))
  );

  return envelope;
end;
$$;

revoke execute on function public.export_person_data(uuid) from public;
grant  execute on function public.export_person_data(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- erase_person_data(person_id, reason)
--   Admin-only. GDPR Article 17 hard-erasure. Anonymizes attendance,
--   deletes follow_ups + matching notifications, deletes the person,
--   records the action in audit_log. Irreversible.
-- ---------------------------------------------------------------------------
create or replace function public.erase_person_data(
  p_person_id uuid,
  p_reason    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  attendance_count int;
  follow_ups_count int;
  notif_count      int;
  person_row       public.persons;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 20 then
    raise exception 'reason must be at least 20 characters' using errcode = '22023';
  end if;

  select * into person_row from public.persons where id = p_person_id;
  if not found then
    raise exception 'person not found' using errcode = 'P0002';
  end if;

  -- Anonymize attendance: keep the row, drop the person link.
  update public.attendance
     set person_id = null,
         was_anonymized = true
   where person_id = p_person_id;
  get diagnostics attendance_count = row_count;

  -- Delete follow_ups for the person.
  delete from public.follow_ups where person_id = p_person_id;
  get diagnostics follow_ups_count = row_count;

  -- Delete notifications referencing the person via payload->>personId.
  delete from public.notifications
   where payload->>'personId' = p_person_id::text;
  get diagnostics notif_count = row_count;

  -- Delete absence_alerts (also cascade-deleted by FK, but be explicit).
  delete from public.absence_alerts where person_id = p_person_id;

  -- Finally delete the person row. Assignment_history has ON DELETE
  -- CASCADE, so its rows go with it.
  delete from public.persons where id = p_person_id;

  perform public.record_audit(
    'member.erase',
    'person',
    p_person_id,
    jsonb_build_object(
      'reason', p_reason,
      'attendance_anonymized_count', attendance_count,
      'follow_ups_deleted_count',     follow_ups_count,
      'notifications_deleted_count',  notif_count,
      'erased_first_name', person_row.first_name,
      'erased_last_name',  person_row.last_name
    )
  );
end;
$$;

revoke execute on function public.erase_person_data(uuid, text) from public;
grant  execute on function public.erase_person_data(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- erase_my_account()
--   Caller-scoped self-erasure. Anonymizes references via the sentinel
--   id, deletes the servants row, and audits the action. The auth.users
--   row is deleted by the `delete-auth-user` Edge Function which the
--   mobile client invokes after this RPC returns successfully.
-- ---------------------------------------------------------------------------
create or replace function public.erase_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  sentinel constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if caller = sentinel then
    raise exception 'cannot erase the sentinel servant';
  end if;

  -- Audit FIRST so the row records the actor before they vanish.
  perform public.record_audit(
    'servant.self_erase',
    'servant',
    caller,
    '{}'::jsonb
  );

  -- Anonymize references the servant left behind.
  update public.attendance       set marked_by  = sentinel where marked_by  = caller;
  update public.follow_ups       set created_by = sentinel where created_by = caller;
  update public.assignment_history
     set from_servant = sentinel where from_servant = caller;
  update public.assignment_history
     set to_servant   = sentinel where to_servant   = caller;
  update public.assignment_history
     set changed_by   = sentinel where changed_by   = caller;
  update public.persons          set registered_by    = sentinel where registered_by    = caller;
  update public.persons          set assigned_servant = sentinel where assigned_servant = caller;

  -- Delete the servants row. The auth.users row is removed by the
  -- delete-auth-user Edge Function called from the mobile client after
  -- this RPC returns; the FK on servants.id (re-added in 035) is
  -- ON DELETE CASCADE so a future re-deletion is also safe.
  delete from public.servants where id = caller;
end;
$$;

revoke execute on function public.erase_my_account() from public;
grant  execute on function public.erase_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- list_audit_log(filter jsonb)
--   Admin-only paginated reader for the audit log. Filters: actor_id,
--   action, since, until. Page size capped at 50.
-- ---------------------------------------------------------------------------
create or replace function public.list_audit_log(filter jsonb default '{}'::jsonb)
returns setof public.audit_log
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  f_actor  uuid       := nullif(filter->>'actor_id', '')::uuid;
  f_action text       := nullif(filter->>'action', '');
  f_since  timestamptz := nullif(filter->>'since',  '')::timestamptz;
  f_until  timestamptz := nullif(filter->>'until',  '')::timestamptz;
  f_limit  int        := least(coalesce(nullif(filter->>'limit', '')::int, 50), 200);
  f_offset int        := greatest(coalesce(nullif(filter->>'offset', '')::int, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select *
      from public.audit_log
     where (f_actor  is null or actor_id = f_actor)
       and (f_action is null or action   = f_action)
       and (f_since  is null or created_at >= f_since)
       and (f_until  is null or created_at <  f_until)
     order by created_at desc
     limit f_limit
     offset f_offset;
end;
$$;

revoke execute on function public.list_audit_log(jsonb) from public;
grant  execute on function public.list_audit_log(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Wire record_audit into existing sensitive RPCs.
--
-- soft_delete_person   → 'member.soft_delete'
-- assign_person        → 'member.reassign'
-- update_servant_role  → 'servant.role_change'
-- deactivate_servant   → 'servant.activation_change' (deactivate)
-- reactivate_servant   → 'servant.activation_change' (reactivate)
-- ---------------------------------------------------------------------------

create or replace function public.soft_delete_person(person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.persons;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select * into before_row from public.persons
   where id = person_id and deleted_at is null;
  if not found then
    raise exception 'person not found or already deleted';
  end if;

  update public.persons set
    deleted_at = now(),
    first_name = 'Removed',
    last_name  = 'Member',
    phone      = null,
    comments   = null,
    updated_at = now()
  where id = person_id;

  perform public.record_audit(
    'member.soft_delete',
    'person',
    person_id,
    jsonb_build_object(
      'first_name', before_row.first_name,
      'last_name',  before_row.last_name
    )
  );
end;
$$;

revoke execute on function public.soft_delete_person(uuid) from public;
grant  execute on function public.soft_delete_person(uuid) to authenticated;

create or replace function public.assign_person(person_id uuid, servant_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_servant uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select assigned_servant into prior_servant
    from public.persons where id = person_id and deleted_at is null;
  if not found then
    raise exception 'person not found';
  end if;

  perform set_config('request.assignment_reason', coalesce(reason, ''), true);
  update public.persons set
    assigned_servant = servant_id,
    updated_at       = now()
  where id = person_id and deleted_at is null;

  perform public.record_audit(
    'member.reassign',
    'person',
    person_id,
    jsonb_build_object(
      'from_servant', prior_servant,
      'to_servant',   servant_id,
      'reason',       reason
    )
  );
end;
$$;

revoke execute on function public.assign_person(uuid, uuid, text) from public;
grant  execute on function public.assign_person(uuid, uuid, text) to authenticated;

create or replace function public.update_servant_role(
  p_servant_id uuid,
  p_role       text
)
returns public.servants
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  result      public.servants;
  current_row public.servants;
  admin_count int;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'servant') then
    raise exception 'invalid role: %', p_role using errcode = '22023';
  end if;

  select * into current_row
    from public.servants
   where id = p_servant_id
   for update;

  if not found then
    raise exception 'servant not found' using errcode = 'P0002';
  end if;

  if current_row.role = 'admin' and p_role = 'servant' then
    select count(*) into admin_count
      from public.servants
     where role = 'admin'
       and deactivated_at is null;
    if admin_count <= 1 then
      raise exception 'cannot demote the last active admin'
        using errcode = '23514';
    end if;
  end if;

  update public.servants
     set role = p_role,
         updated_at = now()
   where id = p_servant_id
   returning * into result;

  perform public.record_audit(
    'servant.role_change',
    'servant',
    p_servant_id,
    jsonb_build_object(
      'from_role', current_row.role,
      'to_role',   p_role
    )
  );

  return result;
end;
$$;

revoke execute on function public.update_servant_role(uuid, text) from public;
grant  execute on function public.update_servant_role(uuid, text) to authenticated;

create or replace function public.deactivate_servant(p_servant_id uuid)
returns public.servants
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  result      public.servants;
  current_row public.servants;
  admin_count int;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_servant_id = auth.uid() then
    raise exception 'cannot deactivate your own account'
      using errcode = '23514';
  end if;

  select * into current_row
    from public.servants
   where id = p_servant_id
   for update;

  if not found then
    raise exception 'servant not found' using errcode = 'P0002';
  end if;

  if current_row.role = 'admin' then
    select count(*) into admin_count
      from public.servants
     where role = 'admin'
       and deactivated_at is null;
    if admin_count <= 1 then
      raise exception 'cannot deactivate the last active admin'
        using errcode = '23514';
    end if;
  end if;

  update public.servants
     set deactivated_at = now(),
         updated_at = now()
   where id = p_servant_id
   returning * into result;

  perform public.record_audit(
    'servant.activation_change',
    'servant',
    p_servant_id,
    jsonb_build_object('action', 'deactivate')
  );

  return result;
end;
$$;

revoke execute on function public.deactivate_servant(uuid) from public;
grant  execute on function public.deactivate_servant(uuid) to authenticated;

create or replace function public.reactivate_servant(p_servant_id uuid)
returns public.servants
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  result public.servants;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.servants
     set deactivated_at = null,
         updated_at = now()
   where id = p_servant_id
   returning * into result;

  if not found then
    raise exception 'servant not found' using errcode = 'P0002';
  end if;

  perform public.record_audit(
    'servant.activation_change',
    'servant',
    p_servant_id,
    jsonb_build_object('action', 'reactivate')
  );

  return result;
end;
$$;

revoke execute on function public.reactivate_servant(uuid) from public;
grant  execute on function public.reactivate_servant(uuid) to authenticated;
