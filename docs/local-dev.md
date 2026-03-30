# Local Development Setup

## Prerequisites
- Node.js 20+
- Docker (for Supabase CLI)
- Supabase CLI: `brew install supabase/tap/supabase`
- Expo CLI: `npm install -g expo-cli` (optional, `npx expo` works)

## Getting Started

```bash
# Clone and install
git clone git@github.com:markmorcos/stminaconnect.git
cd stminaconnect
npm install

# Copy env
cp .env.example .env

# Start local Supabase (requires Docker)
supabase start
# Copy the anon key and API URL from the output into .env

# Run migrations and seed
supabase db reset

# Start Expo dev server
npx expo start
```

## Makefile Commands
| Command | Description |
|---------|-------------|
| `make dev-up` | Start Supabase + Expo |
| `make dev-down` | Stop Supabase |
| `make migrate-up` | Push migrations |
| `make migrate-down` | Reset database |
| `make migrate-new` | Create new migration |
| `make test` | Run all tests |
| `make seed` | Reset + seed database |
| `make lint` | ESLint + Prettier |
| `make typecheck` | TypeScript check |

## Testing on Device
- iOS: Scan QR code with Camera app (requires Expo Go)
- Android: Scan QR code with Expo Go app
