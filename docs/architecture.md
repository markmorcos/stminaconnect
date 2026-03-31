# Architecture

## System Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  React Native App    │────▶│  Supabase Cloud      │────▶│ Google Calendar │
│  (Expo Managed)      │◀────│  (EU Frankfurt)      │◀────│ (Service Acct)  │
│                      │     │                      │     └─────────────────┘
│  - Expo Router       │     │  - Postgres 15       │
│  - expo-sqlite       │     │  - Auth (Phone OTP)  │     ┌─────────────────┐
│  - drizzle-orm       │     │  - Edge Functions    │────▶│ Expo Push API   │
│  - Zustand           │     │  - RLS Policies      │     │ (FCM / APNs)    │
│  - TanStack Query    │     │  - Realtime (future) │     └─────────────────┘
│  - i18next           │     │  - pg_cron           │
│  - React Hook Form   │     └──────────────────────┘
└─────────────────────┘
         │
    ┌────┴────┐
    │ SQLite  │  Local-first storage
    │ + sync  │  sync_queue + sync_meta
    │ queue   │
    └─────────┘
```

## Tech Stack

| Layer        | Choice                              | Rationale                                                                                        |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Framework    | React Native + Expo (managed)       | Cross-platform, OTA updates, solo-dev friendly                                                   |
| Navigation   | Expo Router v4                      | File-based routing, deep linking from push notifications                                         |
| Backend      | Supabase (EU Frankfurt)             | Postgres + Auth + Edge Functions + RLS. Free tier. GDPR compliant.                               |
| Local DB     | expo-sqlite + drizzle-orm           | Offline-first with type-safe queries. Lighter than WatermelonDB, better Expo integration.        |
| Server state | TanStack Query v5                   | Cache invalidation, background refetch, optimistic updates, retry logic                          |
| Client state | Zustand                             | Lightweight stores for auth, sync status, settings. No boilerplate.                              |
| Forms        | React Hook Form + Zod               | Performant (no re-renders on keystroke), Zod schemas reused for validation on client and server. |
| i18n         | i18next + react-i18next             | Namespace-based keys, RTL support, device locale detection, AsyncStorage persistence             |
| UI           | Custom components + theme tokens    | "Warm Flat" design. Coptic Blue + Heritage Gold. 52px touch targets.                             |
| Icons        | @expo/vector-icons (Ionicons)       | Already installed, covers all needed glyphs                                                      |
| Auth         | Supabase Phone OTP                  | No passwords. Non-tech-savvy users. Session persisted in AsyncStorage.                           |
| Calendar     | Google Calendar API → Edge Function | Service account. Server-side fetch. Clients read cached results.                                 |
| Push         | expo-notifications + Expo Push API  | Absence alerts, welcome-back, follow-up reminders                                                |
| Font         | Cairo (Google Fonts)                | Arabic + Latin bilingual coverage. 4 weights loaded.                                             |

### Why NOT these alternatives

| Rejected     | Why                                                                          |
| ------------ | ---------------------------------------------------------------------------- |
| WatermelonDB | More complex setup, less active Expo support, overkill for < 200 members     |
| Firebase     | Firestore's offline sync is good but vendor lock-in, no SQL, harder RLS      |
| Redux        | Overengineered for this app size. Zustand + TanStack Query covers all needs. |
| Tamagui      | Heavyweight, steep learning curve, not needed for a small component library  |
| NativeWind   | Considered but custom theme tokens + StyleSheet gives better RTL control     |

## Offline Sync Flow

```
┌──────────────────────────────────────────────────────────┐
│                        CLIENT                            │
│                                                          │
│  User Action                                             │
│      │                                                   │
│      ▼                                                   │
│  Write to SQLite ──────▶ Update UI immediately           │
│      │                                                   │
│      ▼                                                   │
│  Insert into sync_queue                                  │
│      │                                                   │
│      ▼                                                   │
│  Sync Job (every 30s when foregrounded)                  │
│      │                                                   │
│      ├─── Offline? ──▶ Skip, retry next cycle            │
│      │                                                   │
│      ├─── Online? ──▶ Push pending (oldest first)        │
│      │                        │                          │
│      │                        ▼                          │
│      │                 Supabase RPC: bulk_sync()          │
│      │                        │                          │
│      │                        ▼                          │
│      │                 Pull changes since last_synced_at  │
│      │                        │                          │
│      │                        ▼                          │
│      │                 Update local SQLite                │
│      │                        │                          │
│      │                        ▼                          │
│      └─── Update sync_meta (last_synced_at per table)    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Sync Queue Schema (local SQLite only)

