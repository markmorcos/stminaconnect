# Data Model

## ERD

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  auth.users  │     │   servants   │     │ Google Calendar  │
│  (Supabase)  │────▶│              │     │ (external)       │
└─────────────┘     │  id (PK/FK)  │     └────────┬────────┘
                     │  first_name  │              │
                     │  last_name   │              ▼
                     │  phone       │     ┌────────────────┐
                     │  email       │     │ cached_events  │
                     │  role        │     │                │
                     │  regions[]   │     │ google_event_id│
                     │  push_token  │     │ title          │
                     └──────┬───────┘     │ start_time     │
                            │             │ end_time       │
              ┌─────────────┼──────┐      │ date           │
              ▼             │      │      └───────┬────────┘
     ┌──────────────┐      │      │              │
     │   persons     │      │      │              │
     │  id (PK)     ◀──────┤      │              │
     │  assigned_    │      │      │              │
     │   servant_id  │      │      │              │
     └──────┬───────┘      │      │              │
            │              │      │              │
     ┌──────┴───────┐      │      │              │
     │              │      │      │              │
     ▼              ▼      ▼      ▼              │
┌────────────┐  ┌──────────────┐                 │
│ attendance  │  │  follow_ups  │                 │
│            ◀──┘              │                 │
│ person_id   │  │ person_id    │                 │
│ event_id   ◀───┼─────────────┼─────────────────┘
│ marked_by   │  │ servant_id   │
│ present     │  │ reason       │
│ event_date  │  │ status       │
└────────────┘  └──────────────┘

