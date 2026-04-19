## Context

We deferred offline to this change deliberately. The online-first version shipped in `add-attendance-online` validated the data model, the RPCs, and the UX. Now we layer persistence underneath without changing the surface API to screens — only the hooks' internals.

The sync model must handle: app start hydration, mutation queueing while offline, queue replay on reconnect, conflict resolution on replay, and visible status reporting.

## Goals

- Every mutation the app supports works offline. The servant never sees "you're offline" as a blocker.
- Mutations replay in order; dependent operations (e.g., a Full Registration upgrade that references a Quick Add that's still pending) reconcile correctly.
- The sync banner always reflects reality; no ambiguous "was that saved?" state.
- Reads work from local DB instantly; freshness comes from delta pulls.
- Sync layer is testable as pure logic separate from the network.

## Non-Goals

- No real-time subscriptions. Pull-based only.
- No conflict-resolution UI — LWW is good enough at our scale.
- No peer-to-peer sync between two offline devices.
- No encryption at rest beyond whatever SQLite's OS-level provides. We store low-sensitivity data (church member names + attendance), not health records.

## Decisions

1. **`expo-sqlite` with a single DB file per app install.** Schema versioned via a `schema_migrations` table in SQLite. Migration runner on app boot runs pending migrations in order.

2. **`sync_outbox` local table**: `id uuid pk`, `mutation_kind text` (e.g., `mark_attendance`, `create_person`), `payload jsonb`, `local_created_at`, `attempts int`, `last_error text`, `status text`, `client_timestamp timestamptz`. Draining is FIFO by `local_created_at`.

3. **Temporary client ids.** When offline and creating a person (via Quick Add), generate a `local_id uuid` client-side and use that in the outbox and in any dependent mutation (e.g., a follow-up comment added before the person has synced). On successful sync, map `local_id` → `server_id` and rewrite any queued mutations that reference it. `services/sync/id-map.ts` owns this.

4. **Pull via `pull_changes(since timestamptz)` RPC** that returns changed rows across all relevant tables since `since`, capped at, say, 500 rows per page. Client stores its last-successful-pull timestamp in local DB.

5. **Single-writer assumption per device.** Two users on the same device would break the assumption that "this device's outbox reflects this user's intent". We log out the prior user on sign-in as a new user and clear their local state.

6. **Replay runs serially per-kind.** E.g., all `mark_attendance` in order, then `create_person`, etc. Serial replay keeps ordering guarantees simple and is fast enough (< 500 queued ops is typical).

7. **Sync status store (Zustand)** with states: `idle`, `pulling`, `pushing`, `offline`, `error`. Banner component subscribes.

8. **TanStack Query stays as the UI-facing data layer.** Query functions read from SQLite. Mutations enqueue to outbox AND optimistically update SQLite. When the outbox drains, background refetches update the cache from server truth.

9. **Background sync**: on app foreground (AppState), on NetInfo online event, and every 5 minutes while active.

## Risks / Trade-offs

- **Risk:** Dependent-mutation reconciliation is the trickiest bit. If `create_person` fails server-side (e.g., validation), we orphan the queued `mark_attendance`. Mitigation: on fatal-out of a queued op, mark all dependents as `blocked` and surface to the user for manual resolution.
- **Risk:** Local DB schema changes require a migration; if botched, users lose data. Mitigation: always additive migrations, never destructive; integration tests verify old→new schema paths.
- **Trade-off:** LWW can silently overwrite a servant's change. Acceptable at our scale; full conflict UI would be 2–3× the work.
- **Trade-off:** We now store sensitive-ish data (member names, phones) on device storage. Documented as acceptable for v1; Secure Store for tokens remains unchanged.

## Migration Plan

- Server: migration `015_pull_changes_rpc.sql`.
- Client: first release with this change performs a full pull on first launch.

## Open Questions

See `_open-questions.md` #10 (attribution on conflict) — default implemented.
