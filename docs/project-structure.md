# Project Structure

```
app/              Expo Router file-based routes
  (auth)/         Auth screens (onboarding, login)
  (tabs)/         Main tab navigation
    home.tsx      Dashboard
    checkin/      Attendance flow
    people/       Member management
    more/         Settings, follow-ups, reports

src/
  theme/          Design tokens (colors, typography, spacing, shadows, radius)
  components/     Reusable UI (Button, Card, Input, AttendanceChip, SyncStatusBadge)
  hooks/          Custom hooks (useTheme, useLocale, useAuth, useSync)
  stores/         Zustand stores (auth, sync, settings)
  api/            Supabase client and data layer
  db/             Local SQLite schema and sync logic
  i18n/           i18next config + EN/AR/DE translations
  utils/          Validation schemas, date formatting, absence calculator
  types/          Shared TypeScript types

supabase/
  migrations/     SQL migration files
  functions/      Edge Functions (fetch-events, check-absences, send-notification)
  tests/          RLS and RPC integration tests
  seed.sql        Dev seed data

docs/             Living documentation (updated each phase)
```

## Conventions
- **Commits**: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`
- **Components**: PascalCase files, named exports
- **Stores**: camelCase with `use` prefix
- **i18n keys**: dot-separated namespaces (`people.quickAdd`)
- **RTL**: Use `Start`/`End` not `Left`/`Right` for directional styles
