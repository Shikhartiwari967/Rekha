"""
SQLite storage (Python's built-in sqlite3, no server needed).

The app uses a file (REKHA_DB, default backend/data/rekha.db) so the ledger,
campaigns and runs survive restarts. Tests use ":memory:".
"""

from __future__ import annotations

import os
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY, role TEXT NOT NULL, password_hash TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS ledger (
  idx INTEGER PRIMARY KEY, round_id INTEGER NOT NULL, step TEXT NOT NULL,
  payload TEXT NOT NULL, prev_hash TEXT NOT NULL, ts REAL NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checkpoints (
  round_id INTEGER NOT NULL, head_hash TEXT NOT NULL, ts REAL NOT NULL,
  signature TEXT NOT NULL, public_key TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, rekha_on INTEGER NOT NULL,
  created_by TEXT NOT NULL, team TEXT NOT NULL, round_id INTEGER, status TEXT NOT NULL,
  total INTEGER NOT NULL, error TEXT, created_at REAL NOT NULL, finished_at REAL);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, round_id INTEGER NOT NULL,
  team TEXT NOT NULL, pack TEXT, attack TEXT NOT NULL, rekha_on INTEGER NOT NULL,
  blocked INTEGER NOT NULL, rule TEXT, model TEXT, model_answer TEXT, red_reply TEXT NOT NULL,
  latency_ms REAL NOT NULL, raw_latency_ms REAL, verdict_safe INTEGER, verdict_score REAL,
  verdict_reason TEXT, attack_succeeded INTEGER NOT NULL, ts REAL NOT NULL);
"""

DATA_TABLES = ("ledger", "checkpoints", "campaigns", "runs")


def default_path() -> str:
    return os.environ.get("REKHA_DB") or os.path.join(os.path.dirname(__file__), "..", "data", "rekha.db")


def connect(path: str = ":memory:") -> sqlite3.Connection:
    if path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    # One connection shared by the API threads; the referee's lock serialises access.
    conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def wipe(conn: sqlite3.Connection) -> None:
    """Delete all results (keeps the signing key in `meta`)."""
    for table in DATA_TABLES:
        conn.execute(f"DELETE FROM {table}")
