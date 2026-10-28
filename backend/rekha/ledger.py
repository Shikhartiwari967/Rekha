"""
Rekha glass-box ledger (objective 03).

This is REAL, not simulated:
  - every step is SHA-256 hashed into a hash chain (a Merkle-style append-only log)
  - each entry's hash depends on the previous hash, so editing any past entry
    breaks the chain and `verify()` catches it
  - each round is closed with a real Ed25519 signed checkpoint (PyNaCl)
  - entries and checkpoints are stored in SQLite, so they survive restarts

The signing key comes from REKHA_SIGNING_KEY (hex seed) or REKHA_SIGNING_KEY_FILE
(a key file), so it lives away from the data it signs. Without either
(local development) it is created once and kept in the database's `meta` table.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from dataclasses import dataclass, asdict
from typing import Any

import nacl.signing
import nacl.encoding

from . import db


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _canonical(payload: Any) -> str:
    # Stable serialization so hashes are reproducible on re-verify.
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


@dataclass
class LedgerEntry:
    index: int
    round_id: int
    step: str            # e.g. "attack_in", "policy_check", "model_reply"
    payload: dict        # the data being committed (already redacted where needed)
    prev_hash: str
    ts: float
    hash: str = ""

    def compute_hash(self) -> str:
        body = _canonical(
            {
                "index": self.index,
                "round_id": self.round_id,
                "step": self.step,
                "payload": self.payload,
                "prev_hash": self.prev_hash,
                "ts": self.ts,
            }
        )
        return _sha256(body)


@dataclass
class Checkpoint:
    round_id: int
    head_hash: str       # hash of the last entry in the round
    ts: float
    signature: str       # Ed25519 signature (hex) over head_hash
    public_key: str      # hex, so anyone can verify


class Ledger:
    """Append-only, tamper-evident log with signed per-round checkpoints."""

    GENESIS = "GENESIS"

    def __init__(self, conn=None) -> None:
        self.conn = conn or db.connect()
        self.lock = threading.RLock()
        self._signing_key = self._load_signing_key()
        self.public_key_hex = self._signing_key.verify_key.encode(
            encoder=nacl.encoding.HexEncoder
        ).decode()
        self.entries = [
            LedgerEntry(r["idx"], r["round_id"], r["step"], json.loads(r["payload"]),
                        r["prev_hash"], r["ts"], r["hash"])
            for r in self.conn.execute("SELECT * FROM ledger ORDER BY idx")
        ]
        self.checkpoints = [
            Checkpoint(r["round_id"], r["head_hash"], r["ts"], r["signature"], r["public_key"])
            for r in self.conn.execute("SELECT * FROM checkpoints ORDER BY rowid")
        ]

    def _load_signing_key(self) -> nacl.signing.SigningKey:
        # Production: keep the key away from the data it signs (env var or a mounted secret file).
        seed = os.environ.get("REKHA_SIGNING_KEY", "").strip()
        key_file = os.environ.get("REKHA_SIGNING_KEY_FILE")
        if not seed and key_file:
            with open(key_file, encoding="utf-8") as f:
                seed = f.read().strip()
        if seed:
            return nacl.signing.SigningKey(bytes.fromhex(seed))
        # Development fallback: create once and keep it in the database.
        row = self.conn.execute("SELECT value FROM meta WHERE key = 'signing_seed'").fetchone()
        if row:
            return nacl.signing.SigningKey(bytes.fromhex(row["value"]))
        key = nacl.signing.SigningKey.generate()
        self.conn.execute("INSERT INTO meta (key, value) VALUES ('signing_seed', ?)", (bytes(key).hex(),))
        return key

    # ---- append ---------------------------------------------------------
    def add(self, round_id: int, step: str, payload: dict) -> LedgerEntry:
        with self.lock:
            prev_hash = self.entries[-1].hash if self.entries else self.GENESIS
            entry = LedgerEntry(
                index=len(self.entries),
                round_id=round_id,
                step=step,
                payload=payload,
                prev_hash=prev_hash,
                ts=time.time(),
            )
            entry.hash = entry.compute_hash()
            self.conn.execute(
                "INSERT INTO ledger (idx, round_id, step, payload, prev_hash, ts, hash) VALUES (?,?,?,?,?,?,?)",
                (entry.index, round_id, step, _canonical(payload), prev_hash, entry.ts, entry.hash))
            self.entries.append(entry)
            return entry

    # ---- close a round with a signed checkpoint -------------------------
    def checkpoint(self, round_id: int) -> Checkpoint:
        with self.lock:
            head = self.entries[-1].hash if self.entries else self.GENESIS
            sig = self._signing_key.sign(head.encode("utf-8")).signature.hex()
            cp = Checkpoint(
                round_id=round_id,
                head_hash=head,
                ts=time.time(),
                signature=sig,
                public_key=self.public_key_hex,
            )
            self.conn.execute(
                "INSERT INTO checkpoints (round_id, head_hash, ts, signature, public_key) VALUES (?,?,?,?,?)",
                (cp.round_id, cp.head_hash, cp.ts, cp.signature, cp.public_key))
            self.checkpoints.append(cp)
            return cp

    # ---- verification (anyone can run this) -----------------------------
    def verify(self) -> dict:
        """Recompute the whole chain + check every signature. Returns a report."""
        with self.lock:
            prev = self.GENESIS
            for e in self.entries:
                if e.prev_hash != prev:
                    return {
                        "intact": False,
                        "reason": f"prev_hash mismatch at index {e.index}",
                        "broken_index": e.index,
                    }
                if e.compute_hash() != e.hash:
                    return {
                        "intact": False,
                        "reason": f"payload tampered at index {e.index}",
                        "broken_index": e.index,
                    }
                prev = e.hash

            # Verify signatures too.
            for cp in self.checkpoints:
                vk = nacl.signing.VerifyKey(cp.public_key, encoder=nacl.encoding.HexEncoder)
                try:
                    vk.verify(cp.head_hash.encode("utf-8"), bytes.fromhex(cp.signature))
                except Exception:
                    return {
                        "intact": False,
                        "reason": f"bad signature on round {cp.round_id}",
                        "broken_round": cp.round_id,
                    }

            return {"intact": True, "entries": len(self.entries),
                    "checkpoints": len(self.checkpoints)}

    # ---- tamper (demo only) --------------------------------------------
    def tamper(self, index: int, new_payload: dict) -> bool:
        """Edit a past entry WITHOUT fixing the chain, to prove verify() catches it."""
        with self.lock:
            if 0 <= index < len(self.entries):
                self.entries[index].payload = new_payload
                # deliberately DO NOT recompute hashes downstream
                self.conn.execute("UPDATE ledger SET payload = ? WHERE idx = ?", (_canonical(new_payload), index))
                return True
            return False

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "entries": [asdict(e) for e in self.entries],
                "checkpoints": [asdict(c) for c in self.checkpoints],
                "public_key": self.public_key_hex,
            }

    def round_proof(self, round_id: int) -> dict | None:
        """Everything needed to verify one closed round offline."""
        with self.lock:
            cps = [c for c in self.checkpoints if c.round_id == round_id]
            entries = [e for e in self.entries if e.round_id == round_id]
            if not cps or not entries:
                return None
            return {
                "prev_hash": entries[0].prev_hash,
                "entries": [asdict(e) for e in entries],
                "checkpoint": asdict(cps[-1]),
            }
