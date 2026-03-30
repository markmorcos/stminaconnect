# Data Model

## ERD

```
servants (auth.users)
  │ 1
  ├──────── * persons (assigned_servant_id)
  │              │ 1
  │              ├──── * attendance
  │              └──── * follow_ups
  │
  ├──────── * follow_ups (servant_id)
  └──────── * attendance (marked_by)

alert_config (singleton)
cached_events (from Google Calendar)
```

## Tables

See `supabase/migrations/00001_initial_schema.sql` for full DDL.

### servants
Linked to `auth.users`. Roles: `admin`, `servant`.

### persons
Church members. Status: `new` → `active` → `inactive` (system-derived). Priority: `high`/`medium`/`low`/`very_low`. Comments visible only to assigned servant + admins.

### attendance
One record per person per event per date. Unique constraint on `(person_id, google_event_id, event_date)`.

### follow_ups
Created by absence alerts or manually. Status: `pending` → `completed` or `snoozed`.

### alert_config
Singleton. Stores counted event patterns and absence thresholds.

### cached_events
Google Calendar event cache. Written by Edge Function only.

## RLS Policies

See `supabase/migrations/00002_rls_policies.sql`. Key rules:
- Servants read all persons but comments filtered at app layer
- Servants CRUD their assigned persons
- Admins have full access
- `cached_events` read-only for clients

## GDPR
- EU hosting (Frankfurt)
- Admin can export/delete person data
- Cascade delete on persons removes attendance + follow_ups
