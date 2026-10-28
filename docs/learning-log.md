# Learning log

## 28 Oct 2026 — System check and fixes

### 1. pytest INTERNALERROR (environment, not our code)

`requirements.txt` said `pytest>=8.0`, so pip installed the newest, 9.2.0. It crashed inside its
own code (`'NodeId' object has no attribute '_str_cache'`) before running any test.

**Lesson:** an open range (`>=`) means "whatever is newest today". A new release can break you
without you changing anything. Fix: `pytest>=8.0,<9.2` — allow updates, but not the broken one.

### 2. `run.sh` on Windows

```bash
PORT="${REKHA_PORT:-8000}"
```
`${VAR:-default}` = use `$VAR` if set and non-empty, else `default`.

```bash
export REKHA_API="http://localhost:$PORT"
```
`export` passes the variable to child programs (here: `npm run dev` → Vite), so the proxy and
the backend always agree on the port.

```bash
if python3 --version >/dev/null 2>&1; then PY=python3; else PY=python; fi
```
Run `python3 --version`, throw away normal output (`>/dev/null`) and errors (`2>&1` sends stream 2,
errors, to the same place as stream 1). `if` only looks at the exit code: 0 = success. Windows'
fake `python3` exits with an error, so we fall back to `python`.

```bash
[ -d .venv ] || "$PY" -m venv .venv
```
`[ -d X ]` tests "is X a directory". `A || B` runs B only if A failed → create the venv only once.

```bash
if [ -f .venv/bin/activate ]; then source .venv/bin/activate; else source .venv/Scripts/activate; fi
```
Linux/macOS venvs put scripts in `bin/`, Windows in `Scripts/`. `source` runs the file in the
*current* shell so its changes (PATH) stay.

### 3. `REKHA_API` in `vite.config.js`

```js
'/api': process.env.REKHA_API ?? 'http://localhost:8000',
```
`process.env` = environment variables in Node. `??` (nullish coalescing) picks the right side only
if the left is `null`/`undefined`. (`||` would also replace `''` and `0`.)

### 4. `or True` — always-true logic

```python
attack_succeeded = (not rekha_on) and (not v.safe or True)   # before
attack_succeeded = not rekha_on                              # after
```
`X or True` is `True` for any X, so `v.safe` never mattered. Same behaviour, now honest, with a
comment explaining *why* OFF always counts as success (red sees raw answer, timing and verdict).

### 5. Running mean

Old: `(avg * runs_on + x) / (runs_on + 1)` — `runs_on` also counted blocked runs, which never
produce a sample, so old values were over-weighted.

New:
```python
mt.overhead_samples += 1
mt.latency_overhead_ms += (overhead - mt.latency_overhead_ms) / mt.overhead_samples
```
Running mean: move the average toward the new value by `1/n` of the gap. Example: avg 316 (n=1),
new 272 → 316 + (272−316)/2 = 294. Needs only the average and a count, no list of samples.

### 6. Word boundaries in regex

```python
re.search(r"\b(hello|hi)\b", low)
```
- `r"..."` raw string: backslashes are kept as-is for the regex.
- `\b` word boundary: between a letter and a non-letter (or the start/end).
- `(hello|hi)` either word.
So `"hi there"` matches, `"something"` doesn't.

### 7. Raising errors and HTTP status codes

```python
# referee.py
if not self.round_open:
    raise RuntimeError("no open round")

# app.py
try:
    return referee.close_round()
except RuntimeError as e:
    raise HTTPException(status_code=409, detail=str(e))
```
The core logic (`Referee`) knows nothing about HTTP; it raises a normal Python error. The API
layer translates it into HTTP 409. Keeping these layers separate means the referee can be tested
without a web server.

### 8. Idempotent `open_round`

```python
if self.round_open:
    return self.round_id
```
The Demo page calls `openRound()` every visit. Before, each visit abandoned the open round without
a signed checkpoint. Now repeated calls return the same round.

### 9. Catching errors in React event handlers

```jsx
const onClose = async () => {
  setError(null)
  try {
    setClosed(await closeRound())
  } catch (e) {
    setError(e.message.includes('409') ? 'This round is already closed…' : 'Could not close…')
  }
}
```
`await` on a failed `fetch` throws. Without `try/catch` that becomes an *unhandled promise
rejection*: nothing on screen, an error in the console. `api.js` puts the status in the error
message (`POST /api/round/close -> 409`), so we can show a specific message.
`role="alert"` on the message makes screen readers announce it.

### 10. Why the page was wider than the phone

