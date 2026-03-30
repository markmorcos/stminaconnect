# Architecture

## System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Native    │────▶│   Supabase       │────▶│ Google Calendar │
│  Expo App        │◀────│   (EU Frankfurt) │◀────│ (Service Acct)  │
│                  │     │                  │     └─────────────────┘
│  - Expo Router   │     │  - Postgres      │
│  - SQLite (local)│     │  - Auth (OTP)    │     ┌─────────────────┐
│  - Zustand       │     │  - Edge Functions│────▶│ Expo Push API   │
│  - TanStack Query│     │  - RLS Policies  │     │ (FCM / APNs)    │
│  - i18next       │     │  - Realtime      │     └─────────────────┘
└─────────────────┘     └──────────────────┘
```

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React Native + Expo (managed) | Cross-platform, OTA updates, solo-dev friendly |
| Navigation | Expo Router | File-based routing, deep linking |
| Backend | Supabase (EU) | Postgres + Auth + Edge Functions + RLS, free tier, GDPR |
| Local DB | expo-sqlite + drizzle-orm | Offline-first, type-safe queries |
| State | Zustand + TanStack Query | Simple global state + server cache |
| Forms | React Hook Form + Zod | Performant validation |
| i18n | i18next + react-i18next | RTL Arabic, 3 languages |
| UI | Custom components + theme tokens | "Warm Flat" design, 52px touch targets |
| Icons | Phosphor Icons | 6 weights, duotone for illustrations |
| Auth | Supabase OTP (phone) | No passwords for non-tech-savvy users |
| Calendar | Google Calendar API via Edge Function | Church calendar as event source |
| Push | expo-notifications + Expo Push API | Absence alerts, follow-up reminders |
| Font | Cairo (Google Fonts) | Arabic-Latin bilingual |

## Offline Sync Flow

```
User Action → Write to SQLite → Update UI immediately
                    ↓
            Add to sync_queue
                    ↓
          Background job (30s) → Online? → Push to Supabase
                                              ↓
                                    Pull remote changes
                                              ↓
                                    Update local SQLite
```

Conflict resolution: last-write-wins by `updated_at` timestamp.

## Data Flow

1. **Events**: Google Calendar → Edge Function (cron 30min) → `cached_events` table → Client SQLite cache
2. **Attendance**: Client SQLite → Sync queue → Supabase `attendance` table
3. **Absence Alerts**: Edge Function reads attendance → calculates streaks → creates follow-ups → sends push
4. **Auth**: Phone OTP via Supabase Auth → JWT session stored in AsyncStorage
