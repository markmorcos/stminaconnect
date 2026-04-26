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
	npx supabase db reset

.PHONY: migrate-new
migrate-new: ## Create a new migration: make migrate-new NAME=add_persons
	@if [ -z "$(NAME)" ]; then echo "Usage: make migrate-new NAME=<snake_case_name>"; exit 1; fi
	npx supabase migration new $(NAME)

.PHONY: seed
seed: docker-check ## Seed the local DB (1 admin + 4 servants + 20 persons)
	@if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_stminaconnect$$'; then \
		echo "ERROR: supabase_db_stminaconnect container is not running. Run 'make dev-up' first."; \
		exit 1; \
	fi
	docker exec -i supabase_db_stminaconnect psql -U postgres -d postgres < supabase/seed.sql

# -------------------------------------------------------------------
# Deploys (placeholders — wired in later phases)
# -------------------------------------------------------------------

.PHONY: deploy-functions
deploy-functions: ## Deploy Edge Functions (placeholder)
	@echo "deploy-functions: no-op until phase 10 (add-google-calendar-sync)"

.PHONY: deploy-migrations
deploy-migrations: ## Deploy migrations to remote Supabase (placeholder)
	@echo "deploy-migrations: no-op until phase 22 (setup-production-deployment)"

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
expo-start: ## Start the Expo dev server (Expo Go)
	npx expo start
