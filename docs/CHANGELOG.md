# Changelog

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