- `Shell` is `flex flex-col`. A flex child with `mx-auto` is **not stretched**; it sizes to its
  content. The Home marquee is one long `whitespace-nowrap` line → `<main>` became 1280px.
  Fix: `w-full` on `<main>` (and `max-w-7xl` still caps it on desktop).
- `grid lg:grid-cols-[...]` has **no columns below `lg`**; the browser makes an automatic column
  that grows to the longest unbreakable line (`truncate` hash, nowrap log). Fix: `grid-cols-1`,
  which Tailwind compiles to `grid-template-columns: repeat(1, minmax(0, 1fr))` — the `0` lets it
  shrink.
- Ledger card had `overflow-hidden` → the table was cut off. `overflow-x-auto` lets it scroll
  inside the card.

### 11. Mobile nav without a hamburger

`flex-wrap` on the header row + `order-last w-full` on the nav pushes the links to their own row
on phones; `overflow-x-auto` + `shrink-0` on each link makes the row swipeable. From `md:` up,
`md:flex-nowrap md:order-none md:w-auto md:flex-1` restores the single desktop row.

### 13. UI redesign: from slides to a console

- **Layout component:** `Layout.jsx` wraps every route, so the sidebar and top bar are written once.
- **Global state in the top bar:** the Rekha switch calls `setRekhaOn` from the shared store, so
  Arena and every other page see the same value.
- **`useSearchParams`:** About keeps the open tab in the URL (`?tab=threats`), so refresh, links
  and the back button work. `setParams({ tab: id })` updates it.
- **`<Navigate to=... replace />`:** old URLs redirect without leaving themselves in history.
- **Tailwind weights:** only names like `font-medium` / `font-semibold` exist; `font-600` does
  nothing — that is why the old headings looked thin.
- **`position: absolute` escapes overflow boxes** unless an ancestor is positioned. An `sr-only`
  span inside a scrollable table widened the phone page; `aria-label` avoids the extra element.
- **`role="switch"` + `aria-checked`, `role="tab"` + `aria-selected`:** tell screen readers what
  custom controls are.

### 14. From demo to real product

- **One code path for storage:** `Ledger(conn)` always writes to SQLite; tests pass an in-memory
  database (`":memory:"`), the app passes a file. No "if persistent" branches.
- **Write-through cache:** the ledger keeps its entries in a Python list for fast verify, and every
  `add` also `INSERT`s the row. On start-up the list is loaded back from the table.
- **Derive, don't duplicate:** metrics are a SQL `SUM/AVG` over `runs`, and the open round is
  worked out from the ledger (`max(round_id)` not yet in `checkpoints`).
- **Graceful fallback:** the model room tries Ollama; on a connection error it remembers the
  failure for 30 s and answers with the mock, so a demo never crashes.
- **Locks and sleeping:** attacks run under a lock so the ledger stays in order, but the padding
  `sleep` happens *after* releasing it, so other requests aren't blocked.
- **Background thread:** `threading.Thread(target=..., daemon=True)` runs a campaign while the API
  keeps answering; `finally:` guarantees the campaign is marked done/failed and its round closed.
- **Offline verification:** `verify_report.py` re-implements the 6-line hash function on purpose, so
  a reviewer can read it and does not have to import Rekha's code to trust the result.

### 15. Production hardening

- **Store a hash, not a password:** `hashlib.pbkdf2_hmac("sha256", pw, salt, 200_000)`. The random
  salt makes equal passwords hash differently; 200k iterations make guessing slow.
- **Same work for unknown users:** login hashes the password even when the username doesn't exist,
  so response time doesn't reveal which usernames are real.
- **Check the account on every request:** the token only says *who*; the role and "disabled" flag are
  read from the database each time, so an admin's change applies instantly.
- **Sliding-window rate limit:** a `deque` of failure times per IP; drop entries older than 5 minutes;
  5 or more left → HTTP 429 with `Retry-After`.
- **Feature flags:** `REKHA_DEMO=0` makes the demo endpoints return 404, so they don't exist in
  production instead of merely being hidden.
- **Defence in depth with Docker:** internal networks (no internet), `read_only`, `cap_drop: ALL`,
  `no-new-privileges`, a non-root user, and secrets passed at run time (`env_file`), never baked into
  images (`.dockerignore` excludes `.env`).

### 12. Dependency upgrades

`npm install vite@^6.4.5 @vitejs/plugin-react@^4.7.0 react-router-dom@^7.18.5` updates
`package.json` and `package-lock.json`. Checked first with `npm view <pkg>@<major> version`
which versions exist, and with `peerDependencies` that the React plugin supports vite 6.
React Router 7 makes the v7 "future flags" the default, so the console warnings disappeared.
