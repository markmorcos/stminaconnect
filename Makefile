.PHONY: dev-up dev-down migrate-up migrate-down migrate-new test test-watch seed lint typecheck deploy-functions build-ios build-android

dev-up:
	supabase start & npx expo start

dev-down:
	supabase stop

migrate-up:
	supabase db push

migrate-down:
	supabase db reset

migrate-new:
	@read -p "Migration name: " name; \
	supabase migration new $$name

test:
	npx jest --coverage
	@echo "Edge Function tests require Deno - run manually in supabase/functions/"

test-watch:
	npx jest --watch

seed:
	supabase db reset

lint:
	npx eslint . --ext .ts,.tsx
	npx prettier --check "src/**/*.{ts,tsx}" "app/**/*.{ts,tsx}"

typecheck:
	npx tsc --noEmit

deploy-functions:
	supabase functions deploy --all

build-ios:
	npx eas build --platform ios --profile preview

build-android:
	npx eas build --platform android --profile preview
