# Deployment

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Production                      │
│                                                   │
│  ┌─────────────────┐    ┌──────────────────────┐ │
│  │ Supabase Cloud   │    │ Raspberry Pi 5       │ │
│  │ (EU Frankfurt)   │    │ (Self-hosted)        │ │
│  │                  │    │                      │ │
│  │ - Postgres       │    │ - K8s cluster        │ │
│  │ - Auth           │    │ - Edge Functions*    │ │
│  │ - Storage        │    │ - Nginx Ingress      │ │
│  │ - Realtime       │    │ - cert-manager       │ │
│  └─────────────────┘    └──────────────────────┘ │
│           ▲                       ▲               │
│           │                       │               │
└───────────┼───────────────────────┼───────────────┘
            │                       │
     ┌──────┴──────┐      ┌────────┴────────┐
     │ Mobile App   │      │ GitHub Actions   │
     │ (TestFlight  │      │ CI/CD Pipeline   │
     │  + APK)      │      └─────────────────┘
     └─────────────┘
```

\*Edge Functions can run on Supabase Cloud or self-hosted on Pi5 via Deno.

## Decision: Where to Run Edge Functions

| Option             | Pros                                    | Cons                         | Recommendation                  |
| ------------------ | --------------------------------------- | ---------------------------- | ------------------------------- |
| Supabase Cloud     | Zero infra, built-in pg_cron, free tier | Limited compute, cold starts | **Use for v1**                  |
| Self-hosted on Pi5 | Full control, no limits                 | More infra to maintain       | Fallback if Supabase limits hit |

**Recommendation**: Start with Supabase Cloud Edge Functions. They're free, managed, and sufficient for < 200 members. Move to Pi5 only if you need more compute or lower latency.

## Mobile App Distribution

| Platform | Method                                 | Notes                                       |
| -------- | -------------------------------------- | ------------------------------------------- |
| iOS      | TestFlight (internal)                  | Requires Apple Developer account ($99/year) |
| Android  | Direct APK / Firebase App Distribution | No Play Store needed for internal use       |

### EAS Build Configuration

```json
// eas.json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

**Build commands** (in Makefile):

```makefile
build-ios:
	eas build --platform ios --profile preview

build-android:
	eas build --platform android --profile preview
```

## CI/CD Pipeline

### GitHub Actions: CI

Runs on every push and pull request.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    name: Lint + Typecheck + Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint . --max-warnings 0
      - run: npx prettier --check .
      - run: npx jest --ci --coverage
```

### GitHub Actions: Deploy Edge Functions

Runs on merge to main when Edge Function files change.

```yaml
# .github/workflows/deploy.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - "supabase/functions/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### GitHub Actions: Deploy to Pi5 (Optional)

For self-hosted Edge Functions, matching your existing infrastructure pattern.

```yaml
# .github/workflows/deploy-pi5.yml
name: Deploy to Pi5

on:
  workflow_dispatch: {}
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger infrastructure deployment
        uses: peter-evans/repository-dispatch@v2
        with:
          token: ${{ secrets.INFRASTRUCTURE_PAT }}
          repository: markmorcos/infrastructure
          event-type: deploy-stminaconnect
          client-payload: |-
            {
              "repository": "markmorcos/stminaconnect",
              "token": "${{ secrets.DEPLOYMENT_TOKEN }}",
              "version": "${{ github.sha }}",
              "config_file": "deployment.yaml"
            }
```

## deployment.yaml (for Pi5 Helm chart)

Following your existing pattern from other projects:

```yaml
chartVersion: 0.2.8
project:
  name: "stminaconnect"
repository:
  name: "markmorcos/stminaconnect"
  path: "."

deployments:
  - name: stminaconnect-functions
    image: ghcr.io/markmorcos/stminaconnect-functions
    env:
      - name: SUPABASE_URL
        valueFrom:
          secretKeyRef:
            name: stminaconnect-secret
            key: SUPABASE_URL
      - name: SUPABASE_SERVICE_ROLE_KEY
        valueFrom:
          secretKeyRef:
            name: stminaconnect-secret
            key: SUPABASE_SERVICE_ROLE_KEY
      - name: GOOGLE_SERVICE_ACCOUNT_KEY
        valueFrom:
          secretKeyRef:
            name: stminaconnect-secret
            key: GOOGLE_SERVICE_ACCOUNT_KEY
      - name: GOOGLE_CALENDAR_ID
        valueFrom:
          secretKeyRef:
            name: stminaconnect-secret
            key: GOOGLE_CALENDAR_ID
      - name: EXPO_PUSH_ACCESS_TOKEN
        valueFrom:
          secretKeyRef:
            name: stminaconnect-secret
            key: EXPO_PUSH_ACCESS_TOKEN

services:
  - name: stminaconnect-service
    port: 8000

ingress:
  host: stminaconnect.morcos.tech
  rules:
    - host: stminaconnect.morcos.tech
      path: /functions/
      pathType: Prefix
      serviceName: stminaconnect-service
```

## Dockerfile (Edge Functions — self-hosted)

```dockerfile
FROM denoland/deno:alpine AS base

WORKDIR /app

# Copy function source
COPY supabase/functions/ ./functions/

# Cache dependencies
RUN deno cache functions/*/index.ts

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget --quiet --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "functions/serve.ts"]
```

## Database Migrations (Production)

Migrations are deployed via Supabase CLI linked to the production project:

```bash
# Link to production (one-time setup)
supabase link --project-ref <project-ref>

# Deploy migrations
supabase db push --linked

# Deploy Edge Functions
supabase functions deploy --project-ref <project-ref>
```

**Safety**: Always test migrations locally first (`supabase db reset` → verify), then push to production.

## Environment Variables

### Required Secrets (GitHub Actions)

| Secret                  | Where Used           | Notes                          |
| ----------------------- | -------------------- | ------------------------------ |
| `SUPABASE_PROJECT_REF`  | Edge Function deploy | From Supabase dashboard        |
| `SUPABASE_ACCESS_TOKEN` | Edge Function deploy | Personal access token          |
| `INFRASTRUCTURE_PAT`    | Pi5 deploy trigger   | GitHub PAT with repo dispatch  |
| `DEPLOYMENT_TOKEN`      | Pi5 Helm deploy      | JWT for deploy.sh verification |

### Required Secrets (Kubernetes — Pi5)

| Secret                 | Key                          | Notes                       |
| ---------------------- | ---------------------------- | --------------------------- |
| `stminaconnect-secret` | `SUPABASE_URL`               | Production Supabase URL     |
|                        | `SUPABASE_SERVICE_ROLE_KEY`  | Service role (not anon) key |
|                        | `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON key for Google API     |
|                        | `GOOGLE_CALENDAR_ID`         | Church calendar ID          |
|                        | `EXPO_PUSH_ACCESS_TOKEN`     | For Expo Push API           |

## OTA Updates (Future)

Expo supports OTA updates via EAS Update. This allows pushing JS-only changes without rebuilding the binary:

```bash
eas update --branch preview --message "Fix RTL layout bug"
```

Not needed for v1 (internal TestFlight/APK), but useful once the app is more stable.

## Monitoring (v1 — Minimal)

| What                       | How                                             |
| -------------------------- | ----------------------------------------------- |
| Edge Function logs         | Supabase Dashboard → Functions → Logs           |
| Database errors            | Supabase Dashboard → Database → Logs            |
| Push notification receipts | Edge Function logs delivery status              |
| App crashes                | Console logs on device. Consider Sentry for v2. |

No external monitoring service for v1. Supabase dashboard is sufficient.
