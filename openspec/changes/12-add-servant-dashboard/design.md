## Context

The servant's daily workflow concentrates on three things: their assigned members, any open follow-ups, and the newcomers they've recently welcomed. Everything else (event picking, profile editing) is reachable via nav, but the home should cut straight to what the servant likely wants.

## Goals

- Home loads in ≤ 500ms from local cache.
- Glanceable: the streak-health indicators make "who needs attention" obvious without reading numbers.
- Consistent with admin home's structure where it makes sense (cards), different where role demands it (no aggregates).

## Non-Goals

- No performance metrics for the servant (how many follow-ups they've completed, etc.). Explicitly: Open Question — principle of "no performance surveillance" in v1.
- No directory of other servants.

## Decisions

1. **Streak-health indicator derived from the same thresholds absence detection uses.** Green = streak < threshold - 1. Yellow = streak == threshold - 1 (next miss triggers alert). Red = streak >= threshold (alert likely open).

2. **My Group pulls from a `my_group()` RPC** returning the persons assigned to `auth.uid()` joined with their latest attendance and current streak. Computation lives server-side for consistency.

3. **Recent Newcomers = persons where `registered_by = auth.uid() AND registered_at >= now() - 30 days`.**

4. **Sort controls persist** (Zustand preferences store) so the servant's preferred sort sticks across sessions.

5. **Tap-through**: tapping a group member goes to Person detail. Tapping the Follow-Ups card goes to that tab.

## Risks / Trade-offs

- **Risk:** Streak computation on every home load could be expensive. Mitigated by a materialized summary column (`persons.current_streak int`, `persons.last_attended_counted_at timestamptz`) updated by triggers whenever attendance or absence detection runs. Added via a migration in this change.
- **Trade-off:** Adding denormalized columns on `persons` adds complexity; acceptable because the home screen is read-heavy.

## Open Questions

None blocking.
