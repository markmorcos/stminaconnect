## Context

The servant uses this screen daily. It must surface the people most needing attention without overwhelming. Three sections hit the right balance — group, follow-ups, newcomers — with quick actions always at the top.

## Goals

- Servant lands on this screen and immediately knows: who needs a check-in, what follow-ups are due, who's new.
- The streak status colour gives at-a-glance health.
- Quick actions stay one tap away.

## Non-Goals

- Customizable layout. Fixed sections in v1.
- Per-section filters. Whole-list views are at /persons or /follow-ups.
- Stats / trend charts on the servant view (admin-only).
- Comparison with other servants.

## Decisions

1. **Quick actions row**: three compact tiles (icon + label) in a horizontal row at the top. Tappable, always visible.
2. **My Group rendering**: Paper `List.Item` rows showing name, region, last attendance ("3 days ago" or "Never"), and a colour dot. Order: Red first (descending streak), then Yellow (descending streak), then Green (alphabetical), then On Break (alphabetical). This frontloads risk.
3. **Streak vs. last attendance display**: streak count for Yellow/Red rows; "Last seen [date]" for Green; "On break until [date]" for break.
4. **Pending follow-ups section**: shows count + first three rows with name + action chip + "View all" link. Identical visual pattern to the dedicated screen.
5. **Recent newcomers**: rolling 30-day window across **all** servants (not just own group), gives a sense of overall church activity. Each row shows name, registered_at relative ("2 days ago"), registration_type chip.
6. **Refresh**: pull-to-refresh invalidates all three sections + dashboard's count.
7. **Empty states**: each section has an explicit empty state — "Your group is fully checked in", "No follow-ups pending", "No new members in the last 30 days".
8. **Caching**: TanStack Query with stale-time 2 minutes (more frequent than admin dashboard since this drives daily action).

9. **Locale-aware number formatting**: counts (group size, follow-ups due, recent newcomers count) and relative dates ("3 days ago") render via `Intl.NumberFormat(i18n.language, ...)` and a localized relative-time formatter. In Arabic, numbers display with Arabic-Indic digits. Phone numbers and IDs always render in Latin digits. Rule mirrors `add-admin-dashboard` § 12.

## Risks / Trade-offs

- **Risk**: My Group can be large for established servants. Mitigation: render via FlatList (windowed); first render shows top 10 with "Show all" expand.
- **Trade-off**: showing recent newcomers across all servants may feel off-topic to a specific servant. We chose this because solo servants benefit from the church-wide view, and the section is small (last 30 days, typically <10 rows).

## Migration Plan

- One migration with three RPCs.

## Open Questions

- None for this phase.
