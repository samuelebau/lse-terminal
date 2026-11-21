# LSE Terminal devbox

Devbox **web** per [LSE Terminal](https://github.com/londonstrategicedge/lse-terminal)
(fork: [samuelebau/lse-terminal](https://github.com/samuelebau/lse-terminal)) —
il terminale di trading open source: engine **Python/FastAPI** (`lse_terminal/`) +
UI statica servita dallo stesso processo (`lset`), che apre il terminale in
una scheda del browser. Nessun login: la chiave LSE e' opzionale e si attiva
dall'app (vedi "Chiave LSE").

> A differenza di `platforms/motivewave` (un desktop via VNC), questa e' una
> **devbox web** come `platforms/tradenza`: l'app gira dal sorgente
> bind-mountato e si apre su `http://localhost:7787`.
> Per i dettagli tecnici vedi `docker/README.md`.

## Avvio rapido

```bash
cd platforms/lse-terminal
make up          # avvia il terminale (build la prima volta, ~3-5 min)
make web         # apre http://localhost:7787 nel browser
```

Il terminale parte **senza chiave LSE**; senza chiave non c'e' il data feed
ne' il demo account (vedi "Chiave LSE" sotto per attivarla).

## Comandi principali

```bash
make up            # avvia in background
make up-fg         # idem, log in primo piano (Ctrl+C ferma)
make down          # ferma e rimuove il container (mantiene venv e workspace)
make ps            # stato del container (deve dire Up / healthy)
make logs          # segue i log dell'app
make shell         # bash nel container (utente lse, venv nel PATH)
make web           # apre il terminale nel browser
make help          # lista completa
```

Sviluppo:

```bash
make restart         # riavvia l'engine (le modifiche Python prendono effetto)
make install         # risincronizza le dipendenze (dopo un cambio in pyproject.toml)
make install-ml      # extra ML (scikit-learn, xgboost, lightgbm, catboost, ...)
make test            # pytest
make test-mjs        # test Node (tests/test_*.mjs, senza dipendenze npm)
make frontend-install && make frontend-build   # ricompila il bundle chart
make frontend-typecheck
```

Reset:

```bash
make purge            # ferma il container E cancella il volume del venv
make reset-workspace  # ATTENZIONE: cancella TUTTI i dati utente (key compresa)
```

## Porte

| Servizio | Var       | Default | Note                    |
|----------|-----------|---------|-------------------------|
| lset     | `APP_PORT`| 7787    | `http://localhost:7787` |

Override: `make up APP_PORT=7788`. Con `network_mode: host` la porta e'
quella dell'host.

## Chiave LSE

Il data feed e il demo account si sbloccano con una chiave gratuita da
https://londonstrategicedge.com/data. Si incolla **dall'app** (schermata
iniziale / impostazioni) e viene salvata dall'engine in
`workspace/config/config.json` (bind-mountata come
`~/.config/lse-terminal`): non finisce nel git (ignorata) e sopravvive a
`make down`/`make purge`. `make reset-workspace` la cancella.

Cosa funziona senza chiave: tutto cio' che gira in locale — backtest su
dati propri importati (MY DATA), l'IDE delle strategie in Python, i modelli
ML sui tuoi dataset, i dashboard custom.

## Configurazione (opzionale)

Tutto ha un default: `make up` funziona senza alcun `.env`.

```bash
cp docker/.env.example docker/.env
# edita docker/.env, poi:
make up
```

## Struttura

```
platforms/lse-terminal/    (fork lse-terminal + devbox)
├── Makefile               comandi devbox
├── DEVBOX.md              questo quick-start
├── docker/                devbox (Dockerfile/compose/entrypoint/README)
├── workspace/             dati utente (gruppo B)
│   ├── config/            -> ~/.config/lse-terminal: key, workspace,
│   │                        notebook, dashboard, chat, ML runtime installs
│   ├── download/  output/  import/    area scratch utente
├── lse_terminal/  frontend/  tests/   sorgente dell'app (upstream)
└── desktop/               builder Electron/PyInstaller (Windows/Mac): la
                           devbox Linux usa `lset` nel browser, non Electron
```

Il terminale e' "from source": `lset` esegue il codice Python bind-mountato
dall'host. Il bundle del chart (`lse_terminal/ui/static/chart/`) e' gia'
compilato nel repo; per modificarlo serve Node (`make frontend-build`).
