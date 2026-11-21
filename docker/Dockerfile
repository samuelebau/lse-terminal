# Devbox per l'app web LSE Terminal (engine FastAPI/uvicorn + UI statica) — DEV.
# Mono-utente (uid 1000 `lse`), nessuna autenticazione, niente VNC: e' un'app
# web, si apre nel browser dell'host (vedi DEVBOX.md e docker/README.md).
#
#   make up   ->  http://localhost:7787
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LSET_PORT=7787 \
    LSET_HOST=127.0.0.1

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gosu git \
    && rm -rf /var/lib/apt/lists/*

# Node 20 per i test .mjs e il rebuild del frontend chart (vite). Copiato
# dall'immagine ufficiale (stessa base Debian bookworm). Per *usare* il
# terminale non serve: il bundle chart e' gia' compilato nel repo
# (lse_terminal/ui/static/chart/).
COPY --from=node:20-bookworm-slim /usr/local/bin /usr/local/bin/
COPY --from=node:20-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules/

# Utente con uid 1000 = uid dell'host: i file creati nei bind-mount
# (sorgente, workspace) restano dell'utente.
RUN useradd -u 1000 -m -s /bin/bash lse

WORKDIR /app
# /app e' di root (creata da WORKDIR): la si dà a `lse`, che deve poterci
# creare il venv (come il chown node:node della devbox tradenza).
RUN chown lse:lse /app

# Il sorgente a runtime arriva bind-mountato; in immagine serve perche'
# `pip install -e .` deve vedere il package (hatchling richiede anche
# README.md, dichiarato in pyproject.toml).
COPY --chown=lse:lse pyproject.toml README.md ./
COPY --chown=lse:lse lse_terminal ./lse_terminal
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER lse
# Il venv vive nell'immagine; il compose lo protegge dal bind-mount del
# sorgente con un volume anonimo /app/.venv (come node_modules in tradenza).
# Dopo un cambio in pyproject.tomle: `make install` per risincronizzare.
RUN python -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir --upgrade pip \
    && /app/.venv/bin/pip install --no-cache-dir -e ".[dev]"

VOLUME ["/app/.venv"]
ENV PATH="/app/.venv/bin:${PATH}"

EXPOSE 7787

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
