"""
Rekha backend API (FastAPI).

Real endpoints over the real referee + ledger. Run:
    uvicorn app:app --port 8000 --env-file .env

Every endpoint except /api/health, /api/config, /api/auth/login and
/api/public/* needs a Bearer token from /api/auth/login. Which roles may call
what is set with `require(...)` below.

Config (environment variables, usually in backend/.env):
  REKHA_DB              SQLite file (default backend/data/rekha.db)
  REKHA_DEMO            "1" (default) enables the stage-only Tamper and Reset; "0" in production
  REKHA_CORS_ORIGINS    comma-separated origins allowed to call the API from a browser
  REKHA_REAL_PADDING    "0" to skip the padding sleep (tests)
  REKHA_MODEL           auto | ollama | mock      (see rekha/rooms.py)
  REKHA_SIGNING_KEY(_FILE), REKHA_SECRET, REKHA_*_PASSWORD   (see rekha/ledger.py, rekha/auth.py)
"""

from __future__ import annotations

import os

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from rekha import auth, db
from rekha.referee import Referee
from rekha.attacks import all_attacks, ATTACK_PACKS

app = FastAPI(title="Rekha", version="0.3.0",
              description="A line no tenant can cross - secure adversarial AI-safety testing")

DEMO = os.environ.get("REKHA_DEMO", "1") != "0"
CORS_ORIGINS = [o.strip() for o in os.environ.get(
    "REKHA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


conn = db.connect(db.default_path())
auth.bootstrap_users(conn)
REAL_PADDING = os.environ.get("REKHA_REAL_PADDING", "1") != "0"
referee = Referee(conn, real_padding=REAL_PADDING)
limiter = auth.LoginLimiter()

bearer = HTTPBearer(auto_error=False)


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    username = auth.read_token(cred.credentials) if cred else None
    user = auth.get_user(conn, username) if username else None
    # Looked up on every request: a disabled account or a changed role takes effect at once.
    if user is None or user["disabled"]:
        raise HTTPException(status_code=401, detail="Login required")
    return user


def require(*roles: str):
    def check(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"The {user['role']} role cannot do this")
        return user
    return check


ANY = Depends(require(*auth.ROLES))
ADMIN = Depends(require("admin"))


def no_campaign_running() -> None:
    if referee.active_campaign is not None:
        raise HTTPException(status_code=409, detail="A campaign is running; wait for it to finish")


def demo_only() -> None:
    if not DEMO:
        raise HTTPException(status_code=404, detail="Demo features are turned off on this server")


class LoginRequest(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=256)


class NewUser(BaseModel):
    username: str
    password: str
    role: str


class UserUpdate(BaseModel):
    role: str | None = None
    password: str | None = None
    disabled: bool | None = None


class AttackRequest(BaseModel):
    attack: str = Field(min_length=1, max_length=2000)
    team: str = "red"
    rekha_on: bool = True


class CampaignRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    packs: list[str] = []                                   # names from /api/attacks
    attacks: list[str] = Field(default=[], max_length=100)  # custom prompts, one per item
    rekha_on: bool = True


class TamperRequest(BaseModel):
    index: int
    new_text: str = "TAMPERED"


# -- public ----------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "rekha", "version": app.version}


@app.get("/api/config")
def config():
    return {"demo": DEMO}


@app.get("/api/public/stats")
def public_stats():
    """Live, aggregate numbers for the landing page. No attack text, no verdicts."""
    m = referee.metrics.as_dict()
    cps = referee.ledger.checkpoints
    return {
        "chain": referee.ledger.verify(),
        "public_key": referee.ledger.public_key_hex,
        "last_checkpoint": ({"round_id": cps[-1].round_id, "head_hash": cps[-1].head_hash,
                             "signature": cps[-1].signature} if cps else None),
        "runs": m["runs_on"] + m["runs_off"],
        "blocked": m["crossings_blocked"],
        "campaigns": len(referee.list_campaigns()),
        "model": referee.model.status()["using"],
    }


@app.get("/api/public/verify_report.py")
def verify_script():
    return FileResponse(os.path.join(os.path.dirname(__file__), "verify_report.py"),
                        media_type="text/x-python", filename="verify_report.py")


# -- auth & users ----------------------------------------------------------
@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request):
    key = request.client.host if request.client else "unknown"
    wait = limiter.retry_after(key)
    if wait:
        raise HTTPException(status_code=429, detail=f"Too many failed logins. Try again in {wait} s",
                            headers={"Retry-After": str(wait)})
    user = auth.authenticate(conn, req.username.strip().lower(), req.password)
    if user is None:
        limiter.failed(key)
        raise HTTPException(status_code=401, detail="Wrong username or password")
    limiter.succeeded(key)
    return {"token": auth.make_token(user["username"]), **user}


@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return {"username": user["username"], "role": user["role"]}


@app.get("/api/users")
def users(_: dict = ADMIN):
    return {"users": auth.list_users(conn)}


@app.post("/api/users", status_code=201)
def create_user(req: NewUser, _: dict = ADMIN):
    try:
        auth.create_user(conn, req.username.strip().lower(), req.password, req.role)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"created": req.username.strip().lower()}


