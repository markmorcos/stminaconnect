# Data retention policy

| Data                      | Retention                                                                     | Enforcement                                     |
| ------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| Active servant rows       | While the servant has an account                                              | Manual (admin via Settings → Servants)          |
| Members marked `inactive` | Eligible for soft-delete after 2 years                                        | Admin-prompted on dashboard (v1); not automatic |
| Soft-deleted members      | PII scrubbed immediately; row retained indefinitely for referential integrity | `soft_delete_person` RPC                        |
| Hard-erased members       | Row removed; attendance anonymized                                            | `erase_person_data` RPC                         |
| `consent_log`             | Indefinite (history of acceptances)                                           | None — append-only                              |
| `audit_log`               | 5 years                                                                       | Future `pg_cron` reaper (out of scope for v1)   |
| `notifications`           | 1 year                                                                        | Future `pg_cron` reaper (out of scope for v1)   |
| Supabase platform logs    | ≤ 30 days                                                                     | Supabase platform default                       |

## Notes for v1

- Automated retention enforcement (cron jobs) is **deferred**. The volunteer team is small and admin-prompted retention review is acceptable for the pilot.
- All retention durations stated above must match the published Privacy Policy.

## Future work

- Add `pg_cron` jobs for `audit_log` (5-year reap) and `notifications` (1-year reap) in a follow-up change.
- Add an admin dashboard widget that surfaces members eligible for retention review.
