# Architecture

## Components

| Component | File | Responsibility |
|---|---|---|
| API | `backend/app.py` | FastAPI routes; one `Referee` instance per process; `require(...)` role checks on every route |
| Auth | `backend/rekha/auth.py` | Personal accounts (`users` table, PBKDF2 hashes), first-start `admin`/`red`/`blue`, HMAC-SHA256 tokens (username, 8 h), login rate limiter |
| Backups | `backend/backup.py` | SQLite online backup into `data/backups/`, keeps the newest N |
| Public link | `share.ps1` + `app.py` → `mount_frontend` | Builds the site, serves site + API on `127.0.0.1:8010`, opens a Cloudflare / Pinggy / ngrok HTTPS tunnel |
| Storage | `backend/rekha/db.py` | SQLite tables `meta` (signing key), `ledger`, `checkpoints`, `campaigns`, `runs` |
| Model room | `backend/rekha/rooms.py` → `ModelRoom` | Ollama `/api/chat` (system prompt with canary) or mock; probes `/api/tags` every 10 s |
| Campaign runner | `referee.py` → `start_campaign` | Background thread: close open round → open new → run every attack → close (signed) |
| Verifier | `backend/verify_report.py` | Standalone: recompute hashes, check checkpoint + Ed25519 signature (+ expected key) |
| Landing | `frontend/src/pages/Landing.jsx` | Public page at `/`; live numbers from `/api/public/stats` |
| Referee | `backend/rekha/referee.py` | The only door between rooms; runs the 5-step flow; owns ledger, watchman, metrics |
| Policy check | `backend/rekha/rooms.py` → `policy_check` | Named regex rules (OPA-style); blocks before the model |
| Model room | `rooms.py` → `ModelRoom` | Deterministic mock LLM; per-team salted cache key; fresh context when Rekha is ON |
| Blue guard | `rooms.py` → `blue_guard` | Judges the raw answer; verdict sealed until round close |
| Fair clock | `rooms.py` → `normalise`, `pad_timing` | Red gets `RESPONSE_PROCESSED` at a fixed 500 ms when ON |
| Ledger | `backend/rekha/ledger.py` | Append-only SHA-256 hash chain + Ed25519 checkpoint per round |
| Watchman | `referee.py` → `Watchman` | Logs each boundary crossing as a hash, never the contents |
| Frontend client | `frontend/src/api.js` | `fetch` wrapper; throws on non-2xx (message includes status) |
| Shared state | `frontend/src/store.jsx` | React context: online, rekhaOn, lastRun, metrics, ledger, actions |
| Layout | `frontend/src/components/Layout.jsx` | Sidebar nav (Workspace / Learn), top bar with round, backend status and the global Rekha switch; link row on phones |
| UI kit | `frontend/src/components/ui.jsx` | `Page` (title, description, actions), `Card`, `Stat`, `Chip`, `Button`, `Empty`, `plural` |
| Pages | `frontend/src/pages/*.jsx` | Overview (live dashboard), Demo = Arena, Ledger, Metrics read live data; About is explanatory, with tabs in `?tab=` |
| Dev proxy | `frontend/vite.config.js` | Forwards `/api` to `REKHA_API` (default `http://localhost:8000`) |

## Request flow: one attack

```
Browser (Arena page, /demo)
   │  POST /api/attack {attack, rekha_on}
   ▼
Vite dev proxy ──► FastAPI app.py ──► Referee.run_attack
                                          │
   1 attack_in      red → referee         │ ledger.add + watchman.observe
   2 policy_check   OPA-style rules ──────┤ blocked? → constant reply to red, stop
   3 model_reply    referee → model       │ salted cache key, fresh context (ON)
   4 blue_verdict   model → blue          │ verdict stored in _sealed[round] (hidden when ON)
   5 reply_to_red   referee → red         │ ON: RESPONSE_PROCESSED @ 500 ms
                                          │ OFF: raw answer + real latency + leaked verdict
   ▼
JSON {steps, red_sees, watchman, metrics}  ──► store.jsx ──► Arena animates steps 1–5
```

## Round lifecycle

```
open_round()  ── idempotent: if a round is already open, returns its id
     │
run_attack() × n   (opens a round automatically if none is open)
     │
close_round() ── 409 Conflict via the API if no round is open
     │           signs the ledger head with Ed25519 → checkpoint
     ▼           reveals blue's sealed verdicts for that round
```

## Auth

```
Login page ── POST /api/auth/login {role, password} ──► token (role + expiry, HMAC-signed)
   token kept in sessionStorage; api.js sends  Authorization: Bearer <token>
   any 401 → frontend logs out
```

| Endpoint | red | blue | admin |
|---|:-:|:-:|:-:|
| `GET /api/health`, `POST /api/auth/login`, `GET /api/public/stats`, `GET /api/public/verify_report.py` | public | public | public |
| `GET /api/campaigns`, `/campaigns/{id}`, `/runs`, `/rounds/{id}/report`, `/model` | ✓ (no verdicts, no raw answers) | ✓ (verdicts after close) | ✓ (everything) |
| `POST /api/campaigns` | ✓ (Rekha on only) | ✗ | ✓ |
| `GET /api/ledger`, `/ledger/verify`, `/metrics`, `/watchman`, `/auth/me` | ✓ | ✓ | ✓ |
| `GET /api/attacks`, `POST /api/round/open`, `POST /api/attack` | ✓ (Rekha always on, team forced to red) | ✗ | ✓ |
| `GET /api/verdicts` (closed rounds only) | ✗ | ✓ | ✓ |
| `POST /api/round/close`, `GET/POST /api/users`, `PATCH /api/users/{username}` | ✗ | ✗ | ✓ |
| `POST /api/reset`, `/api/ledger/tamper` | ✗ | ✗ | ✓ only when `REKHA_DEMO=1` (else 404) |

The frontend hides what a role cannot do, but the backend is the real gate.

## Ledger integrity

Each entry stores `prev_hash` and `hash = SHA-256(canonical JSON of index, round, step, payload,
prev_hash, ts)`. `verify()` walks the chain recomputing every hash, then checks every checkpoint
signature with the stored public key. Editing any payload changes its recomputed hash, so
verification reports the exact broken index.

## Ports

| Service | Default | Override |
|---|---|---|
| Backend (uvicorn) | 8000 | `--port`, or `REKHA_PORT` in `run.sh` |
| Frontend (Vite) | 5173 | Vite picks the next free port if 5173 is taken |
| Proxy target | `http://localhost:8000` | `REKHA_API` env var |
