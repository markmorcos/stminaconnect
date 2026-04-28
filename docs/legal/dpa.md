# Data Processing Agreement — Supabase

The St. Mina Connect Supabase project is provisioned in the **EU (Frankfurt)** region. Supabase's standard Data Processing Agreement applies to all customer data and is acknowledged in the Supabase Dashboard.

| Field               | Value                                             |
| ------------------- | ------------------------------------------------- |
| Processor           | Supabase, Inc.                                    |
| Region              | EU / Frankfurt                                    |
| DPA acknowledged    | 2026-04-28 (date of `add-gdpr-compliance` change) |
| DPA URL             | https://supabase.com/legal/dpa                    |
| Sub-processors list | https://supabase.com/legal/sub-processors         |

## What's covered

- Hosted Postgres database (member, servant, attendance, follow-up data).
- Supabase Auth (servant identity).
- Supabase Edge Functions (`invite-servant`, `delete-auth-user`, `detect-absences`, `sync-calendar-events`).
- Supabase platform logs (≤30-day retention; not used for tracking).

## What's NOT covered

- Google Calendar API: subject to a separate Google Cloud terms agreement. We use the API to **read** the church's published events calendar only. No member or servant personal data is sent to Google.

## Change procedure

If Supabase publishes a material update to its DPA or sub-processors list, the on-call admin reviews and re-acknowledges within 30 days. The acknowledgment date in the table above is updated in this file as part of the review.