alert_config (singleton — 1 row)
```

## Cardinalities

| Relationship               | Cardinality               |
| -------------------------- | ------------------------- |
| servants → persons         | 1:N (assigned_servant_id) |
| servants → attendance      | 1:N (marked_by)           |
| servants → follow_ups      | 1:N (servant_id)          |
| persons → attendance       | 1:N                       |
| persons → follow_ups       | 1:N                       |
| cached_events → attendance | 1:N (via google_event_id) |
| alert_config               | Singleton (1 row)         |

## Table Definitions

### `servants`

Links to `auth.users` via `id`. Created when admin invites a new servant.

| Column             | Type               | Constraints                               | Notes                                                          |
| ------------------ | ------------------ | ----------------------------------------- | -------------------------------------------------------------- |
| id                 | uuid               | PK, FK → auth.users(id) ON DELETE CASCADE | Same as Supabase auth user ID                                  |
| first_name         | text               | NOT NULL                                  |                                                                |
| last_name          | text               | NOT NULL                                  |                                                                |
| phone              | text               | UNIQUE, NOT NULL                          | With country code (e.g., +491234567890)                        |
| email              | text               | UNIQUE                                    | Nullable. For admin communications.                            |
| role               | user_role          | NOT NULL, DEFAULT 'servant'               | Enum: `admin`, `servant`                                       |
| regions            | text[]             | DEFAULT '{}'                              | Array of region names this servant covers                      |
| preferred_language | supported_language | NOT NULL, DEFAULT 'en'                    | Enum: `en`, `ar`, `de`                                         |
| push_token         | text               |                                           | Expo push token. Nullable (set after notification permission). |
| created_at         | timestamptz        | NOT NULL, DEFAULT now()                   |                                                                |
| updated_at         | timestamptz        | NOT NULL, DEFAULT now()                   | Auto-updated via trigger                                       |

**Indexes**: `idx_servants_role` on `(role)`

### `persons`

Church members / newcomers. No auth — they don't use the app.

| Column              | Type               | Constraints                          | Notes                                                             |
| ------------------- | ------------------ | ------------------------------------ | ----------------------------------------------------------------- |
| id                  | uuid               | PK, DEFAULT gen_random_uuid()        |                                                                   |
| first_name          | text               | NOT NULL                             | Stored as-entered (any language)                                  |
| last_name           | text               | NOT NULL                             |                                                                   |
| phone               | text               | UNIQUE, NOT NULL                     | With country code, default +49                                    |
| region              | text               |                                      | Free text. Neighborhood or city.                                  |
| language            | supported_language | NOT NULL, DEFAULT 'en'               | Preferred language for greeting                                   |
| priority            | priority_level     |                                      | Nullable for quick_add. Enum: `high`, `medium`, `low`, `very_low` |
| assigned_servant_id | uuid               | FK → servants(id) ON DELETE SET NULL |                                                                   |
| comments            | text               |                                      | Private — visible only to assigned servant + admins               |
| registration_type   | registration_type  | NOT NULL                             | Enum: `quick_add`, `full`                                         |
| registered_by       | uuid               | NOT NULL, FK → servants(id)          | Servant who created the record                                    |
| registered_at       | timestamptz        | NOT NULL, DEFAULT now()              |                                                                   |
| status              | person_status      | NOT NULL, DEFAULT 'new'              | Enum: `new`, `active`, `inactive`. Updated by system.             |
| paused_until        | date               |                                      | Non-null = "on break". Alerts paused until this date.             |
| updated_at          | timestamptz        | NOT NULL, DEFAULT now()              | Auto-updated via trigger                                          |

**Indexes**:

- `idx_persons_assigned_servant` on `(assigned_servant_id)`
- `idx_persons_status` on `(status)`
- `idx_persons_registered_by` on `(registered_by)`

**Status Transitions**:

- `new` → `active`: After first attendance record (marked present)
- `active` → `inactive`: After crossing absence threshold with no follow-up resolution
- `inactive` → `active`: When the person attends again (return detection)

### `attendance`

One record per person per event per date. Presence or absence.

| Column          | Type        | Constraints                                  | Notes                             |
| --------------- | ----------- | -------------------------------------------- | --------------------------------- |
| id              | uuid        | PK, DEFAULT gen_random_uuid()                |                                   |
| person_id       | uuid        | NOT NULL, FK → persons(id) ON DELETE CASCADE |                                   |
| google_event_id | text        | NOT NULL                                     | From Google Calendar              |
| event_title     | text        | NOT NULL                                     | Cached for display (denormalized) |
| event_date      | date        | NOT NULL                                     | Date of the event                 |
| present         | boolean     | NOT NULL, DEFAULT false                      |                                   |
| marked_by       | uuid        | NOT NULL, FK → servants(id)                  |                                   |
| marked_at       | timestamptz | NOT NULL, DEFAULT now()                      |                                   |
| synced_at       | timestamptz |                                              | NULL until synced from client     |

**Indexes**:

- `idx_attendance_person_date` on `(person_id, event_date DESC)` — for streak calculation
- `idx_attendance_event` on `(google_event_id, event_date)` — for event check-in screen
- **Unique**: `(person_id, google_event_id, event_date)` — one record per person per event per day

### `follow_ups`

Created by absence alerts or manually by servants.

| Column              | Type             | Constraints                                  | Notes                                                                           |
| ------------------- | ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| id                  | uuid             | PK, DEFAULT gen_random_uuid()                |                                                                                 |
| person_id           | uuid             | NOT NULL, FK → persons(id) ON DELETE CASCADE |                                                                                 |
| servant_id          | uuid             | NOT NULL, FK → servants(id)                  | Assigned servant                                                                |
| reason              | follow_up_reason | NOT NULL                                     | Enum: `absence_alert`, `manual`                                                 |
| trigger_event_title | text             |                                              | Event that triggered the alert. Nullable for manual.                            |
| missed_count        | integer          |                                              | Consecutive misses at time of alert. Nullable for manual.                       |
| action              | follow_up_action |                                              | Enum: `called`, `texted`, `visited`, `no_answer`, `other`. NULL until actioned. |
| notes               | text             |                                              | Free text notes from servant.                                                   |
| status              | follow_up_status | NOT NULL, DEFAULT 'pending'                  | Enum: `pending`, `completed`, `snoozed`                                         |
| snoozed_until       | date             |                                              | If snoozed, when to re-surface.                                                 |
| created_at          | timestamptz      | NOT NULL, DEFAULT now()                      |                                                                                 |
| completed_at        | timestamptz      |                                              | Set when status → completed                                                     |

**Indexes**:

- `idx_follow_ups_servant_status` on `(servant_id, status)` — for servant's pending list
- `idx_follow_ups_person` on `(person_id)` — for person profile history

### `cached_events`

Google Calendar events, cached server-side by Edge Function. **Read-only for clients.**

| Column          | Type        | Constraints             | Notes                      |
| --------------- | ----------- | ----------------------- | -------------------------- |
| google_event_id | text        | PK                      | Google Calendar event ID   |
| title           | text        | NOT NULL                | Event title                |
| start_time      | timestamptz | NOT NULL                |                            |
| end_time        | timestamptz | NOT NULL                |                            |
| date            | date        | NOT NULL                | Event date (for filtering) |
| fetched_at      | timestamptz | NOT NULL, DEFAULT now() | Last fetch timestamp       |

**Indexes**: `idx_cached_events_date` on `(date DESC)`

### `alert_config`

Singleton configuration row.

| Column                 | Type        | Constraints                   | Notes                                              |
| ---------------------- | ----------- | ----------------------------- | -------------------------------------------------- |
| id                     | uuid        | PK, DEFAULT gen_random_uuid() |                                                    |
| counted_event_patterns | text[]      | NOT NULL, DEFAULT '{}'        | Event title patterns for absence tracking          |
| default_threshold      | integer     | NOT NULL, DEFAULT 3           | Consecutive misses before alert                    |
| priority_thresholds    | jsonb       |                               | Per-priority overrides: `{"high": 1, "medium": 2}` |
| notify_admin           | boolean     | NOT NULL, DEFAULT false       | Admins receive alerts too                          |
| updated_at             | timestamptz | NOT NULL, DEFAULT now()       |                                                    |

## Enums

```sql
CREATE TYPE user_role AS ENUM ('admin', 'servant');
CREATE TYPE person_status AS ENUM ('new', 'active', 'inactive');
CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low', 'very_low');
CREATE TYPE registration_type AS ENUM ('quick_add', 'full');
CREATE TYPE follow_up_reason AS ENUM ('absence_alert', 'manual');
CREATE TYPE follow_up_action AS ENUM ('called', 'texted', 'visited', 'no_answer', 'other');
CREATE TYPE follow_up_status AS ENUM ('pending', 'completed', 'snoozed');
CREATE TYPE supported_language AS ENUM ('en', 'ar', 'de');
```

## Triggers

```sql
-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Applied to: servants, persons, alert_config
```

## RLS Policies

All tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

### servants

| Policy             | Operation | Rule                    |
| ------------------ | --------- | ----------------------- |
| Select all         | SELECT    | All authenticated users |
| Update own profile | UPDATE    | `auth.uid() = id`       |
| Admin manage       | ALL       | `is_admin()`            |

### persons

| Policy              | Operation      | Rule                                                               |
| ------------------- | -------------- | ------------------------------------------------------------------ |
| Read all            | SELECT         | All authenticated (comments filtered at app layer)                 |
| Servant CRUD own    | INSERT, UPDATE | `assigned_servant_id = auth.uid()` or `registered_by = auth.uid()` |
| Admin full access   | ALL            | `is_admin()`                                                       |
| Admin delete (GDPR) | DELETE         | `is_admin()` only                                                  |

### attendance

| Policy        | Operation      | Rule                                     |
| ------------- | -------------- | ---------------------------------------- |
| Read all      | SELECT         | All authenticated                        |
| Create/update | INSERT, UPDATE | `marked_by = auth.uid()` or `is_admin()` |

### follow_ups

| Policy              | Operation      | Rule                            |
| ------------------- | -------------- | ------------------------------- |
| Servant own         | SELECT, UPDATE | `servant_id = auth.uid()`       |
| Admin all           | ALL            | `is_admin()`                    |
| Service role create | INSERT         | Edge Functions via service role |

### cached_events

| Policy | Operation      | Rule              |
| ------ | -------------- | ----------------- |
| Read   | SELECT         | All authenticated |
| Write  | INSERT, UPDATE | Service role only |

### alert_config

| Policy | Operation | Rule              |
| ------ | --------- | ----------------- |
| Read   | SELECT    | All authenticated |
| Write  | UPDATE    | `is_admin()` only |

### Helper Function

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM servants WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

## Migration Strategy

Migrations live in `supabase/migrations/` as numbered SQL files:

```
00001_initial_schema.sql    -- All tables, enums, indexes, triggers (Phase 1 ✅)
00002_rls_policies.sql      -- All RLS policies (Phase 1 ✅)
00003_rpc_functions.sql     -- Postgres RPC functions (Phase 2)
00004_absence_functions.sql -- Streak calculation functions (Phase 4)
```

**Workflow**:

1. Create: `make migrate-new` (prompts for name)
2. Apply locally: `make migrate-up` (`supabase db push`)
3. Reset + seed: `make seed` (`supabase db reset`)
4. Deploy: `supabase db push --linked` (to production)

## Seed Data Plan

The seed script (`supabase/seed.sql`) creates:

- 2 admin servants (e.g., Abouna Mina, Abouna Bishoy)
- 3 servant accounts (e.g., Marian, Fady, Nardine) — covering different regions
- 20 persons distributed across servants, with varied statuses, priorities, registration types, languages, regions
- 60+ attendance records across 4 events over 8 weeks
- 5 follow-ups (mix of pending, completed, snoozed)
- 1 alert_config row (threshold: 3, patterns: `["Sunday Liturgy", "Youth Meeting"]`)
- 3 cached_events (Sunday Liturgy, Youth Meeting, Bible Study)

**Note**: `auth.users` must be created first via Supabase Dashboard or CLI.

## GDPR Compliance

| Requirement         | Implementation                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Data location       | Supabase EU Frankfurt region                                                                 |
| Right to access     | Admin export person data as JSON                                                             |
| Right to deletion   | Admin delete cascades: person → attendance + follow_ups                                      |
| Data minimization   | Only collect necessary fields. No analytics/tracking.                                        |
| Consent             | Servants register on behalf of members. Church legitimate interest basis.                    |
| Retention           | No auto-deletion in v1. Admin manually removes inactive. Future: auto-archive after 2 years. |
| Encryption          | At rest: Supabase AES-256. In transit: TLS. Local: device-level.                             |
| Breach notification | No PII in logs or error reporting.                                                           |
| Comments privacy    | Visible only to assigned servant + admins. Not synced to other servants' local DBs.          |