@app.patch("/api/users/{username}")
def update_user(username: str, req: UserUpdate, _: dict = ADMIN):
    target = auth.get_user(conn, username)
    if target is None:
        raise HTTPException(status_code=404, detail="No such user")
    removes_admin = target["role"] == "admin" and not target["disabled"] and (
        (req.role is not None and req.role != "admin") or req.disabled)
    if removes_admin and auth.active_admins(conn) <= 1:
        raise HTTPException(status_code=409, detail="This is the last admin; add another admin first")
    try:
        auth.update_user(conn, username, req.role, req.password, req.disabled)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"updated": username}


# -- attacking -------------------------------------------------------------
@app.get("/api/attacks")
def attacks(_: dict = Depends(require("red", "admin"))):
    return {"packs": ATTACK_PACKS, "flat": all_attacks()}


@app.get("/api/model")
def model_status(_: dict = ANY):
    return referee.model.status()


@app.post("/api/round/open")
def open_round(_: dict = Depends(require("red", "admin"))):
    no_campaign_running()
    rid = referee.open_round()
    return {"round": rid, "open": True}


@app.post("/api/attack")
def run_attack(req: AttackRequest, user: dict = Depends(require("red", "admin"))):
    if not req.rekha_on and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the admin can turn Rekha off")
    no_campaign_running()
    team = req.team if user["role"] == "admin" else "red"   # red cannot pose as another team
    try:
        return referee.run_attack(req.attack, team=team, rekha_on=req.rekha_on)
    except RuntimeError as e:                               # REKHA_MODEL=ollama and Ollama is down
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/api/round/close")
def close_round(_: dict = ADMIN):
    no_campaign_running()
    try:
        return referee.close_round()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


# -- campaigns & runs --------------------------------------------------------
@app.post("/api/campaigns", status_code=201)
def create_campaign(req: CampaignRequest, user: dict = Depends(require("red", "admin"))):
    if not req.rekha_on and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the admin can turn Rekha off")
    unknown = [p for p in req.packs if p not in ATTACK_PACKS]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown pack: {', '.join(unknown)}")
    items = [(p, text) for p in req.packs for text in ATTACK_PACKS[p]]
    items += [("Custom", a.strip()) for a in req.attacks if a.strip()]
    if not items:
        raise HTTPException(status_code=422, detail="Pick at least one pack or add an attack")
    try:
        # Campaigns always attack as the red team; created_by records the person.
        cid = referee.start_campaign(req.name, items, req.rekha_on, "red", created_by=user["username"])
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"id": cid, "total": len(items)}


@app.get("/api/campaigns")
def campaigns(_: dict = ANY):
    return {"campaigns": referee.list_campaigns(), "active": referee.active_campaign}


@app.get("/api/campaigns/{cid}")
def campaign(cid: int, user: dict = ANY):
    c = referee.get_campaign(cid, user["role"])
    if c is None:
        raise HTTPException(status_code=404, detail="No such campaign")
    return c


@app.get("/api/runs")
def runs(limit: int = 50, user: dict = ANY):
    return {"runs": referee.list_runs(user["role"], limit=min(max(limit, 1), 500))}


@app.get("/api/rounds/{round_id}/report")
def round_report(round_id: int, user: dict = ANY):
    report = referee.round_report(round_id, user["role"])
    if report is None:
        raise HTTPException(status_code=404, detail="Round not found or not closed yet")
    return report


@app.get("/api/verdicts")
def verdicts(_: dict = Depends(require("blue", "admin"))):
    return {"rounds": referee.revealed_verdicts()}


# -- ledger, metrics, watchman ----------------------------------------------
@app.get("/api/ledger")
def ledger(_: dict = ANY):
    return referee.ledger.snapshot()


@app.get("/api/ledger/verify")
def verify(_: dict = ANY):
    return referee.ledger.verify()


@app.post("/api/ledger/tamper")
def tamper(req: TamperRequest, _: dict = ADMIN):
    demo_only()
    ok = referee.ledger.tamper(req.index, {"tampered": True, "note": req.new_text})
    return {"tampered": ok, "index": req.index,
            "verify": referee.ledger.verify()}


@app.get("/api/metrics")
def metrics(_: dict = ANY):
    return referee.metrics.as_dict()


@app.get("/api/watchman")
def watchman(_: dict = ANY):
    return {"alerts": referee.watchman.recent(20)}


@app.post("/api/reset")
def reset(_: dict = ADMIN):
    global referee
    demo_only()
    no_campaign_running()
    db.wipe(conn)                  # deletes all results; users and the signing key are kept
    referee = Referee(conn, real_padding=REAL_PADDING)
    return {"reset": True}


# -- the built website (one port for site + API, e.g. behind a tunnel) --------
def mount_frontend(application: FastAPI, static_dir: str) -> None:
    """Serve frontend/dist: real files as-is, every other non-API path gets index.html."""
    root = os.path.realpath(static_dir)
    application.mount("/assets", StaticFiles(directory=os.path.join(root, "assets")), name="assets")

    @application.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        f = os.path.realpath(os.path.join(root, path))
        if path and f.startswith(root + os.sep) and os.path.isfile(f):   # no ../ escapes
            return FileResponse(f)
        return FileResponse(os.path.join(root, "index.html"))


if os.environ.get("REKHA_STATIC"):          # set by share.ps1; off in development and tests
    mount_frontend(app, os.environ["REKHA_STATIC"])
