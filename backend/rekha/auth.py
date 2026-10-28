"""
Accounts, passwords, tokens and login rate limiting.

Every person has their own account (username + password) with one role:
  red   - runs attacks (always with Rekha on)
  blue  - reads its sealed verdicts, but only after a round closes
  admin - the referee operator: rounds, users, Rekha on/off

On first start (no users yet) three accounts are created: `red`, `blue` and
`admin`, with passwords from REKHA_RED_PASSWORD / REKHA_BLUE_PASSWORD /
REKHA_ADMIN_PASSWORD, or generated and printed if those are missing. The admin
then adds personal accounts in the console.

Passwords are stored as PBKDF2-SHA256 hashes (standard library). Tokens are
HMAC-SHA256 signed with REKHA_SECRET (or a per-process secret).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from collections import defaultdict, deque

ROLES = ("red", "blue", "admin")
TOKEN_TTL_S = 8 * 60 * 60
PBKDF2_ITERATIONS = 200_000
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,31}$")

_SECRET = os.environ.get("REKHA_SECRET", "").encode() or secrets.token_bytes(32)

# Passwords used for the first-start accounts (also read by the tests).
PASSWORDS: dict[str, str] = {}


# -- passwords -------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    except ValueError:
        return False
    # compare_digest takes the same time whether the guess is close or not.
    return hmac.compare_digest(got.hex(), digest)


# -- users -----------------------------------------------------------------
def bootstrap_users(conn) -> None:
    """Create red / blue / admin on the very first start."""
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
        return
    for role in ROLES:
        var = f"REKHA_{role.upper()}_PASSWORD"
        pw = os.environ.get(var)
        if not pw:
            pw = secrets.token_urlsafe(9)
            print(f"[rekha] {role:5} password: {pw}   (generated; set {var} to choose your own)")
        PASSWORDS[role] = pw
        create_user(conn, role, pw, role)


def create_user(conn, username: str, password: str, role: str) -> None:
    if not USERNAME_RE.match(username):
        raise ValueError("Username: 2-32 characters, lowercase letters, digits, . _ -")
    if role not in ROLES:
        raise ValueError(f"Role must be one of {', '.join(ROLES)}")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
        raise ValueError("That username is taken")
    conn.execute("INSERT INTO users (username, role, password_hash, created_at) VALUES (?,?,?,?)",
                 (username, role, hash_password(password), time.time()))


def authenticate(conn, username: str, password: str) -> dict | None:
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if row is None:
        hash_password(password)          # same work as a real check: no timing hint that the user exists
        return None
    if row["disabled"] or not verify_password(password, row["password_hash"]):
        return None
    return {"username": row["username"], "role": row["role"]}


def get_user(conn, username: str) -> dict | None:
    row = conn.execute("SELECT username, role, disabled FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def list_users(conn) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT username, role, disabled, created_at FROM users ORDER BY created_at")]


def update_user(conn, username: str, role: str | None = None, password: str | None = None,
                disabled: bool | None = None) -> None:
    if get_user(conn, username) is None:
        raise LookupError("No such user")
    if role is not None:
        if role not in ROLES:
            raise ValueError(f"Role must be one of {', '.join(ROLES)}")
        conn.execute("UPDATE users SET role = ? WHERE username = ?", (role, username))
    if password is not None:
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters")
        conn.execute("UPDATE users SET password_hash = ? WHERE username = ?", (hash_password(password), username))
    if disabled is not None:
        conn.execute("UPDATE users SET disabled = ? WHERE username = ?", (int(disabled), username))


def active_admins(conn) -> int:
    return conn.execute("SELECT COUNT(*) FROM users WHERE role = 'admin' AND disabled = 0").fetchone()[0]


# -- tokens ----------------------------------------------------------------
def _sign(body: str) -> str:
    return hmac.new(_SECRET, body.encode(), hashlib.sha256).hexdigest()


def make_token(username: str) -> str:
    payload = json.dumps({"sub": username, "exp": int(time.time()) + TOKEN_TTL_S}, separators=(",", ":"))
    body = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"{body}.{_sign(body)}"


def read_token(token: str) -> str | None:
    """Return the username inside a valid, unexpired token, else None."""
    body, _, sig = token.partition(".")
    if not body or not hmac.compare_digest(sig, _sign(body)):
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    except ValueError:
        return None
    if payload.get("exp", 0) < time.time() or not isinstance(payload.get("sub"), str):
        return None
    return payload["sub"]


# -- login rate limiting -----------------------------------------------------
class LoginLimiter:
    """At most `limit` failed logins per client IP in `window_s`; then HTTP 429."""

    def __init__(self, limit: int = 5, window_s: int = 300) -> None:
        self.limit, self.window_s = limit, window_s
        self._fails: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque:
        q = self._fails[key]
        while q and q[0] <= now - self.window_s:
            q.popleft()
        return q

    def retry_after(self, key: str) -> int:
        """Seconds until this client may try again (0 = allowed now)."""
        with self._lock:
            now = time.time()
            q = self._prune(key, now)
            return int(q[0] + self.window_s - now) + 1 if len(q) >= self.limit else 0

    def failed(self, key: str) -> None:
        with self._lock:
            self._fails[key].append(time.time())

    def succeeded(self, key: str) -> None:
        with self._lock:
            self._fails.pop(key, None)
