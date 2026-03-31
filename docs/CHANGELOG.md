# Changelog

## Planning Review (2026-04-01)

### Updated
- Cross-verified all 12 docs against actual codebase
- Fixed tech stack references: NativeWind → inline StyleSheet, Phosphor → @expo/vector-icons
- Fixed deployment architecture: Supabase Cloud for v1, Pi5 as fallback
- Resolved all open questions (OQ-1 through OQ-14) with concrete decisions
- Added implementation details to roadmap: file lists, database changes, commit breakdowns per phase
- Documented Phase 1 gaps to address in Phase 2: ESLint, Jest, Babel path aliases

## Phase 1 — Foundation (2026-03-30)

### Added
- Expo project with TypeScript + Expo Router (file-based routing)
- Theme system: colors (Coptic Blue + Heritage Gold), Cairo typography, spacing, shadows, radius
- Cairo font loading (Regular, Medium, SemiBold, Bold)
- i18next with EN/AR/DE translations + RTL support for Arabic
- Supabase Auth with phone OTP login
- Auth guard (redirect unauthenticated to login)
- Onboarding flow (3 swipeable screens)
- Core UI components: Button, Card, Input, SyncStatusBadge, AttendanceChip
- Tab navigation: Home, Check In, People, More
- Supabase migrations: all tables, enums, indexes, RLS policies
- Seed data template
- Zustand stores: auth, sync, settings
- Dev tooling: .env.example, Makefile, Prettier config
- Documentation: local-dev, architecture, data-model, project-structure
