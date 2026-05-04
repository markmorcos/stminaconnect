SHELL := /bin/bash

.DEFAULT_GOAL := help

# -------------------------------------------------------------------
# Utilities
# -------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.PHONY: docker-check
docker-check:
	@if ! command -v docker >/dev/null 2>&1; then \
		echo "ERROR: Docker is not installed. The Supabase CLI requires Docker to run the local stack."; \
		echo "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"; \
		exit 1; \
	fi
	@if ! docker info >/dev/null 2>&1; then \
		echo "ERROR: Docker is installed but the daemon is not running. Start Docker Desktop and retry."; \
		exit 1; \
	fi

# -------------------------------------------------------------------
# Install / dev stack
# -------------------------------------------------------------------

.PHONY: install
install: docker-check ## Install JS deps; verify Docker is available
	npm ci

.PHONY: dev-up
dev-up: docker-check ## Start the local Supabase stack
	npx supabase start

.PHONY: dev-down
dev-down: ## Stop the local Supabase stack
	npx supabase stop

# -------------------------------------------------------------------
# Migrations
# -------------------------------------------------------------------

.PHONY: migrate-up
migrate-up: ## Apply pending migrations to the local DB
	npx supabase migration up

.PHONY: migrate-down
migrate-down: ## DESTRUCTIVE: reset the local DB and re-apply all migrations
	npx supabase db reset && make seed

.PHONY: migrate-new
migrate-new: ## Create a new migration: make migrate-new NAME=add_persons
	@if [ -z "$(NAME)" ]; then echo "Usage: make migrate-new NAME=<snake_case_name>"; exit 1; fi
	npx supabase migration new $(NAME)

.PHONY: seed
seed: docker-check ## Seed the local DB (5 priests + 20 servants + 200 persons + Vault)
	@if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_stminaconnect$$'; then \
		echo "ERROR: supabase_db_stminaconnect container is not running. Run 'make dev-up' first."; \
		exit 1; \
	fi
	@SRK=$$(npx supabase status -o json | jq -r .SERVICE_ROLE_KEY); \
	if [ -z "$$SRK" ] || [ "$$SRK" = "null" ]; then \
		echo "WARN: could not read SERVICE_ROLE_KEY — Vault block will skip."; \
		SRK=""; \
	fi; \
	{ printf "SET app.service_role_key = %s;\n" "'$$SRK'"; cat supabase/seed.sql; } | \
		docker exec -i supabase_db_stminaconnect \
			psql -U postgres -d postgres -v ON_ERROR_STOP=1

# -------------------------------------------------------------------
# Deploys (placeholders — wired in later phases)
# -------------------------------------------------------------------

# PROJECT=preview|prod (defaults to preview to keep prod ops explicit). The
# Supabase CLI must already be linked to the corresponding project ref —
# `supabase link --project-ref <ref>` once per checkout, persisted under
# `supabase/.temp/`. The CI deploy workflow at
# `.github/workflows/deploy-supabase.yml` is the canonical path; these
# targets exist for local debugging when CI is unhealthy or for ad-hoc
# operations under the developer's eye.
PROJECT ?= preview
PREVIEW_REF := ljnuaefrsfscqnywvojd
PROD_REF    := hdcwafpagxujovqivzzz

# Edge Functions deployed in lockstep. Keep this list in sync with the
# `FUNCTIONS` env in `.github/workflows/deploy-supabase.yml`.
SUPABASE_FUNCTIONS := \
	sync-calendar-events \
	send-push-notification \
	detect-absences \
	invite-servant \
	delete-auth-user \
	weekly-backup \
	review-login

.PHONY: _project-ref
_project-ref:
	@if [ "$(PROJECT)" = "prod" ]; then \
		echo "$(PROD_REF)"; \
	elif [ "$(PROJECT)" = "preview" ]; then \
		echo "$(PREVIEW_REF)"; \
	else \
		echo "ERROR: PROJECT must be 'preview' or 'prod' (got '$(PROJECT)')" >&2; \
		exit 1; \
	fi

.PHONY: _confirm-prod
_confirm-prod:
	@if [ "$(PROJECT)" = "prod" ] && [ -t 0 ] && [ "$$ASSUME_YES" != "1" ]; then \
		read -p "About to operate on the PROD Supabase project ($(PROD_REF)). Continue? [y/N] " ans; \
		if [ "$$ans" != "y" ] && [ "$$ans" != "Y" ]; then \
			echo "Aborted."; \
			exit 1; \
		fi; \
	fi

.PHONY: deploy-migrations
deploy-migrations: ## Push migrations to a Supabase project: make deploy-migrations PROJECT=preview|prod
	@$(MAKE) -s _confirm-prod
	@REF=$$($(MAKE) -s _project-ref); \
	echo "Linking to $$REF"; \
	supabase link --project-ref $$REF; \
	echo "Pushing migrations to $$REF"; \
	supabase db push

.PHONY: deploy-functions
deploy-functions: ## Deploy Edge Functions to a Supabase project: make deploy-functions PROJECT=preview|prod
	@$(MAKE) -s _confirm-prod
	@REF=$$($(MAKE) -s _project-ref); \
	echo "Linking to $$REF"; \
	supabase link --project-ref $$REF; \
	echo "Deploying $(SUPABASE_FUNCTIONS)"; \
	supabase functions deploy $(SUPABASE_FUNCTIONS) --project-ref $$REF

.PHONY: deploy-supabase
deploy-supabase: deploy-migrations deploy-functions ## Push migrations + deploy all Edge Functions in one shot

# -------------------------------------------------------------------
# Quality gates
# -------------------------------------------------------------------

.PHONY: lint
lint: ## Run ESLint
	npm run lint

.PHONY: typecheck
typecheck: ## Run TypeScript in --noEmit mode
	npm run typecheck

.PHONY: test
test: ## Run the Jest test suite
	npm test

.PHONY: test-coverage
test-coverage: ## Run tests with coverage
	npm test -- --coverage

# -------------------------------------------------------------------
# Expo
# -------------------------------------------------------------------

.PHONY: expo-start
expo-start: ## Start the Expo dev server (Expo Go — legacy; prefer expo-start-dev-client)
	npx expo start

.PHONY: expo-start-dev-client
expo-start-dev-client: ## Start the Expo dev server for an installed dev client (canonical from phase 16+)
	npx expo start --dev-client

# -------------------------------------------------------------------
# EAS builds (require `eas-cli` installed globally + `eas login`)
# -------------------------------------------------------------------

.PHONY: build-dev-ios
build-dev-ios: ## Build a development client for iOS via EAS (~10–30 min on free tier)
	eas build --profile development --platform ios

.PHONY: build-dev-android
build-dev-android: ## Build a development client for Android via EAS
	eas build --profile development --platform android

.PHONY: build-preview
build-preview: ## Build the preview profile (prod-like, internal distribution) for both platforms
	eas build --profile preview --platform all

.PHONY: build-prod
build-prod: ## Build the production profile (signed, store-ready) for both platforms — gated by confirmation
	@read -p "Confirm production build? This produces signed iOS .ipa + Android .aab artefacts. [y/N] " ans; \
	if [ "$$ans" != "y" ] && [ "$$ans" != "Y" ]; then \
		echo "Aborted."; \
		exit 1; \
	fi; \
	eas build --profile production --platform all
