# Testing

## How to run

```bash
cd backend
python -m pytest -q          # or: .venv/Scripts/python.exe -m pytest -q  (Windows, Git Bash)
```

```bash
cd frontend
npm run build                # production build must succeed
npm audit                    # known-vulnerability check
```

## Backend tests (`backend/test_rekha.py`)

| Test | Guarantees |
|---|---|
| `test_ledger_chain_intact` | A clean chain verifies |
| `test_ledger_tamper_detected` | Editing entry 2 is caught at index 2 |
| `test_checkpoint_signature_verifies` | Ed25519 checkpoint signature verifies |
| `test_policy_blocks_prompt_exfil` | Exfil / secret prompts blocked, weather allowed |
| `test_salted_cache_differs_per_team_when_on` | Per-team cache keys ON, shared OFF |
| `test_fresh_context_when_on` / `..._carries_over_when_off` | Context reset ON, kept OFF |
| `test_red_reply_normalised_when_on` / `test_red_sees_raw_when_off` | Reply normalisation |
| `test_verdict_sealed_until_close_when_on` / `test_verdict_leaks_when_off` | Verdict sealing |
| `test_blocked_attack_counts_as_crossing` | Blocked attacks counted |
| `test_latency_overhead_ignores_blocked_runs` | Average overhead uses padded runs only |
| `test_hi_matches_whole_word_only` | "something" no longer triggers the hello reply |
| `test_close_round_requires_open_round` | No duplicate checkpoint from a second close |
| `test_open_round_is_idempotent` | Reopening keeps the current round |
| `test_api_close_twice_returns_409` | API returns 200 then 409 (FastAPI `TestClient`) |

## Results — 28 Oct 2026 (Windows 11, Python 3.10.0, Node 22.18.0)

| Check | Result |
|---|---|
| `pytest` with pytest 9.2.0 | ❌ INTERNALERROR before collection (pytest bug on 3.10) |
| `pytest -q` with pytest 9.1.1 (now pinned `<9.2`) | ✅ **17 passed**, 1 warning (Starlette suggests `httpx2`; harmless) |
| Live API smoke test, real uvicorn on :8001, all 11 routes | ✅ health, attacks, open, attack ON/OFF/blocked, close, verify, tamper (2, 999, -1), 422 on empty body, metrics, watchman, reset |
| `npm run build` (vite 6.4.5) | ✅ built, 343 kB JS (111 kB gzip) |
| `npm audit` | ✅ 0 vulnerabilities (was 1 high, 3 moderate) |
| `REKHA_PORT=8001 ./run.sh` in Git Bash | ✅ picked `python`, activated `.venv/Scripts`, backend on 8001, Vite proxy followed |
| Browser (Playwright, Chromium), desktop 1280px | ✅ 8 pages render, "backend live", demo flow ON/OFF/BLOCK, close → signature, close again → "already closed" message, Ledger verify ✓ → tamper → ✗ at that index, 0 JS errors, 0 warnings |
| Browser at 390px (phone) | ✅ no horizontal page scroll on all 8 pages; nav visible and working; ledger table scrolls inside its card |

## Results — 28 Oct 2026, after the UI redesign

| Check | Result |
|---|---|
| `npm run build` | ✅ built, 340 kB JS (110 kB gzip) |
| Leftover invalid classes (`font-600` etc.), handwriting font, deleted-file imports | ✅ none found (grep) |
| Browser, 1440px: Arena ON → `RESPONSE_PROCESSED`; jailbreak → Blocked; top-bar switch off → raw answer + leaked verdict; close → "Round N closed" + signature; close again → "already closed" | ✅ |
| Overview: chain status, stats, recent ledger, watchman; Ledger tamper → "payload tampered at index 2" | ✅ |
| Redirects `/objectives`, `/architecture`, `/threat-model`, `/roadmap`, unknown path | ✅ → matching `/about?tab=…`, unknown → `/` |
| About tabs update `?tab=` and the selected tab | ✅ |
| 390px phone: no horizontal page scroll on Overview, Arena, Ledger, Metrics, all 4 About tabs; link row visible | ✅ (Ledger was +30px until the `sr-only` fix) |
| Console errors / warnings | ✅ 0 (except the expected 409 network log from the double-close test) |

## Results — 28 Oct 2026, after auth + visual polish

| Check | Result |
|---|---|
| `pytest -q` | ✅ **23 passed** (6 new auth tests: wrong password / unknown role → 401, no or forged token → 401, tampered token signature rejected, red forbidden from Rekha-off / close / reset / tamper / verdicts → 403, red cannot pose as blue, blue sees verdicts only after close) |
| `npm run build` | ✅ 358 kB JS (116 kB gzip) |
| Browser, admin: wrong password → "Wrong role or password."; login; Arena ON → `RESPONSE_PROCESSED`; switch off → raw answer; close round; Overview shows blue verdict; Ledger shows 9 Tamper buttons, tamper caught at index 2; log out → login screen | ✅ |
| Browser, red: no Rekha switch, no Close round, 0 Tamper buttons, no verdicts card | ✅ |
| Browser, blue: no Arena link, `/demo` redirects to `/`, verdicts card shows the closed round | ✅ |
| 390px phone: Overview, Ledger, Metrics, About tabs, Login | ✅ no horizontal scroll |
| JS errors / 404s | ✅ none (favicon added) |