```sql
CREATE TABLE sync_queue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  operation  TEXT NOT NULL,  -- 'INSERT' | 'UPDATE' | 'DELETE'
  table_name TEXT NOT NULL,  -- 'persons' | 'attendance' | 'follow_ups'
  row_id     TEXT NOT NULL,  -- UUID of the affected row
  payload    TEXT NOT NULL,  -- JSON of the row data
  created_at TEXT NOT NULL,  -- ISO timestamp
  synced_at  TEXT            -- NULL until synced
);

CREATE TABLE sync_meta (
  table_name     TEXT PRIMARY KEY,
  last_synced_at TEXT NOT NULL  -- ISO timestamp of last successful sync
);
```

### Conflict Resolution

**Last-write-wins** by `updated_at` timestamp.

Why this is acceptable:

- < 200 members with non-overlapping servant assignments
- Attendance is typically marked by one servant per event per group
- The only conflict scenario is two servants marking the same visitor — last write is fine
- Follow-ups are owned by one servant — no concurrent edits

If conflicts become a problem (unlikely), CRDT or operational transforms can be added later. The sync queue design supports it.

### Sync Status Indicator

Always visible via `SyncStatusBadge` component:

- **✓ Synced** (green) — sync_queue is empty
- **⏳ Pending: N** (amber) — N items waiting to sync
- **✗ Offline** (red) — no connectivity, with manual retry button

## Data Flows

### 1. Event Fetching

```
Google Calendar API
       │
       ▼
Edge Function: fetch-events (pg_cron every 30 min)
       │
       ▼
Upsert into cached_events table (Supabase Postgres)
       │
       ▼
Client pulls cached_events on app open + periodic refresh
       │
       ▼
Store in local SQLite for offline access
```

### 2. Attendance Recording

```
Servant marks member present/absent
       │
       ▼
Write to local SQLite attendance table
       │
       ▼
Insert into sync_queue
       │
       ▼
Sync job pushes to Supabase via bulk_upsert_attendance()
       │
       ▼
Supabase trigger/edge function: check-absences
       │
       ▼
Calculate consecutive miss streaks for unmarked members
       │
       ▼
If threshold crossed → create follow_up + send push notification
```

### 3. Push Notification Delivery

```
Edge Function: send-notification
       │
       ▼
Read push_token from servants table
       │
       ▼
POST to https://exp.host/--/api/v2/push/send
       │
       ├─── Success → log delivery
       │
       └─── Failure → retry once, then create in-app-only follow-up
```

### 4. Authentication

```
1. User enters phone number
2. Supabase Auth sends OTP via SMS (Twilio under the hood)
3. User enters OTP
4. Supabase returns JWT session
5. App stores session in AsyncStorage
6. App fetches servant profile from servants table
7. Profile determines role → admin or servant UI
```

## Security

| Concern          | Mitigation                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| GDPR (Germany)   | EU-hosted Supabase (Frankfurt). Admin can export/delete person data. Cascade deletes.                           |
| RLS              | All tables have row-level security. Servants see only their data. Admins see all.                               |
| Comments privacy | Comments field on persons visible only to assigned servant + admins (app-layer filter + future RLS refinement). |
| Auth             | Phone OTP via Supabase. No password storage. JWT with refresh tokens.                                           |
| API keys         | Supabase anon key in .env (not committed). RLS enforces access regardless.                                      |
| Push tokens      | Stored per-servant. Only used server-side by Edge Functions.                                                    |
| Data at rest     | Supabase encrypts at rest (AES-256). Local SQLite is device-protected.                                          |

## Scalability Notes

Current design supports < 1,000 members comfortably. If growth exceeds expectations:

- Add pagination to member lists (currently fetches all)
- Move absence calculation from edge function to Postgres function for performance
- Add index on `attendance(person_id, event_date)` for streak queries (already planned)
- Consider Supabase Realtime for live attendance updates across multiple servants
