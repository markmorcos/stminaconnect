# Marketing Landing Page — `stminaconnect.com`

Single static page, deployed via the same hosting setup as the legal docs (Cloudflare Pages or GitHub Pages). Source markdown lives in this file; deployment workflow is described under "Deployment" below.

## Page structure

```
[Hero]
  Logo · "St. Mina Connect"
  Tagline: "Pastoral care for your community"
  Sub: "Track attendance, follow up with members, and stay connected — built for church servants."
  CTA buttons: "App Store" · "Google Play"   (link out; placeholder until live)

[Three screenshots]
  Quick Add · Check-in · Servant Dashboard
  (use the EN framed assets from `assets/store/screenshots-framed/ios/en/`)

[What it does]
  Same as the EN store full description — three short paragraphs:
  - Built for servants
  - Built for your church
  - Privacy-first

[Privacy & Terms]
  Two prominent links:
  - Privacy Policy → /privacy   (links to `docs/legal/privacy.en.md`-equivalent rendered HTML)
  - Terms of Service → /terms   (links to `docs/legal/terms.en.md`-equivalent rendered HTML)

[Contact]
  support@stminaconnect.com

[Footer]
  © 2026 · Built by Mark Morcos · GitHub: stminaconnect (private)
```

## Copy (English — first deploy)

### Hero

> # St. Mina Connect
>
> ### Pastoral care for your community
>
> Track attendance, follow up with members, and stay connected — built for church servants.

### What it does

**Built for servants.** Quick Add captures a new member in seconds. Check-in marks attendance for an entire group from one roster. Follow-ups surface members who have been absent or asked to be on break, so no one is forgotten.

**Built for your church.** Admins see the whole community at a glance: attendance trends, follow-up coverage, servant assignments. Each volunteer's dashboard shows who they are responsible for and what is pending.

**Privacy-first.** Member data lives on EU infrastructure. We do not run analytics, do not run ads, and do not share data with third parties. GDPR rights — access, export, erasure — are built in from day one.

### Footer copy

```
support@stminaconnect.com    ·    Privacy    ·    Terms    ·    © 2026
```

## Localization (post-launch)

The first deploy is English-only; AR and DE pages can mirror `docs/store/listings/{ar,de}.md`. Routes:

- `/` · English (default)
- `/ar/` · Arabic
- `/de/` · German

## Deployment

The legal docs already live on a static-site host (see `docs/legal/hosting.md` if present, otherwise ask the maintainer where `docs/legal/privacy.en.md` is currently rendered).

The recommended flow:

1. Add a `marketing/` subtree to the same repo (or a new `stminaconnect-site` repo).
2. Render this markdown via Eleventy / Astro / hand-written HTML — a single page is enough.
3. Configure the host to serve `stminaconnect.com` (CNAME or DNS A record at the registrar).
4. Add a `/privacy` and `/terms` route that renders `docs/legal/privacy.en.md` and `docs/legal/terms.en.md` (or links to wherever they currently live).
5. Verify HTTPS, then verify a `curl -I https://stminaconnect.com` returns `HTTP/2 200`.

Until the marketing page is live, the App Store / Play Console "Marketing URL" field can point at the privacy page directly — Apple/Google accept that.

## Acceptance check (task 9.4)

- `curl -I https://stminaconnect.com` → `HTTP/2 200`
- Page contains text "St. Mina Connect" and at least one screenshot image tag
- Privacy and Terms links resolve (HTTP 200) on click
