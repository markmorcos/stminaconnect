# `secrets/` — local-only credential drop

This folder holds credential files referenced by `eas.json` and other tooling. Everything inside is **gitignored** except this README and `.gitkeep`. Never commit anything else.

## Expected files (none are checked in)

| File                        | Source                                                                                               | Used by                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `play-service-account.json` | Google Play Console → Setup → API access → Create service account → grant Release Manager + JSON key | `eas submit -p android` (path: `submit.production.android.serviceAccountKeyPath`) |

## Provisioning workflow

1. Drop the credential file into this folder locally.
2. Upload it to EAS so CI / shared builds can read it:
   ```bash
   eas secret:create --scope project --name PLAY_SERVICE_ACCOUNT --type file --value ./secrets/play-service-account.json
   ```
3. Verify it never reached git:
   ```bash
   git check-ignore -v secrets/play-service-account.json
   ```
4. The local file remains; CI consumes the EAS secret.
