-- 039_push_dispatch_trigger.sql
-- Fans every freshly inserted notification out to the
-- `send-push-notification` Edge Function via pg_net. The Edge Function
-- handles tokens, quiet hours, localization, and Expo Push receipts.
--
-- Pattern mirrors `trigger_calendar_sync()` (014_calendar_rpcs.sql):
-- Vault-stored URL + service role key, looked up at trigger time so
-- rotating either secret takes effect on the next dispatch with no
-- re-deployment of the trigger.
--
-- Failure mode: the in-app row is the source of truth and is always
-- inserted regardless of what happens here. If pg_net fails or the
-- Vault entries are missing, the trigger raises a NOTICE (not an
-- exception — we don't want a misconfigured push pipeline to block
-- in-app delivery). The notification still reaches the recipient via
-- Realtime + the in-app inbox; only the OS-tray push is lost.

create extension if not exists pg_net;

create or replace function public.fanout_notification_to_push()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  fn_url     text;
  fn_key     text;
  request_id bigint;
begin
  -- Vault lookup. Both must be present; if either is missing we log
  -- a NOTICE and bail out (in-app row already inserted by the caller).
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_url
      using 'send_push_function_url';
  exception when others then
    raise notice 'send_push_function_url Vault secret not configured — push skipped';
    return new;
  end;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_key
      using 'send_push_service_role_key';
  exception when others then
    raise notice 'send_push_service_role_key Vault secret not configured — push skipped';
    return new;
  end;

  if fn_url is null or fn_key is null then
    raise notice 'send_push Vault secrets missing — push skipped';
    return new;
  end if;

  -- Fire-and-forget HTTP POST. pg_net queues the request and returns a
  -- request_id; the actual HTTP exchange happens off-thread. We pass
  -- only the notification id; the Edge Function reads the row, the
  -- recipient's tokens, and the recipient's quiet-hours / language
  -- settings using the service role key.
  begin
    select net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || fn_key
      ),
      body := jsonb_build_object('notification_id', new.id)
    ) into request_id;
  exception when others then
    raise notice 'pg_net dispatch failed: % — push skipped', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_fanout_to_push on public.notifications;
create trigger notifications_fanout_to_push
  after insert on public.notifications
  for each row
  execute function public.fanout_notification_to_push();
