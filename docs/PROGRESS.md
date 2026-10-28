# Progress

Last updated: 28 Oct 2026

## Done

- FastAPI backend: referee, OPA-style policy check, mock model, blue guard, watchman, metrics.
- Ledger: SHA-256 hash chain, Ed25519 signed checkpoints per round, verify + tamper demo.
- React frontend: 8 pages wired to the backend through a shared store (`store.jsx`).
- **System check and fixes (28 Oct 2026):**
  - pytest pinned below 9.2 (9.2.0 crashes on Python 3.10).
  - `run.sh` works on Windows (Git Bash) and accepts `REKHA_PORT`.
  - Vite proxy target configurable with `REKHA_API`.
  - Backend logic bugs fixed: `or True` in attack success, latency-overhead average,
    `"hi"` substring match, closing a round twice, reopening an already-open round.
  - Frontend: vite 5 → 6.4.5, react-router-dom 6 → 7.18.5 (`npm audit`: 0 vulnerabilities).
  - Mobile: no horizontal page scroll at 390px on all 8 pages; nav visible on phones;
    ledger table scrolls inside its card.
  - Demo page shows a message instead of failing silently when run/close/reset fails.
  - Cache-leak 89% figure labelled as a study figure, not a measurement.
  - Docs moved into `docs/` and the full doc set created.

- **UI redesign (28 Oct 2026):** pitch-deck style replaced by a product console — sidebar
  layout, global Rekha switch and round in the top bar, live Overview dashboard, Arena, Ledger,
  Metrics, and one About page (tabs) replacing Objectives / Architecture / Threat Model / Roadmap.
  Handwritten and display fonts removed; invalid `font-600`-style classes replaced. Old URLs
  redirect to the matching About tab.

- **Auth + visual polish (28 Oct 2026):** team-role login (red / blue / admin) enforced by the
  backend with HMAC-signed tokens; new `/api/verdicts` (blue sees verdicts only after close).
  Black-and-white theme (dark sidebar, colour only for status and team dots), animations:
  staggered card entrance, count-up numbers, sliding nav/tab indicators, spring switch, step
  highlight, ledger tamper shake, animated login. Respects reduced-motion settings.

- **Real product (28 Oct 2026):** SQLite persistence (ledger, checkpoints, signing key, campaigns,
  runs; metrics computed from stored runs); real model via Ollama with mock fallback and a canary
  secret that blue's guard detects; real reply padding (500 ms buckets, the server actually waits);
  campaigns (packs + custom prompts, background run, one signed round each); signed per-round
  reports + offline `verify_report.py`; public landing page with live stats; console moved to `/app`.

- **Real model verified (28 Oct 2026):** Ollama 0.40.12 + qwen2.5:0.5b installed on the dev laptop;
  real campaigns run (results in README and `docs/testing.md`). README moved back to the project root
  with screenshots in `docs/images/`.

- **Fixed passwords (28 Oct 2026):** `backend/.env` (git-ignored) + `backend/.env.example`; loaded with
  `uvicorn --env-file .env` and by `run.sh`.

- **Production hardening (28 Oct 2026):** personal accounts (users table, PBKDF2 hashes, admin Users
  page, role change / disable take effect immediately, last admin protected); login rate limiting
  (5 fails / 5 min / IP → 429); `REKHA_DEMO=0` removes Tamper and Reset; CORS limited by
  `REKHA_CORS_ORIGINS`; signing key from `REKHA_SIGNING_KEY(_FILE)`; `backup.py`.
- **Docker removed (28 Oct 2026, user's request):** the compose/Dockerfile/Caddy files were deleted
  before they were ever run end to end; the public link is served by `share.ps1` instead.

## In progress

- Nothing.

## Blocked / open questions

- **Policy with Rekha OFF:** the referee still blocks jailbreaks when Rekha is OFF. Decide whether
  OFF should bypass the policy check too (would make the ON/OFF comparison starker).
- **Port clash on this laptop:** Pharmagraph-AI uses ports 8000 and 5173. Run one project at a
  time, or use `REKHA_PORT` / `REKHA_API` (see README).

## Not started

- Each room (red, blue, referee, model) in its own container; today red/blue/referee logic share the
  backend process, only the model is a separate container.
- Container + gVisor isolation per room on a Linux server.
- Real Falco/eBPF watchman.
- Signing key in a dedicated secret store (OpenBao) instead of an env var / key file.
- Login rate limiting is in memory: it resets on restart and isn't shared across several backend processes.
- Automated frontend tests; CI.
