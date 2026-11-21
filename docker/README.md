# LSE Terminal devbox — documentazione tecnica

La devbox LSE Terminal e' una **devbox web** (come `platforms/tradenza`, non
un desktop via VNC come `platforms/motivewave`): gira l'engine
`lset` dal sorgente bind-mountato e lo espone su `http://localhost:7787`.
Stack: **Python 3.11** + FastAPI/uvicorn (engine) + **Node 20** (solo per i
test `.mjs` e il rebuild del frontend chart). Per l'uso quotidiano vedi
`DEVBOX.md`.

## Perche' web e non desktop

LSE Terminal su Linux gira "from source": `lset` avvia l'engine e apre il
terminale in una scheda del browser (`lset --no-browser --host --port` esiste
proprio per l'uso headless/server, vedi `lse_terminal/cli.py`). Il desktop
virtuale (Xvfb/VNC) servirebbe solo a incapsulare un browser, che l'host ha
gia'. Electron (`desktop/`) e' il wrapper dei soli installer Windows/Mac e
non e' usato dalla devbox.

## Stack

| Pezzo    | Immagine                  | Note                             |
|---------|---------------------------|----------------------------------|
| App (dev)| `python:3.11-slim-bookworm`| `tm_lse_terminal:latest`         |
| Node     | copiato da `node:20-bookworm-slim`| test `.mjs`, `vite build` chart |
| venv     | `/app/.venv` (`.[dev]`)   | volume anonimo, vedi sotto       |
| DB       | — nessuno                 | lo stato dell'app e' su file     |

Python 3.11 perche' e' la versione con cui il progetto pinna la build
Windows (3.11.9); `pyproject.toml` richiede >=3.10.

## Persistenza

Non ci sono volumi Docker con nome: lo stato dell'app e' tutto su file, in
una sola cartella.

- **Workspace (B)** — `platforms/lse-terminal/workspace/config/` →
  `/home/lse/.config/lse-terminal` (via `LSE_TERMINAL_CONFIG_DIR`):
  key LSE (`config.json`), workspace delle strategie, dati importati,
  notebook, dashboard, chat dell'assistente, ML runtime installs, adapter
  broker custom. Preservato da `make purge`; svuotato solo con
  `make reset-workspace`.
- **venv (A)** — volume **anonimo** `/app/.venv`: protegge il venv
  dell'immagine dal bind-mount del sorgente (stesso schema di
  `/app/node_modules` nella devbox tradenza). `make purge` (`down -v`) lo
  cancella: si ricrea dall'immagine al prossimo `up`. Se dopo `down` l'avvio
  parte con un venv vuoto, l'entrypoint reinstalla da solo (serve rete).

Dopo un **cambio di dipendenze** in `pyproject.toml` (git pull inclusi):
`make install` risincronizza il venv del container.

## Rete

`network_mode: host` (come le altre devbox di questo monorepo): su questo
host il port-forwarding di Docker non funziona con la VPN attiva.

`lset` resta in ascolto su **127.0.0.1** (`APP_HOST`): e' una scelta
dell'app (`cli.py`: "the server carries the user's API key, so exposing it
beyond the machine must be an explicit decision"). L'host apre
`http://localhost:7787` direttamente.

> Sicurezza: devbox per uso **locale**. Per accesso remoto usa un tunnel
> SSH (`ssh -L 7787:127.0.0.1:7787 ...`) invece di `APP_HOST=0.0.0.0`.

## Healthcheck

`app` ha healthcheck su `http://127.0.0.1:APP_PORT/api/health`
(upstream, `lse_terminal/engine/server.py`). Lo stesso endpoint espone
`ui_version` (mtime del codice UI servito): la pagina lo poll-a e
**si auto-ricarica** quando cambia — le modifiche all'UI statica
(`lse_terminal/ui/static/`) compaiono senza riavvio, mentre le modifiche
Python richiedono `make restart`. `start_period: 30s` perche' l'engine
importa pandas/numpy/pyarrow all'avvio.

## ML runtime installs

Il tab MACHINE LEARNING installa gli extra pesanti con un click: in una
source install l'endpoint esegue `python -m pip install` dentro il venv del
container (volume anonimo). Due modi equivalenti per averli subito:
`make install-ml` (extra `ml` da `pyproject.toml`) o il pulsante in-app.
`ml-deep` (torch) resta a cura dell'utente: sono centinaia di MB.

## Frontend chart

Il bundle chart e' **gia' compilato e committato** in
`lse_terminal/ui/static/chart/` (policy upstream: "a clone runs without a
node toolchain"). Per svilupparlo: `make frontend-install` una volta, poi
`make frontend-build` (vite scrive direttamente in
`lse_terminal/ui/static/chart/`, bind-mountato) o `make frontend-typecheck`.

## File della devbox

```
platforms/lse-terminal/
├── Makefile                 comandi (tutto via Docker)
├── DEVBOX.md                quick-start
├── .dockerignore            build context = platform (no .git/workspace)
├── docker/
│   ├── Dockerfile           immagine dev (Python 3.11 + Node 20)
│   ├── docker-compose.yml   app (project tm_lse_terminal)
│   ├── entrypoint.sh        (re)install venv se manca -> lset --no-browser
│   ├── .env.example         configurazione opzionale (porte)
│   └── README.md            questo file
└── workspace/               dati utente (B)
    └── config/              -> ~/.config/lse-terminal
```

Il `desktop/` upstream (Electron/PyInstaller, installer Windows/Mac) non
entra nell'immagine: la devbox Linux usa `lset` nel browser dell'host.
