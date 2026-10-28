# Glossary

Simple definitions of the terms used in this project.

| Term | Meaning |
|---|---|
| **Red team** | The attackers: they send prompts trying to break or trick the model. |
| **Blue team** | The defenders: their guard code judges every model answer. |
| **Referee** | The only path between rooms. Every message goes through it and gets checked and logged. |
| **Tenant** | One team using the shared platform. "No tenant can cross" = no team sees another's data. |
| **Sealed verdict** | Blue's judgement, hidden from red until the round closes. |
| **Round** | One testing session. Opened, attacked, then closed with a signed checkpoint. |
| **Idempotent** | Calling it twice has the same effect as calling it once (`open_round` now is). |
| **Hash (SHA-256)** | A fingerprint of data. Change one character and the fingerprint changes completely. |
| **Hash chain** | Each log entry includes the previous entry's hash, so editing an old entry breaks every link after it. |
| **Ed25519** | A digital-signature algorithm. A private key signs; anyone with the public key can check the signature. |
| **Checkpoint** | The ledger's latest hash, signed with Ed25519 at round close. |
| **Policy check / OPA** | Rules that decide whether a message may pass. OPA (Open Policy Agent) is a real tool for this; we imitate it with regex rules. |
| **Regex** | A pattern language for matching text. `\b` means "word boundary". |
| **Salted cache key** | Adding a per-team prefix before hashing, so two teams never share a cache entry. |
| **Timing side channel** | Learning secrets from *how long* something takes. Padding replies to a fixed time closes it. |
| **Normalise** | Replace the real reply with a constant token (`RESPONSE_PROCESSED`). |
| **Watchman** | Stand-in for Falco/eBPF: records every boundary crossing as a hash only. |
| **gVisor / seccomp / eBPF / Falco** | Real Linux sandboxing and monitoring tools the production design uses; simulated here. |
| **FastAPI** | Python web framework used for the backend API. |
| **uvicorn** | The server program that runs a FastAPI app. |
| **Pydantic model** | A Python class describing the expected request body; FastAPI validates against it. |
| **HTTP 409 Conflict** | "Your request clashes with the server's current state" — e.g. closing a closed round. |
| **HTTP 422** | "The request body is invalid" — sent automatically by FastAPI. |
| **venv** | A per-project folder of Python packages, so projects don't clash. |
| **pytest / INTERNALERROR** | Python test runner. INTERNALERROR means pytest itself crashed, not a test. |
| **TestClient** | Lets tests call the FastAPI app in memory without starting a server. |
| **Vite** | Frontend dev server and build tool. |
| **Proxy (dev)** | Vite forwards `/api/...` requests to the backend so the browser sees one origin. |
| **Environment variable** | A named value given to a program at start (`REKHA_API`, `REKHA_PORT`). |
| **Port** | A numbered "door" a server listens on (8000, 5173). Only one program per address+port. |
| **IPv4 / IPv6 (`127.0.0.1` / `::1`)** | Two address systems; `localhost` can mean either. |
| **CORS** | Browser rule about which websites may call an API. `*` = any site (demo only). |
| **React context** | A way to share state (like `rekhaOn`) across many components without passing props down. |
| **Hot reload (HMR)** | Vite swaps changed code into the running page without a full restart. |
| **Flexbox / Grid** | CSS layout systems. `grid-cols-1` = one column that may shrink (`minmax(0, 1fr)`). |
| **`overflow-x-auto`** | Let content scroll sideways inside a box instead of being cut off. |
| **npm audit** | Checks installed packages against a database of known security problems. |
| **Authentication / authorization** | Authentication = proving who you are (login). Authorization = what that role may do. |
| **Token (Bearer)** | A signed string the server gives you at login; you send it as `Authorization: Bearer <token>` on every request. |
| **HMAC** | A signature made with a secret key. Change one character of the token and the signature no longer matches. |
| **HTTP 401 / 403** | 401 = not logged in (or bad token). 403 = logged in, but your role is not allowed. |
| **sessionStorage** | Browser storage that lasts until the tab is closed. |
| **Reduced motion** | An OS setting for people who get dizzy from animation; the app turns its animations off when it is set. |
| **SQLite** | A database stored in a single file; Python includes it (`sqlite3`), no server needed. |
| **Ollama** | A program that runs open-source language models on your own computer behind a small HTTP API. |
| **Canary** | A planted secret (`RK-CANARY-7F3A`). If it ever appears in an answer, we know the model leaked. |
| **Campaign** | A batch of attacks run together in one round, with stored results and a signed report. |
| **Audit report** | JSON with a round's ledger entries, its signed checkpoint and the public key, so others can verify it. |
| **Bucketed padding** | Rounding reply time up to the next 500 ms step, so red learns only the bucket. |
| **Background thread** | Code running alongside the web server, so a long campaign doesn't block requests. |
| **PBKDF2** | A slow, salted way to store passwords: the database keeps a hash, never the password itself. |
| **Rate limiting (HTTP 429)** | Refusing more attempts for a while after too many failures, to stop password guessing. |
| **Docker / docker compose** | Packages each part of the app into a container; compose starts them all together with one command. |
| **Caddy** | A web server that gets HTTPS certificates automatically and forwards `/api` to the backend. |
| **Internal network** | A Docker network with no route to the internet; containers on it can only talk to each other. |
| **gVisor (runsc)** | A sandbox that gives a container its own kernel layer, so a kernel bug inside can't reach the host. |
| **Demo mode** | `REKHA_DEMO=1`: enables the stage-only Tamper and Reset buttons. Off in production. |
| **Running mean** | Updating an average with one new value: `avg += (x - avg) / n`. |
