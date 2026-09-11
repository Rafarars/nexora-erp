SHELL := /bin/bash
.DEFAULT_GOAL := help

GITLEAKS := zricethezav/gitleaks:v8.18.4

# Por defecto apunta al Postgres del compose. Se sobreescribe desde el entorno.
DATABASE_URL ?= postgresql://nexora:nexora@localhost:5432/nexora?schema=public

.PHONY: help install env up down seed restart ps logs migrate lint typecheck test-unit test-contract test-e2e secrets verify verify-clean clean report

help: ## Muestra los comandos disponibles
	@echo ""
	@echo "  Nexora ERP"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ---------------------------------------------------------------- entorno

install: ## Instala dependencias (genera el cliente de Prisma)
	pnpm install

env: ## Crea el .env local si falta y genera un JWT_SECRET aleatorio (solo desarrollo)
	@if [ ! -f .env ]; then cp .env.example .env; echo "  .env creado desde la plantilla"; fi
	@if ! grep -qE '^JWT_SECRET=.+' .env; then \
		secret=$$(openssl rand -hex 32); \
		if grep -q '^JWT_SECRET=' .env; then \
			sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$$secret|" .env && rm -f .env.bak; \
		else \
			printf '\nJWT_SECRET=%s\n' "$$secret" >> .env; \
		fi; \
		echo "  JWT_SECRET generado"; \
	fi

up: ## Levanta el sistema completo (db + api + web) y aplica migraciones
	@if [ -z "$$JWT_SECRET" ] && ! grep -qE '^JWT_SECRET=.+' .env 2>/dev/null; then \
		echo ""; \
		echo "  Falta JWT_SECRET."; \
		echo ""; \
		echo "    Desarrollo local:  make env               (crea .env y genera un secreto)"; \
		echo "    Manual:            cp .env.example .env   y editarlo"; \
		echo "    Servidor:          exportar las variables del proveedor"; \
		echo ""; \
		exit 1; \
	fi
	docker compose up -d --build
	$(MAKE) --no-print-directory migrate
	@echo ""
	@echo "  web    http://localhost:3000"
	@echo "  api    http://localhost:3001/health"

down: ## Detiene el sistema
	docker compose down

restart: down up ## Reinicia el sistema

ps: ## Estado de los servicios
	docker compose ps

logs: ## Sigue los registros de todos los servicios
	docker compose logs -f

migrate: ## Aplica las migraciones pendientes y sincroniza el catalogo de permisos
	DATABASE_URL="$(DATABASE_URL)" pnpm --filter api exec prisma migrate deploy
	DATABASE_URL="$(DATABASE_URL)" pnpm --filter api permissions:sync

seed: ## Siembra datos de demostracion (dos empresas; nunca en produccion)
	DATABASE_URL="$(DATABASE_URL)" pnpm --filter api seed

# ---------------------------------------------------------------- checks

lint: ## Linter en todos los paquetes
	pnpm lint

typecheck: ## Verificacion de tipos en todos los paquetes
	pnpm typecheck

test-unit: ## Pruebas unitarias de la API y del frontend (sin base de datos)
	pnpm test:unit

test-contract: ## Contrato de puerto contra PostgreSQL (requiere la base levantada)
	DATABASE_URL="$(DATABASE_URL)" pnpm --filter api test:integration

test-e2e: ## Suite de Playwright (requiere el sistema levantado)
	pnpm test:e2e

secrets: ## Busca credenciales filtradas en todo el historial
	docker run --rm -v "$$PWD:/repo:ro" $(GITLEAKS) detect --source=/repo --redact

report: ## Abre el ultimo reporte de Playwright
	pnpm --filter e2e exec playwright show-report

# ---------------------------------------------------------------- verify

verify: ## Corre TODO lo que corre el CI (usar antes de cada push)
	@echo "==> 1/6 secrets";   $(MAKE) --no-print-directory secrets
	@echo "==> 2/6 lint";      $(MAKE) --no-print-directory lint
	@echo "==> 3/6 typecheck"; $(MAKE) --no-print-directory typecheck
	@echo "==> 4/6 unit";      $(MAKE) --no-print-directory test-unit
	@echo "==> 5/6 contract";  $(MAKE) --no-print-directory up test-contract
	@echo "==> 6/6 e2e";       $(MAKE) --no-print-directory test-e2e
	@echo ""
	@echo "  Todo en verde."

verify-clean: ## Como verify, pero borrando antes TODO lo generado (simula un clon limpio)
	$(MAKE) --no-print-directory clean
	$(MAKE) --no-print-directory install
	docker compose build --no-cache
	$(MAKE) --no-print-directory verify

clean: ## Borra artefactos generados (codigo derivado y dependencias)
	rm -rf apps/api/src/generated apps/api/dist apps/api/node_modules
	rm -rf apps/web/.next apps/web/node_modules
	rm -rf apps/e2e/node_modules apps/e2e/playwright-report apps/e2e/test-results
	rm -rf node_modules
