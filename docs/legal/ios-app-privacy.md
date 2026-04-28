# iOS App Privacy — Nutrition Label Matrix

Drafted per `add-gdpr-compliance` design § 12. Submitted with `prepare-store-listings` (phase 22). All categories declare **Used for tracking: No**.

| Category     | Data type              | Linked to user?                             | Used for tracking? | Why we collect it                                                                       |
| ------------ | ---------------------- | ------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Contact Info | Name                   | Yes (servants only — members do not log in) | No                 | Servant identity for sign-in and audit                                                  |
| Contact Info | Email                  | Yes                                         | No                 | Servant identity (sign-in, account recovery)                                            |
| Contact Info | Phone Number           | Yes                                         | No                 | Member contact info for pastoral follow-up (entered by servants; members do not log in) |
| User Content | Other (pastoral notes) | Yes                                         | No                 | Free-text pastoral notes on a member, visible only to the assigned servant and admins   |
| Identifiers  | User ID                | Yes                                         | No                 | Supabase `auth.users.id` mapped to the servant's row                                    |
| Diagnostics  | Crash data             | No                                          | No                 | Operational error logs; ≤ 30-day retention                                              |

## Tracking declaration

The app performs **no tracking** by Apple's definition: no third-party trackers, no advertising identifiers, no SDK that combines our data with data from other apps for advertising or measurement, no sharing of device data with data brokers. The Privacy Policy (`docs/legal/privacy.en.md` § "No tracking") states this explicitly.

## Data collection minimization

- We do not collect: precise or coarse location, browsing history, search history, contacts, photos, audio, video, gameplay content, customer support content, fitness, health, sensitive info, financial info, purchases, payment info, credit info, or third-party advertising data.
- The only data linked to the user is what the user (servant) intentionally provides as part of their volunteer role.
