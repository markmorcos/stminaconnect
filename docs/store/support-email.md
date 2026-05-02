# Support Email — `support@stminaconnect.com`

Required by both stores as the point of contact for users. Must be live and capable of receiving mail before any submission. Used in:

- App Store Connect → App Information → Support URL (or `mailto:` here).
- Play Console → Store presence → Contact details → Email.
- Privacy Policy and Terms (`docs/legal/`).
- The marketing landing page (`docs/marketing/landing.md`).
- The store listings (`docs/store/listings/{en,ar,de}.md`).

## Provisioning (one-time)

Pick **one** of the options below, depending on where DNS for `stminaconnect.com` is hosted.

### Option A — Cloudflare Email Routing (free, recommended for solo dev)

1. Cloudflare dashboard → `stminaconnect.com` zone → **Email → Email Routing** → Enable.
2. Cloudflare adds the required MX + SPF + DKIM records automatically.
3. Click **Routes → Create address**:
   - **Custom address**: `support@stminaconnect.com`.
   - **Action**: Send to → developer's existing personal inbox (e.g. `mark.yehia@gmail.com`).
4. Verify the destination inbox via the email Cloudflare sends.
5. Send a test mail to `support@stminaconnect.com` from another address; confirm it arrives in the destination inbox.

### Option B — Google Workspace ($6/user/month)

1. workspace.google.com → Sign up using `stminaconnect.com`.
2. Verify domain ownership (DNS TXT).
3. Create a single user `support@stminaconnect.com` (or a group of that name).
4. Configure MX records per the Workspace setup wizard.

### Option C — IMAP at the registrar

Most domain registrars (Hetzner, Namecheap, Porkbun) offer a basic mailbox bundle. Set MX, create the mailbox, point DNS, done. Configure IMAP in any mail client.

## Autoresponder template (task 9.5)

Configure a simple autoresponder on `support@stminaconnect.com` so reviewers and users get an immediate acknowledgement. Suggested text:

```
Subject: Thanks for contacting St. Mina Connect

Hi there,

Thanks for getting in touch. We've received your message and will reply within 2 business days.

For data-protection requests (access, export, erasure), please use privacy@stminaconnect.com — these are routed to a separate queue with shorter SLAs.

— The St. Mina Connect team
```

In Cloudflare Email Routing the autoresponder lives at the destination inbox (Gmail → Settings → Vacation responder, etc.) — Cloudflare itself does not autoresponse on routed addresses.

## Verification (task 9.5 acceptance)

1. From an unrelated address, send: "Test — store submission readiness check".
2. Within 2 minutes, the autoresponder reply lands in the sender's inbox.
3. The original mail lands in the developer's destination inbox.
4. Both confirmed → tick task 9.5 in `tasks.md`.

## privacy@stminaconnect.com

Same provisioning, separate route. Required by the Privacy Policy (`docs/legal/privacy.en.md`). Set this up at the same time as `support@`.
