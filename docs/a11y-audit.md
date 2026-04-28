# Accessibility audit — St. Mina Connect

This document tracks the per-screen accessibility pass that lands as
part of `harden-and-polish`. It serves three audiences:

- **Reviewers** — confirm that every screen has been thought about
  intentionally rather than assumed-good.
- **Future contributors** — a checklist to re-run when a screen
  changes substantially.
- **The compliance trail** — concrete evidence behind the WCAG AA
  claim made in the project's privacy posture.

## Method

Each primary screen is exercised against the following checklist:

1. **Roles + labels** — every interactive element has
   `accessibilityRole`, `accessibilityLabel`, and `accessibilityState`
   where applicable (`selected`, `disabled`, `checked`, `busy`).
2. **Tap target ≥ 44pt iOS / 48pt Android** — design-system primitives
   (`Button`, `IconButton`, `Chip`) enforce this; feature-level
   `Pressable`s are spot-checked.
3. **Contrast** — automated suite from `add-brand-assets` runs in
   both `light` and `dark` modes; new pairings introduced in this
   change are added to that suite.
4. **VoiceOver / TalkBack focus order** — verified by walking the
   screen with the screen reader on. Order should follow a top-to-
   bottom, start-to-end reading flow; section headings are announced
   before their content; modal-presented screens trap focus.
5. **Dynamic type** — verified at `PixelRatio.getFontScale() = 1.5`
   and `2.0`. No truncation in critical flows; long labels wrap.
6. **Reduce-motion** — animations honour
   `AccessibilityInfo.isReduceMotionEnabled()`. Skeleton shimmer,
   button press scale, sync-indicator pulse, and roster-row bounce
   all collapse to instant transitions when on.
7. **RTL** — Arabic locale verified; logical properties
   (`marginStart` / `paddingEnd`) used throughout.

## Per-screen results

Codable rows (roles/labels, contrast, reduce-motion, RTL) are
confirmed by the components themselves. The manual rows
(VoiceOver/TalkBack focus order, Dynamic type at 1.5× / 2.0×) were
walked through on device.

### Sign in

- [x] Roles + labels — `Button`, `Input` forward labels; magic-link
      switch and OTP screens follow the same pattern.
- [x] Tap target — design-system primitives only.
- [x] Contrast — covered by the brand-assets suite (light + dark).
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — only animation is the design-system Button
      press scale; honours OS setting.
- [x] RTL — verified in the i18n suite.

### Servant home

- [x] Roles + labels — every `Pressable` has an explicit
      `accessibilityLabel`. Section dots are marked `accessibilityElementsHidden`.
- [x] Tap target — Quick Action tiles are 72pt min-height; rows clear 44pt.
- [x] Contrast — Red / Yellow / Green status dots tested against the
      surface in both modes.
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — `LoadingSkeleton` shimmer and `Button` press
      scale honour the OS setting.
- [x] RTL — verified.

### Admin dashboard

- [x] Roles + labels — Quick Action tiles labelled; chart sections
      use `SectionShell` which renders a `headingMd` title.
- [x] Tap target — design-system primitives.
- [x] Contrast — chart palette derived from tokens; both modes pass.
- [x] VoiceOver / TalkBack — verified; the line chart is opaque to
      screen readers (known limitation of `react-native-chart-kit`).
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — no bespoke animation; design-system primitives only.
- [x] RTL — verified.

### Roster (attendance)

- [x] Roles + labels — checkbox role on each row,
      `accessibilityState.checked` mirrors the toggle. Save FAB
      announces "Save (n changes)".
- [x] Tap target — rows are full-width Cards; the check indicator is
      28×28 inside a row whose content padding clears 44pt.
- [x] Contrast — checked/unchecked colours pass AA.
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — row bounce honours OS setting.
- [x] RTL — verified.

### Persons list

- [x] Roles + labels — each row has `accessibilityLabel="<full
  name>"`; priority/status badges contribute readable visual
      context.
- [x] Tap target — Card-based row is comfortably > 44pt.
- [x] Contrast — list separators + badges pass AA.
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — design-system primitives only; `LoadingSkeleton`
      shimmer respects OS setting.
- [x] RTL — verified.

### Pending follow-ups

- [x] Roles + labels — section headers + per-row Pressables labelled.
- [x] Tap target — rows ≥ 44pt.
- [x] Contrast — verified.
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — primitives only.
- [x] RTL — verified.

### Person profile

- [x] Roles + labels — buttons labelled; comments banner is announced
      when present.
- [x] Tap target — Buttons.
- [x] Contrast — verified.
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — primitives only.
- [x] RTL — verified.

### Settings + Accessibility settings

- [x] Roles + labels — every row has a button role and label; the
      Haptics `Switch` forwards an explicit label.
- [x] Tap target — rows are 56pt high.
- [x] Contrast — verified.
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — N/A.
- [x] RTL — verified.

### Sync issues + About

- [x] Roles + labels — Discard buttons labelled, Diagnostics rows are
      label-value pairs that read naturally.
- [x] Tap target — Buttons.
- [x] Contrast — verified.
- [x] VoiceOver / TalkBack — verified on iOS + Android.
- [x] Dynamic type — verified at 1.5× / 2.0× scale.
- [x] Reduce-motion — primitives only.
- [x] RTL — verified.
