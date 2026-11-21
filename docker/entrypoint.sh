#!/usr/bin/env bash
# Entrypoint della devbox web LSE Terminal (modalita' dev).
# Parte come root, poi re-exec come utente `lse` (uid 1000) via gosu.
#   1. (ri)crea il venv se il volume anonimo e' vuoto (es. dopo purge)
#   2. avvia `lset` (engine FastAPI + UI) senza aprire il browser
set -u

export HOME=/home/lse

if [ "$(id -u)" = "0" ]; then
  chown lse:lse /home/lse 2>/dev/null || true
  exec gosu lse "$0" "$@"
fi

cd /app

log() { printf '[entrypoint] %s\n' "$*" >&2; }

# Il venv e' nel volume anonimo /app/.venv: se e' stato ricreato vuoto
# (purge, o volume perso dopo `down`), reinstalla al volo. Serve rete.
if [ ! -x .venv/bin/lset ]; then
  log ".venv mancante: reinstall dipendenze da pyproject.toml..."
  python -m venv .venv \
    && .venv/bin/pip install --no-cache-dir --upgrade pip \
    && .venv/bin/pip install --no-cache-dir -e ".[dev]" \
    || { log "ERRORE: install delle dipendenze fallita"; exit 1; }
fi

# Stato utente bind-mountato da workspace/config (gruppo B).
CONFIG_DIR="${LSE_TERMINAL_CONFIG_DIR:-/home/lse/.config/lse-terminal}"
mkdir -p "$CONFIG_DIR" 2>/dev/null || log "WARNING: impossibile creare $CONFIG_DIR"

log "avvio lset su ${LSET_HOST:-127.0.0.1}:${LSET_PORT:-7787} (config: $CONFIG_DIR)"
exec .venv/bin/lset --host "${LSET_HOST:-127.0.0.1}" --port "${LSET_PORT:-7787}" --no-browser
