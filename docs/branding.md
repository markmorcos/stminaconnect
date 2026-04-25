# Branding — St. Mina Connect

This document is the source of truth for the brand: how it looks, how it
sounds, and the small list of "do/don't"s that keep future contributors
from accidentally drifting it. Asset files (icon, splash, logo SVG) live
under `assets/branding/` and `src/design/components/Logo.tsx`.

## 1 — Visual references

The visual language is **Coptic Orthodox, expressed through a modern
geometric lens**. Inspirations:

- **Coptic crosses** — the equal-armed cross with notched terminals seen
  on liturgical vestments, manuscripts, and church facades. The brand
  glyph is a contemporary read of that shape: thick strokes, no notches,
  uniform terminals.
- **Liturgical color palette** — deep oxblood / liturgical red
  (Eucharist, martyrdom), warm gold (saintly halos, censers), cream
  parchment (manuscripts), ink-black (Coptic script).
- **Byzantine / Coptic typography influence** — uppercase Greek and
  Coptic majuscule shapes are squared, generous in stroke weight,
  unornamented. Inter (Latin) and IBM Plex Sans Arabic (Arabic) are the
  modern equivalent: humanist sans-serif faces with optical balance
  rather than period detail.

We deliberately avoid:

- Photo-realistic religious iconography on the icon (Pantocrator,
  saints' faces) — these don't survive home-screen scaling and risk
  store-review escalation in some markets.
- Drop shadows, bevels, gradients on the mark — the glyph reads at 24dp.
- Skeuomorphic textures (parchment, gilding) anywhere in the UI.

## 2 — Palette philosophy

Tokens are defined in `src/design/tokens.ts` and verified by
`tests/branding/contrast.test.ts`. The brand colors:

| Role         | Light     | Dark      | Reason                     |
| ------------ | --------- | --------- | -------------------------- |
| `primary`    | `#8B1E2D` | `#D45D6E` | Deep liturgical red        |
| `secondary`  | `#C9A961` | `#E2BE7A` | Warm gold (icon, accents)  |
| `accent`     | `#445A8A` | `#7A8DC4` | Muted indigo (links, info) |
| `background` | `#FBF8F4` | `#15110E` | Cream parchment / deep ink |
| `text`       | `#1C1A18` | `#F5EFE7` | Body text                  |

**Why not pure black/white?** Pure `#000000` text on `#FFFFFF` is harsh
under cream lighting; the off-cream / off-ink pair feels printed, not
broadcast. **Why a single primary, not a gradient family?** A gradient
implies playfulness; the church's identity is calm and rooted.

The full set (success, warning, error, info, surface tones, borders) is
documented in `tokens.ts` with light + dark counterparts. Every
text-on-surface pairing passes WCAG AA, enforced by the contrast test.

## 3 — Typography pairing rationale

- **Latin scripts (en, de) → Inter.** Geometric, neutral, optimized for
  on-screen reading at small sizes. No serifs to flatten on phone DPI.
- **Arabic (ar) → IBM Plex Sans Arabic.** Pairs with Inter at matching
  x-height, weight axis, and metrics; designed by IBM specifically as
  Plex Sans's Arabic counterpart so headings rendered in mixed contexts
  feel consistent.
- **Why not a single typeface for both?** No widely-used, freely-licensed
  sans-serif covers Latin, Arabic, **and** Coptic at the quality level
  needed for body text. Coptic isn't a UI need (services use Arabic);
  the Coptic influence is carried by the icon and color, not the font.
- The `Text` component swaps font family per active language; weights map
  1:1 (Inter-Regular ↔ IBMPlexSansArabic-Regular, etc.). See
  `src/design/components/Text.tsx`.

## 4 — Cross-glyph concept (icon mark)

The icon is a stylized Coptic cross expressed as a single, modern
geometric mark. Two arms of equal length, intersecting at the center,
with an inscribed inner cross indicating the secondary stroke. The
outer silhouette uses `tokens.colors.secondary` (gold). The inscribed
inner detail uses `tokens.colors.background` (cream) for negative-space
contrast against a `tokens.colors.primary` (deep red) background.

Reference SVG (the shipped asset is `assets/branding/icon.svg`):

```svg
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- background -->
  <rect width="1024" height="1024" fill="#8B1E2D"/>
  <!-- outer cross (gold) — equal-armed, thick strokes -->
  <g fill="#C9A961">
    <rect x="432" y="208" width="160" height="608" rx="16"/>
    <rect x="208" y="432" width="608" height="160" rx="16"/>
  </g>
  <!-- inscribed inner cross (cream) — centered, half-width -->
  <g fill="#FBF8F4">
    <rect x="488" y="304" width="48" height="416" rx="8"/>
    <rect x="304" y="488" width="416" height="48" rx="8"/>
  </g>
</svg>
```

**Why two crosses, not one?** The inner cross is a structural read of
the same form — a Coptic-style chiaroscuro that survives small sizes:
at 48dp the inner detail merges visually with the outer mark, but at
1024 × 1024 it gives the glyph weight and depth. The inner stroke
respects the safe zone (inscribed circle) of Android's adaptive icon.

**Why no notched terminals?** Notched terminals (the classic Coptic
tetrastauros) are the most authentic shape but they don't survive
masking under Android's circular and squircle masks — terminals end up
clipped. The notched form remains an acceptable v2 if a full design pass
is commissioned later (see `harden-and-polish`).

**Dark variant**: same geometry, swap `primary` → `dark.primary`,
`secondary` → `dark.secondary`, `background` → `dark.background`. The
glyph hue stays warm; the surround flips to deep ink so the icon reads
correctly on a dark home-screen wallpaper.

### Adaptive icon (Android)

- **Foreground**: outer + inner crosses on a transparent 432 × 432
  canvas, centered. Foreground stays inside the 264dp safe-zone circle
  (`Android.adaptiveIcon.foregroundImage`).
- **Background**: `tokens.colors.light.primary` solid fill
  (`Android.adaptiveIcon.backgroundColor`).
- **Mask compatibility**: round, square, squircle, and teardrop all
  render the cross intact. Verified by inspecting the foreground bounds
  against the safe zone before commit.

### Logo component variants

`<Logo />` reuses the same SVG primitives at four target sizes (24, 40,
64, 96) and two variants (`mark`, `combined`). The `combined` variant
adds the wordmark "St. Mina Connect" beneath the glyph, with logical
layout so RTL renders the wordmark to the inline-end of the glyph — but
since the glyph is symmetric, the visual is identical in both
directions.

## 5 — Tone of voice

The product speaks to Coptic Orthodox church servants in Munich. The
audience is bilingual at minimum (Arabic + German), often trilingual
(English added). Tone:

- **Calm, reverent, useful.** Not corporate. Not casual. Not pious.
- **Active, present-tense.** "Mark attendance" — not "Attendance can be
  marked".
- **Plural, not singular.** "Servants" — not "the user". When a person
  is named, use first name.
- **Avoid clergy-only vocabulary** in UI copy. The app is for
  organizational coordination, not liturgical instruction.

### Per-language voice notes

#### English (en)

- American spelling. Short sentences. Sentence-case for everything
  except proper nouns.
- "St. Mina" with the period — never "Saint Mina" in UI; reserve the
  expanded form for the About credits.
- Errors are constructive: "Couldn't reach the server — try again in a
  moment." Not: "Network error 502."

#### Arabic (ar)

- **Modern Standard Arabic (MSA)** for UI labels — not Egyptian
  colloquial — to be readable across diaspora (Egypt, Sudan, Levantine,
  Maghrebi backgrounds all attend Coptic services in Munich).
- Use **service / pastoral vocabulary**, not corporate Arabic. Examples:
  "خدمة" (service) over "مستخدم" (user) where idiomatic; "تسجيل
  الحضور" (recording attendance) over a more sterile equivalent.
- Right-to-left layout is automatic via `I18nManager`. Direction-aware
  iconography (arrows, chevrons) MUST flip via logical CSS / RN
  start/end.

#### German (de)

- **Sie-Form** (formal "you"). The audience includes elders; the
  diocese's printed materials use Sie throughout.
- Composed-noun discipline: prefer the established compound (e.g.
  "Anwesenheit" not "Teilnahme-Eintrag").
- Religious vocabulary follows the German Coptic diocese's existing
  printed glossary (priest = "Priester", deacon = "Diakon", servant =
  "Diener" only when it appears in a formal credit; otherwise use the
  role name).

## 6 — Naming + pronunciation

The bundle name on the device home screen is **St. Mina Connect**. UI
text resolves the displayed name from `t('branding.appName')` per
locale:

| Locale | Displayed name   | Notes                               |
| ------ | ---------------- | ----------------------------------- |
| `en`   | St. Mina Connect | Sentence-case "St."                 |
| `ar`   | خدمة القديس مينا | "Service of Saint Mina" — see below |
| `de`   | St. Mina Connect | English form retained — see below   |

### Pronunciation

- **English**: "Saint MEE-nah" — long /iː/ on the first syllable; soft
  closing /ɑ/. Not "MY-nah".
- **Arabic**: مينا (Mīnā) — long ī, long ā. The transliteration
  "القديس مينا" reads "al-Qiddīs Mīnā" — "the Saint Mina".
- **German**: same as English — "Sankt MEE-nah". Bavarians often
  default-stress the first syllable; reinforce via the
  long-EE pronunciation when introducing the app verbally.

### Why "خدمة القديس مينا" in Arabic?

"Connect" doesn't translate idiomatically. Arabic equivalents
("توصيل" / "تواصل") drift toward "delivery" or "communication" — neither
captures the pastoral coordination meaning. **خدمة (khidma)**, the
Coptic Arabic word for the act of serving in church ministries, carries
the full weight: this app exists to support the servants' service.

### Why "St. Mina Connect" in German?

German Coptic communities use the English transliteration
"St. Mina" in print and on church signage. Introducing a German
rendering ("Heiliger Mina Verbindung") would feel imposed. The bundle
keeps the universal English name; everything else is translated.

## 7 — Do / Don't

| Do                                             | Don't                                                |
| ---------------------------------------------- | ---------------------------------------------------- |
| Use the brand glyph at ≥ 24dp                  | Don't subdivide or recolor the glyph                 |
| Use `useTokens()` for all color values         | Don't introduce ad-hoc hex codes in feature code     |
| Use sentence case for headings                 | Don't TITLE-CASE OR SHOUT                            |
| Pair primary + cream + gold                    | Don't pair primary with anything outside the palette |
| Treat the splash as a calm, branded moment     | Don't animate the splash; leave it static            |
| Respect dark-mode token swaps                  | Don't hardcode a "white" or "black" anywhere         |
| Use logical (start/end) margins under RTL      | Don't use left/right margins in cross-language UI    |
| Refer to "servants" when describing user roles | Don't use "users" — it strips the pastoral context   |

## 8 — Asset locations

- `assets/branding/icon.svg` — source SVG of the icon glyph
- `assets/branding/icon-source.png` — 1024 × 1024 raster (iOS)
- `assets/branding/icon-foreground.png` — 432 × 432 transparent (Android)
- `assets/branding/splash-light.png` — 1284 × 2778 light splash
- `assets/branding/splash-dark.png` — 1284 × 2778 dark splash
- `src/design/components/Logo.tsx` — component (mark + combined variants)
- `src/branding/church.ts` — church identity (read by About screen)
