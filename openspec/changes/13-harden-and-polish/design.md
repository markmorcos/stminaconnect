## Context

We've built every feature. This is the "get it ready for real users" change. We bundle because each item is small, the whole pass takes one focused week, and it's easier to review as a coherent hardening than as 10 micro-PRs.

## Goals

- No user-visible error state that reads "undefined" or "null".
- Nothing crashes the whole app — error boundaries catch.
- Every mutation path has a well-defined failure mode (toast + retry).
- Cold start ≤ 2 seconds on a mid-range Android (Moto G Power class) on 4G.
- Screen reader narrates every screen coherently.
- Admin can delete a member completely (GDPR right-to-erasure) with one workflow.
- Any production crash produces a Sentry issue within minutes.

## Non-Goals

- No feature additions beyond GDPR delete and some settings-help content.
- No rewrite of already-working features.
- No full accessibility audit with third-party review; we do the basics (WCAG AA contrast, min target size, screen reader labels).

## Decisions

1. **Sentry for crash + error reporting.** Free tier is generous; supports React Native + Deno. Setup via `sentry-expo` and `@sentry/deno`. PII scrubbing rule: strip any property named `phone`, `first_name`, `last_name`, `notes`, `comment`, `display_name` before send.

2. **Error boundaries at every route.** Wrap each top-level screen with a boundary that logs to Sentry and renders a user-facing "Something went wrong" with a Reload button.

3. **Typed error envelope for all RPCs.** Introduce `{ ok: true, data: T } | { ok: false, code: ErrorCode, message?: string }`. Client maps code → localized message. This is a refactor of existing RPC wrappers.

4. **Empty + skeleton components** in `components/ui/`, used everywhere by convention. Lint rule / PR checklist to enforce adoption.

5. **GDPR hard delete** implemented as an RPC `hard_delete_person(id)` admin-only, with an `admin_deletion_audit` table capturing `(performed_by, performed_at, person_name_hash, person_phone_hash, reason)` — we retain the hash and timestamp for legal defensibility without keeping the person's data itself. Cascades delete attendance, comments, alerts, follow-ups.

6. **Accessibility focus areas**: (a) every `<Pressable>` has `accessibilityLabel`; (b) color-only indicators (health dots) have parallel text labels; (c) dynamic type scales; (d) focus ring visible when navigating via keyboard (yes, RN supports this).

7. **Performance**: measure cold start with React Native's built-in tracing; defer any heavy initialization (chart library, SQLite migrations) from boot to first use of the relevant screen.

8. **Minimum supported OS confirmed**: iOS 15+, Android API 29+. Runtime check at boot; display "Please update your device" if older.

9. **Help / Contact admin section in Settings**: localized church contact info (phone, email); content comes from a config table seeded with placeholders.

## Risks / Trade-offs

- **Risk:** PII scrubbing could miss fields. Mitigation: whitelist-based allowlist (only known-safe keys sent); anything else dropped.
- **Risk:** Hard delete is destructive and irreversible. Mitigation: multi-step confirmation, typed reason required, audit row.
- **Trade-off:** This change is large. Consider splitting if review becomes cumbersome — each item above could be its own mini-change if needed. We default to a single PR keeping the work together.

## Migration Plan

One migration for the audit table; everything else is code-only.

## Open Questions

See `_open-questions.md` #12 (minimum OS) and #13 (data retention). Defaults implemented here.
