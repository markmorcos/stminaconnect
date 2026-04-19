## 1. Denormalized columns + triggers

- [ ] 1.1 Migration `024_persons_streak_columns.sql`: add `current_streak int default 0`, `last_attended_counted_at timestamptz` to `persons`; backfill from historical attendance
- [ ] 1.2 Trigger on attendance insert (counted events): update person's `current_streak` and `last_attended_counted_at`
- [ ] 1.3 On counted event finish (post-detection), update `current_streak` for all active non-on-break members
- [ ] 1.4 Tests: insert/unmark attendance updates denorm correctly

## 2. RPCs

- [ ] 2.1 Migration `025_servant_dashboard_rpcs.sql`:
  - `my_group()` returns assigned persons with `current_streak`, `last_attended_counted_at`, threshold for this person (resolved from priority + config), and a derived `health enum ('green','yellow','red')`
  - `my_recent_newcomers(days default 30)`
  - `my_open_follow_ups_count()`
- [ ] 2.2 Tests: each RPC with varied seed data

## 3. UI

- [ ] 3.1 Refactor servant branch of `app/(tabs)/index.tsx`
- [ ] 3.2 Sections: greeting header, Quick Add CTA, Pending Follow-Ups card, My Group list, Recent Newcomers list
- [ ] 3.3 My Group: sort-by control (Name, Last attended, Priority)
- [ ] 3.4 Streak-health indicator: small colored dot to the left of each member
- [ ] 3.5 Sort preference persisted in Zustand + AsyncStorage
- [ ] 3.6 Empty states for each section
- [ ] 3.7 i18n strings

## 4. Verification

- [ ] 4.1 Manual: sign in as a servant; all three sections populate with correct data from seed
- [ ] 4.2 Manual: mark a member present → current_streak updates, indicator goes green, last_attended relative time updates
- [ ] 4.3 Manual: change sort; reload app; sort persists
- [ ] 4.4 Manual: all strings in Arabic and German render correctly; RTL for Arabic
- [ ] 4.5 `make test`, `make lint`, `make typecheck` pass
- [ ] 4.6 `openspec validate add-servant-dashboard` passes
- [ ] 4.7 Every scenario in `specs/servant-dashboard/spec.md`