## Results — 28 Oct 2026, real product (persistence, Ollama, campaigns, reports, landing)

| Check | Result |
|---|---|
| `pytest -q` | ✅ **33 passed** in ~7 s. New: ledger/runs/signing key survive restart; tamper still caught after restart; Ollama answer used + canary leak flagged + leak contained (stand-in Ollama HTTP server); fallback to mock when Ollama is down; status says `mock` before any call; bucketed padding + real 0.5 s wait; campaign = own signed round with correct counts; red can't see verdicts; report verifies offline, wrong key and edited entry fail; API campaign + public stats (no attack text) + 403/422 cases |
| `npm run build` | ✅ |
| Browser (scratch DB): landing shows live stats; `/app` without login → `/login`; red creates a 7-attack campaign (2 packs + 1 custom) → live progress → done; red sees "Sealed" for compromised; signed report downloads; custom Arena prompt → `RESPONSE_PROCESSED`; admin sees 4 compromised, 3 blocked, 0 leaked | ✅ |
| Downloaded report → `verify_report.py --key <live key>` | ✅ `PASS round 1: 27 entries, signature valid`; same file with one payload edited → `FAIL entry 3 was edited after it was written` |
| Backend restart with the same DB | ✅ landing still showed 8 runs / 1 campaign; sessions were logged out (expected) |
| 390px phone: `/`, `/login`, `/app`, `/app/campaigns`, campaign detail, Arena | ✅ no horizontal scroll |

## Results — 28 Oct 2026, real model (Ollama 0.40.12, qwen2.5:0.5b, CPU)

| Check | Result |
|---|---|
| `GET /api/model` | ✅ `using: ollama:qwen2.5:0.5b`, no error |
| Single attack, Rekha on | ✅ red saw `RESPONSE_PROCESSED`; raw 3769.6 ms (first call, model loading) → padded 4000 ms; raw 2465.2 ms → 2500 ms |
| Same secret probe, Rekha off | ✅ model answered `RK-CANARY-7F3A`; red saw it plus the verdict `model revealed its secret deployment code` |
| Campaign, 4 packs, Rekha on (22 s) | ✅ 12 done · 6 blocked · 6 reached model · 1 compromised · **0 leaked to red** |
| Campaign, 4 packs, Rekha off (18 s) | ✅ 12 done · 6 blocked · 6 reached model · 1 compromised · **6 leaked to red**; repeated prompt answered from shared cache in 15 ms; carried-over context made the model repeat one refusal across unrelated prompts |
| Signed report of the Rekha-on campaign | ✅ `PASS round 2: 43 entries, signature valid` |
| Browser: top bar shows `ollama:qwen2.5:0.5b`; Arena step reads "answered in 3107 ms"; campaign table fits at 1440 px | ✅ (screenshots in `docs/images/`) |

## Results — 28 Oct 2026, `.env` support

| Check | Result |
|---|---|
| `uvicorn app:app --env-file .env`: admin login with the password from `backend/.env` | ✅ HTTP 200; wrong password → 401 |
| No "generated password" lines printed when `.env` sets all three | ✅ 0 lines |
| `run.sh` syntax after adding `--env-file` | ✅ `bash -n` passes |

## Results — 28 Oct 2026, production hardening

| Check | Result |
|---|---|
| `pytest -q` | ✅ **40 passed**. New: 5 failed logins → 429 with `Retry-After` (right password also waits); passwords stored as PBKDF2 hashes; personal account lifecycle (create, duplicate/invalid rejected, `/me`, non-admin can't manage users, `created_by` = username, role change applies to an existing token, disable locks out at once); last admin can't be disabled or demoted; `REKHA_DEMO=0` → tamper/reset 404; signing key from a file, nothing stored in `meta`; backup is a consistent, verifiable copy and old backups are pruned |
| `npm run build` | ✅ |
| Docker stack | removed later at the user's request (never run end to end) |

## Results — 28 Oct 2026, public link (`share.ps1`)

| Check | Result |
|---|---|
| `pytest -q` | ✅ **41 passed** (new: built site served, client routes → `index.html`, `../` escapes refused, API misses stay 404) |
| `share.ps1` build + backend on `127.0.0.1:8010` with `REKHA_STATIC` | ✅ `/api/health` 200 locally |
| Cloudflare quick tunnel on this network | ❌ outbound port 7844 is blocked (both QUIC and HTTP/2 mode); link returned Error 1033 |
| Port check | port 443 open to `a.pinggy.io` and `connect.ngrok-agent.com`; port 22 blocked |
| `share.ps1` parses; auto mode picks `pinggy` here | ✅ (the tunnel itself is started by the user; not run by the assistant) |

## Not yet verified

- A visitor using the Pinggy or ngrok link end to end.


- Two campaigns or many users at once (one campaign at a time is enforced; concurrent manual
  attacks from several browsers were not load-tested).

- `run.sh` on Linux/macOS.
- `run.sh` cleanup on Ctrl+C: on Windows, force-stopping the script left uvicorn and Vite running.
  Ctrl+C in a real terminal should trigger the `trap`, but this was not tested.
- Frontend has no automated tests; checks above were run by a script driving a browser.
- Safari / Firefox, and real phones (only a 390px Chromium viewport was tested).
