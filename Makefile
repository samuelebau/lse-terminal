# Makefile della devbox "LSE Terminal" — app web Python (FastAPI) in dev.
# Vive alla radice della platform: invocarlo da qui (`cd platforms/lse-terminal && make ...`).
# Tutti i target girano via Docker: non serve Python/Node sull'host.

COMPOSE := docker compose -f docker/docker-compose.yml
SERVICE := app
APP_PORT ?= 7787
export APP_PORT

.DEFAULT_GOAL := help

.PHONY: help
help: ## Mostra questo elenco dei target
	@awk 'BEGIN {FS = ":.*##"; printf "\n\033[1mLSE Terminal devbox - comandi disponibili\033[0m\n\n"} \
		/^[a-zA-Z0-9_./-]+:.*##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Setup
.PHONY: init
init: ## Precrea le cartelle utente workspace/ (gruppo B) se mancano
	@mkdir -p workspace/config workspace/download workspace/output workspace/import
	@touch workspace/.gitkeep workspace/config/.gitkeep workspace/download/.gitkeep \
	      workspace/output/.gitkeep workspace/import/.gitkeep
	@echo "workspace/ pronto."

##@ Devbox (runtime)
.PHONY: up
up: init build ## Avvia il terminale in background (build dell'immagine se serve)
	$(COMPOSE) up -d
	@echo
	@echo "Terminale: http://localhost:$(APP_PORT)"
	@echo "Health:    http://localhost:$(APP_PORT)/api/health"

.PHONY: up-fg
up-fg: init build ## Avvia in primo piano (log visibili, Ctrl+C per fermare)
	$(COMPOSE) up

.PHONY: down
down: ## Ferma e rimuove il container (mantiene venv e workspace)
	$(COMPOSE) down

.PHONY: restart
restart: ## Riavvia l'app (ricarica sorgente e configurazione)
	$(COMPOSE) restart $(SERVICE)

.PHONY: stop
stop: ## Ferma il container senza rimuoverlo
	$(COMPOSE) stop

.PHONY: start
start: ## Avvia il container gia' creato (senza rebuild)
	$(COMPOSE) start

.PHONY: logs
logs: ## Segue i log dell'app
	$(COMPOSE) logs -f $(SERVICE)

.PHONY: ps
ps: ## Stato dei container
	$(COMPOSE) ps

.PHONY: status
status: ps ## Alias di ps

.PHONY: shell
shell: ## Apre una shell bash nel container (utente lse, venv nel PATH)
	$(COMPOSE) exec $(SERVICE) bash

.PHONY: exec
exec: ## Esegue un comando nell'app: make exec CMD=".venv/bin/pip list"
	$(COMPOSE) exec $(SERVICE) $(CMD)

.PHONY: web
web: ## Apre il terminale nel browser (http://localhost:APP_PORT)
	@URL="http://localhost:$(APP_PORT)"; \
	if command -v xdg-open >/dev/null 2>&1; then xdg-open "$$URL"; \
	elif command -v open >/dev/null 2>&1; then open "$$URL"; \
	else echo "Apri manualmente: $$URL"; fi

##@ Build immagini
.PHONY: build
build: ## Builda l'immagine dell'app (usa la cache se disponibile)
	$(COMPOSE) build

.PHONY: rebuild
rebuild: ## Builda da zero l'immagine dell'app (no cache)
	$(COMPOSE) build --no-cache

##@ Sviluppo (dentro il container)
.PHONY: install
install: ## Risincronizza le dipendenze Python (dopo un cambio in pyproject.toml)
	$(COMPOSE) exec $(SERVICE) .venv/bin/pip install -e ".[dev]"

.PHONY: install-ml
install-ml: ## Installa gli extra ML (scikit-learn, xgboost, lightgbm, catboost, ...)
	$(COMPOSE) exec $(SERVICE) .venv/bin/pip install -e ".[ml]"

.PHONY: test
test: ## Esegue pytest nel container
	$(COMPOSE) exec $(SERVICE) .venv/bin/python -m pytest tests/

.PHONY: test-mjs
test-mjs: ## Esegue i test .mjs con Node (nessuna dipendenza npm richiesta)
	$(COMPOSE) exec $(SERVICE) bash -c 'for f in tests/test_*.mjs; do echo "== $$f"; node "$$f" || exit 1; done'

.PHONY: frontend-install
frontend-install: ## npm ci del frontend chart (richiesto una volta, prima del build)
	$(COMPOSE) exec $(SERVICE) bash -c 'cd frontend && npm ci --no-audit --no-fund'

.PHONY: frontend-build
frontend-build: ## Ricompila il bundle chart (frontend -> lse_terminal/ui/static/chart)
	$(COMPOSE) exec $(SERVICE) bash -c 'cd frontend && npm run build'

.PHONY: frontend-typecheck
frontend-typecheck: ## tsc --noEmit del frontend chart
	$(COMPOSE) exec $(SERVICE) bash -c 'cd frontend && npm run typecheck'

##@ Reset stato
.PHONY: purge
purge: down ## Ferma i container E cancella il volume del venv (riparte dall'immagine)
	$(COMPOSE) down -v
	@echo "Volume .venv cancellato (si ricrea al prossimo avvio). I dati utente in workspace/ sono preservati."

.PHONY: reset-workspace
reset-workspace: ## ATTENZIONE: svuota workspace/ (key LSE, workspace, notebook, chat, ML)
	@read -r -p "Cancellare TUTTI i dati utente (inclusa la key LSE) in workspace/? [s/N] " ans; [ "$$ans" = "s" ] || { echo "Annullato."; exit 1; }
	rm -rf workspace/config/* workspace/download/* workspace/output/* workspace/import/*
	@echo "workspace/ svuotato."

##@ Manutenzione
.PHONY: prune
prune: ## Rimuove immagini, container e reti non usati da Docker
	docker system prune -f

.PHONY: clean
clean: down ## Alias di down (mantiene i volumi)

.PHONY: check
check: ## Verifica la configurazione del compose (lista servizi)
	$(COMPOSE) config --services
