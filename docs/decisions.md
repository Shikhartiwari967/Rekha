# Technical decisions

Each entry: what we decided, why, and what else we considered.

## Earlier decisions (recorded from the existing code)

- **Mock model instead of vLLM + Qwen.** Runs anywhere without a GPU and is deterministic on
  stage. Alternative: a real small model; rejected for reliability and hardware.
- **Regex rules instead of real OPA/Rego.** Transparent and testable in Python. Alternative: an
  OPA sidecar; more realistic but adds a service to run.
- **PyNaCl Ed25519 for checkpoints.** Real, fast signatures with a small dependency.
- **One in-memory `Referee` per process.** Simple for a demo; state is lost on restart.

## 28 Oct 2026 — system check fixes

| Decision | Why | Alternatives considered |
|---|---|---|
| Pin `pytest>=8.0,<9.2` | pytest 9.2.0 fails with `INTERNALERROR ... NodeId ... _str_cache` on Python 3.10 before collecting any test; 9.1.1 works | Upgrade Python (bigger change); exact pin `==9.1.1` (blocks future fixes) |
| `REKHA_API` env var for the Vite proxy | Port 8000 is used by another project on this laptop; lets you move Rekha without editing code | Change the default port (surprises other users); a `.env` file (more setup) |
| `run.sh` detects a working `python3`, else `python`; activates `bin/` or `Scripts/` | Windows ships a fake `python3` that opens the Microsoft Store | A separate `run.ps1` (two scripts to maintain) |
| `attack_succeeded = not rekha_on` | Old code `(not rekha_on) and (not v.safe or True)` always ignored the verdict; the new line says the same thing honestly, with the reason in a comment | Count success only when blue flags unsafe (changes the demo's 100% OFF number) |
| Running mean over padded runs only (`overhead_samples`) | Blocked runs never reach padding, but were weighted into the average (309.7 ms reported vs 294.0 ms true) | Store every sample in a list (unbounded memory) |
| Word-boundary regex `\b(hello\|hi)\b` | `"hi" in text` matched "something" | Split into words (misses punctuation like "hi!") |
| `close_round` raises → API returns **409** | Closing twice signed duplicate checkpoints for the same round | Return 200 with an error field (clients can't tell it failed) |
| `open_round` is idempotent | Demo page opens a round on every visit, abandoning the previous round unsigned | Track "opened" in the frontend (state lost on reload) |
| vite 5 → 6.4.5, react-router-dom 6 → 7.18.5 | `npm audit`: 1 high + 3 moderate advisories; both are the smallest jumps with fixes | `npm audit fix --force` (jumps vite to 8, bigger change) |
| `w-full` on `<main>`, `grid-cols-1` on mobile grids | Flex-column children with `mx-auto` and auto grid tracks both grew to their widest un-wrappable line | `overflow-x: hidden` on `body` (hides the bug and clips content) |
| Mobile nav = horizontally scrollable pill row | Smallest change, no extra state, every link reachable | Hamburger menu (more code, state, focus handling) |
| UI redesign: product console instead of pitch-deck pages (user's choice) | Kickers + giant titles, slide-style card grids, handwritten font and a marketing hero made the app feel like a PPT | Dark SOC-style console; keeping the top nav and only cleaning up |
| Merge Objectives / Architecture / Threat Model / Roadmap into one About page with tabs (user's choice) | Keeps pitch content available without cluttering the workspace; tab in `?tab=` so links and refresh work; old URLs redirect | Keep 4 pages under "Learn"; remove them |
| Rekha switch moved to the top bar | It changes every page's meaning (Arena, Metrics), so it should be global | Keep it on the Arena only |
| Standard Tailwind weights (`font-medium/semibold/bold`) | `font-600`-style classes do not exist in Tailwind, so headings silently rendered at normal weight | Add custom `fontWeight` keys to the config |
| `aria-label` on the ledger's empty header cell | The `sr-only` span is `position: absolute` and escaped the scroll box, widening the page by 30px on phones | Make the scroll box `relative` |
| Team-role auth: red / blue / admin (user's choice) | Mirrors the sealed rooms: red attacks, blue reads verdicts after close, admin runs the referee | Single admin login; UI-only login (not real security) |
| HMAC-SHA256 tokens with Python's standard library | No new dependency; signature + expiry checked with `hmac.compare_digest` | JWT library (extra dependency for the same result); server-side sessions (more state) |
| Passwords from env vars, else generated and printed at start | Nothing secret hard-coded, still works out of the box | Fixed demo passwords in code (would leak with the repo) |
| Token in `sessionStorage` | Closing the tab logs out; not shared across tabs | `localStorage` (survives forever); cookies (need CSRF handling) |
| Red can never switch Rekha off or pick another team | Otherwise red could weaken its own sandbox or probe another team's cache | Trust the frontend to hide the switch (bypassable) |
| Black-and-white theme (user's choice) | Colour reserved for meaning: green safe, red leak/blocked, red/blue team dots | Orange accent; full dark mode |
| Animations with framer-motion (already installed), `MotionConfig reducedMotion="user"` | No new dependency; respects the OS "reduce motion" setting | CSS-only animations (no layout/spring animations) |
| SQLite via Python's built-in `sqlite3` (user's choice: persistence) | Zero setup, one file, survives restarts; tests use `:memory:` with the same code path | PostgreSQL (needs a server); JSON files (no queries, unsafe concurrent writes) |
| Metrics computed from the `runs` table | One source of truth; numbers survive restarts | Keep in-memory counters and also persist them (two places to drift) |
| Ollama for the real model (user's choice), stdlib `urllib`, mock fallback | Free, local, no API key, no new dependency; demo never breaks if Ollama is off | Claude API (key + cost); `httpx` (fine, but stdlib is enough) |
| Canary secret in the system prompt; blue flags it | Gives a concrete, checkable definition of "the model was compromised" for real models | Keyword lists only (miss real leaks) |
| Bucketed padding (next 500 ms step) + real sleep | A real model can exceed 500 ms; red learns only the bucket, and the reply truly waits | Fixed 500 ms (impossible for slow models); no sleep (padding only on paper) |
| Campaigns run in a background thread, one at a time; manual attacks get 409 meanwhile | Long runs don't block the request; each campaign is a clean signed round | Task queue (Celery/RQ: new services); run inside the request (timeouts) |
| Per-round reports + standalone verifier with `--key` | Anyone can check results offline; `--key` stops someone re-signing an edited report with their own key | Server-side verify only (requires trusting the server) |
| Landing page: live numbers only, no testimonials/logos/pricing (user's request) | Nothing on the page is invented | Marketing placeholders |
| Console moved to `/app`, landing at `/`; old URLs redirect | Public site and app separated like a real product | Landing on a different port/site (more setup) |
| Personal accounts in SQLite, PBKDF2-SHA256 (200k iterations), standard library | Real per-person audit (`created_by` is a username); no new dependency | bcrypt/argon2 packages (stronger, but new native deps); external IdP/SSO (too much setup for now) |
| User looked up on every request (token carries only the username) | Disabling an account or changing a role takes effect immediately | Role inside the token (stale until expiry) |
| Login rate limit: 5 failures / 5 min per IP, in memory | Stops password guessing with no new service | Redis-backed limiter (needed only with several backend processes) |
| `REKHA_DEMO` flag (default on locally, off in Docker) | Tamper and Reset are stage tools; production must not have them at all, so the API returns 404 | Admin-only (still lets one admin forge the ledger) |
| Caddy for HTTPS + static files + `/api` proxy | Automatic Let's Encrypt certificates, one small config file, security headers | nginx + certbot (more moving parts); FastAPI serving files (no TLS) |
| Internal Docker networks for backend and Ollama | The model and the referee cannot reach the internet even if compromised; only Caddy is exposed | One flat network (simpler, leakier) |
| Separate `ollama-pull` one-off service | The model download needs internet; the serving container must not have it | Pull inside the serving container (it would need internet forever) |
| gVisor as an optional compose override | Needs a Linux host with `runsc`; the base stack must still run on Docker Desktop | Always `runtime: runsc` (breaks on Windows/macOS) |
| Signing key from env / Docker secret file | Moves the key out of the database it signs with no new service | OpenBao now (another service to run and unseal) |
| Docker files removed (user's request, 28 Oct 2026) | The stack was never run end to end on this laptop; a tunnel from the laptop (`share.ps1`) is what is actually used to deploy. The Docker rows above are kept as history | Keep untested files in the repo |
| Serve the built site from FastAPI (`REKHA_STATIC`) | One port for site + API behind a tunnel, no CORS, no extra web server | Vite preview server; separate static host |
| `share.ps1` picks the tunnel: Cloudflare if port 7844 is open, else Pinggy (443) | Campus networks often block 7844; Pinggy and ngrok work over 443 | Cloudflare only (fails on those networks) |
| All `.md` docs in `docs/`, except `README.md` in the root (changed 28 Oct 2026 at the user's request) | The README is the project's front page, so it belongs where GitHub and new readers look first; detailed docs stay in `docs/` | Everything in `docs/` (the earlier rule) |
