"""
The Referee - the only door between rooms.

Every message passes through here. The referee:
  1. accepts an attack from the red room
  2. runs the policy check (objective 02)
  3. forwards to the model with the team's salted cache key (objective 05)
  4. hands the raw answer to blue's sealed guard (objective 02)
  5. returns ONLY a padded, normalised reply to red (objectives 02, 05)
Every step is hashed into the ledger (objective 03) and every boundary
crossing is logged by the watchman as a hash, never contents (objective 02).
Every attack is also stored as a run in SQLite; campaigns run whole attack
lists in their own signed round.
"""

from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass, field

from . import db
from .ledger import Ledger
from .rooms import (
    policy_check, ModelRoom, blue_guard, normalise, pad_timing,
)

VERDICT_FIELDS = ("verdict_safe", "verdict_score", "verdict_reason")


@dataclass
class Watchman:
    """eBPF/Falco stand-in. Logs boundary crossings as HASHES ONLY."""
    alerts: list[dict] = field(default_factory=list)

    def observe(self, frm: str, to: str, payload: str) -> None:
        h = hashlib.sha256(f"{frm}->{to}:{payload}:{time.time()}".encode()).hexdigest()
        self.alerts.append({
            "ts": time.time(),
            "event": "boundary_cross",
            "edge": f"{frm}->{to}",
            "hash": h[:12],          # never the contents
        })
        del self.alerts[:-200]

    def recent(self, n: int = 20) -> list[dict]:
        return self.alerts[-n:]


class Metrics:
    """Computed from the stored runs, so the numbers survive restarts."""

    def __init__(self, conn) -> None:
        self.conn = conn

    def as_dict(self) -> dict:
        r = self.conn.execute("""SELECT
            COALESCE(SUM(rekha_on), 0)                        AS runs_on,
            COALESCE(SUM(1 - rekha_on), 0)                    AS runs_off,
            COALESCE(SUM(rekha_on * attack_succeeded), 0)     AS success_on,
            COALESCE(SUM((1 - rekha_on) * attack_succeeded), 0) AS success_off,
            COALESCE(SUM(blocked), 0)                         AS blocked,
            COALESCE(SUM(verdict_safe = 0), 0)                AS compromised,
            AVG(CASE WHEN rekha_on = 1 AND blocked = 0 THEN latency_ms - raw_latency_ms END) AS overhead
            FROM runs""").fetchone()

        def rate(s, n):
            return round(100 * s / n, 1) if n else 0.0
        return {
            "attack_success_rate_on": rate(r["success_on"], r["runs_on"]),
            "attack_success_rate_off": rate(r["success_off"], r["runs_off"]),
            "avg_latency_overhead_ms": round(r["overhead"] or 0.0, 1),
            "crossings_blocked": r["blocked"],
            "model_compromised": r["compromised"],
            # Prompt-cache timing leak: shared cache vs salted (objective 05)
            "cache_leak_shared_pct": 89,   # Early Bird study figure (OFF)
            "cache_leak_salted_pct": 0,    # ON
            "runs_on": r["runs_on"],
            "runs_off": r["runs_off"],
        }


def run_view(row: dict, role: str, round_closed: bool) -> dict:
    """What a role may see of one run. Verdicts stay sealed until the round closes."""
    d = dict(row)
    if role == "admin":
        return d
    d.pop("model_answer", None)
    if role == "red" or not round_closed:
        for k in VERDICT_FIELDS:
            d.pop(k, None)
    return d


class Referee:
    def __init__(self, conn=None, real_padding: bool = False) -> None:
        self.conn = conn or db.connect()
        self.ledger = Ledger(self.conn)
        self.model = ModelRoom()
        self.watchman = Watchman()
        self.metrics = Metrics(self.conn)
        # Sleep so the reply really arrives at the padded time (the API turns this on).
        self.real_padding = real_padding
        self.lock = threading.RLock()     # one attack / round change at a time
        self.active_campaign: int | None = None
        # Resume round state from the stored ledger.
        self.round_id = max((e.round_id for e in self.ledger.entries), default=0)
        self.round_open = self.round_id > 0 and self.round_id not in self.closed_rounds()

    def closed_rounds(self) -> set[int]:
        return {c.round_id for c in self.ledger.checkpoints}

    # -- round lifecycle --------------------------------------------------
    def open_round(self) -> int:
        with self.lock:
            # Idempotent: reopening would abandon the current round without a checkpoint.
            if self.round_open:
                return self.round_id
            self.round_id += 1
            self.round_open = True
            self.ledger.add(self.round_id, "round_open", {"round": self.round_id})
            return self.round_id

    def close_round(self) -> dict:
        with self.lock:
            # Without this, a second close would sign a duplicate checkpoint.
            if not self.round_open:
                raise RuntimeError("no open round")
            self.round_open = False
            cp = self.ledger.checkpoint(self.round_id)
            revealed = [
                {"attack": r["attack"], "safe": bool(r["verdict_safe"]),
                 "score": r["verdict_score"], "reason": r["verdict_reason"]}
                for r in self.conn.execute(
                    "SELECT * FROM runs WHERE round_id = ? AND verdict_safe IS NOT NULL ORDER BY id",
                    (self.round_id,))
            ]
            return {
                "round": self.round_id,
                "checkpoint": {
                    "round_id": cp.round_id,
                    "head_hash": cp.head_hash,
                    "signature": cp.signature,
                    "public_key": cp.public_key,
                },
                "revealed_verdicts": revealed,   # blue's results, now visible
            }

    def revealed_verdicts(self) -> list[dict]:
        """Blue's verdicts for closed rounds only; the open round stays sealed."""
        closed = self.closed_rounds()
        rounds: dict[int, list[dict]] = {}
        for r in self.conn.execute("SELECT * FROM runs WHERE verdict_safe IS NOT NULL ORDER BY id"):
            if r["round_id"] in closed:
                rounds.setdefault(r["round_id"], []).append(
                    {"attack": r["attack"], "safe": bool(r["verdict_safe"]),
                     "score": r["verdict_score"], "reason": r["verdict_reason"]})
        return [{"round": k, "verdicts": v} for k, v in sorted(rounds.items())]

    # -- the core flow ----------------------------------------------------
    def run_attack(self, attack: str, team: str = "red", rekha_on: bool = True,
                   campaign_id: int | None = None, pack: str | None = None) -> dict:
        t0 = time.perf_counter()
        with self.lock:
            result, target_ms = self._attack(attack, team, rekha_on, campaign_id, pack, t0)
        if self.real_padding:
            # Hold the reply until the padded time, outside the lock so reads stay fast.
            time.sleep(max(0.0, target_ms - (time.perf_counter() - t0) * 1000) / 1000)
        return result

    def _attack(self, attack, team, rekha_on, campaign_id, pack, t0):
        if not self.round_open:
            self.open_round()

        steps = []

        # Step 1: attack enters the referee (red -> referee)
        self.watchman.observe("red", "referee", attack)
        e1 = self.ledger.add(self.round_id, "attack_in",
                             {"team": team, "attack": attack, "rekha_on": rekha_on})
        steps.append({"n": 1, "name": "attack_in", "hash": e1.hash,
                      "detail": "Attack enters the referee."})

        # Step 2: policy check (OPA)
        pol = policy_check(attack)
        e2 = self.ledger.add(self.round_id, "policy_check",
                             {"blocked": pol.blocked, "rule": pol.rule})
        steps.append({"n": 2, "name": "policy_check", "hash": e2.hash,
                      "blocked": pol.blocked, "rule": pol.rule,
                      "detail": f"Policy {'BLOCK' if pol.blocked else 'PASS'}"
                                + (f" ({pol.rule})" if pol.rule else "")})

        if pol.blocked:
            # Blocked attacks never reach the model. Red still gets a constant reply.
            elapsed = round((time.perf_counter() - t0) * 1000, 1)
            latency = pad_timing(elapsed, rekha_on)
            reply = {"reply": normalise(""), "latency_ms": latency}
            steps.append({"n": 5, "name": "reply_to_red", "hash": e2.hash,
                          "detail": "Blocked at the door; padded reply to red."})
            run_id = self._store_run(campaign_id, team, pack, attack, rekha_on, True, pol.rule,
                                     None, None, reply["reply"], latency, elapsed, None, False)
            return self._result(steps, reply, True, rekha_on, run_id), latency

        # Step 3: forward to model with salted cache key (referee -> model)
        self.watchman.observe("referee", "model", attack)
        m = self.model.infer(team, attack, rekha_on)
        e3 = self.ledger.add(self.round_id, "model_reply",
                             {"salted_key": m["salted_key"], "cache_hit": m["cache_hit"],
                              "context_len": m["context_len"], "model": m["model"]})
        steps.append({"n": 3, "name": "model_reply", "hash": e3.hash,
                      "salted_key": m["salted_key"], "cache_hit": m["cache_hit"],
                      "detail": f"Model ({m['model']}) answered in {m['raw_latency_ms']:.0f} ms "
                                f"(cache key {m['salted_key']}, context_len {m['context_len']})."})

        # Step 4: blue's sealed guard runs (model -> blue)
        self.watchman.observe("model", "blue", m["answer"])
        v = blue_guard(m["answer"], attack)
        verdict_payload = {"safe": v.safe, "score": v.score, "reason": v.reason}
        e4 = self.ledger.add(self.round_id, "blue_verdict", verdict_payload)
        steps.append({"n": 4, "name": "blue_verdict", "hash": e4.hash,
                      "sealed": rekha_on,
                      # If Rekha OFF, verdict leaks immediately to the step view.
                      "verdict": (None if rekha_on else verdict_payload),
                      "detail": "Blue defence ran; verdict "
                                + ("SEALED until round close." if rekha_on
                                   else "LEAKED to red (Rekha OFF).")})

        # Step 5: padded, normalised reply back to red (referee -> red)
        self.watchman.observe("referee", "red", "padded_reply")
        latency = pad_timing(m["raw_latency_ms"], rekha_on)
        red_reply = normalise(m["answer"]) if rekha_on else m["answer"]
        e5 = self.ledger.add(self.round_id, "reply_to_red",
                             {"normalised": rekha_on, "latency_ms": latency})
        steps.append({"n": 5, "name": "reply_to_red", "hash": e5.hash,
                      "detail": "Red gets " + ("a padded, normalised answer."
                                if rekha_on else "the RAW answer + real timing (leak).")})

        # Did the attack "succeed"? i.e. did red learn something it shouldn't?
        # ON: never (normalised + sealed). OFF: always, because red sees the raw
        # answer, its real timing and blue's verdict, whatever that verdict is.
        attack_succeeded = not rekha_on

        reply = {
            "reply": red_reply,
            "latency_ms": latency,
            "raw_latency_ms": m["raw_latency_ms"],
            "leaked_verdict": (None if rekha_on else verdict_payload),
        }
        run_id = self._store_run(campaign_id, team, pack, attack, rekha_on, False, None,
                                 m["model"], m["answer"], red_reply, latency, m["raw_latency_ms"],
                                 v, attack_succeeded)
        return self._result(steps, reply, False, rekha_on, run_id, attack_succeeded, m["model"]), latency

    # -- campaigns --------------------------------------------------------
    def start_campaign(self, name: str, attacks: list[tuple[str | None, str]], rekha_on: bool,
                       team: str, created_by: str, background: bool = True) -> int:
        with self.lock:
            if self.active_campaign is not None:
                raise RuntimeError("a campaign is already running")
            cur = self.conn.execute(
                "INSERT INTO campaigns (name, rekha_on, created_by, team, status, total, created_at) "
                "VALUES (?,?,?,?,?,?,?)",
                (name, int(rekha_on), created_by, team, "queued", len(attacks), time.time()))
            cid = cur.lastrowid
            self.active_campaign = cid
        if background:
            threading.Thread(target=self._run_campaign, args=(cid, attacks, rekha_on, team),
                             daemon=True).start()
        else:
            self._run_campaign(cid, attacks, rekha_on, team)
        return cid

    def _run_campaign(self, cid, attacks, rekha_on, team) -> None:
        status, error = "done", None
        try:
            with self.lock:
                if self.round_open:          # a campaign is its own signed round
                    self.close_round()
                rid = self.open_round()
                self.conn.execute("UPDATE campaigns SET status = 'running', round_id = ? WHERE id = ?",
                                  (rid, cid))
            for pack, text in attacks:
                self.run_attack(text, team=team, rekha_on=rekha_on, campaign_id=cid, pack=pack)
        except Exception as e:               # keep the record; never leave it "running"
            status, error = "failed", str(e)
        finally:
            with self.lock:
                if self.round_open:
                    self.close_round()
                self.conn.execute("UPDATE campaigns SET status = ?, error = ?, finished_at = ? WHERE id = ?",
                                  (status, error, time.time(), cid))
                self.active_campaign = None

    def list_campaigns(self) -> list[dict]:
        rows = self.conn.execute("""SELECT c.*,
              (SELECT COUNT(*) FROM runs r WHERE r.campaign_id = c.id)              AS completed,
              (SELECT COALESCE(SUM(blocked), 0) FROM runs r WHERE r.campaign_id = c.id) AS blocked
            FROM campaigns c ORDER BY c.id DESC""").fetchall()
        return [dict(r) for r in rows]

    def get_campaign(self, cid: int, role: str) -> dict | None:
        row = self.conn.execute("SELECT * FROM campaigns WHERE id = ?", (cid,)).fetchone()
        if row is None:
            return None
        runs = self.list_runs(role, campaign_id=cid)
        visible = role != "red" and row["round_id"] in self.closed_rounds()
        return {
            **dict(row),
            "runs": runs,
            "summary": {
                "completed": len(runs),
                "blocked": sum(r["blocked"] for r in runs),
                "reached_model": sum(not r["blocked"] for r in runs),
                "leaked_to_red": sum(r["attack_succeeded"] for r in runs),
                # Blue's findings stay sealed until the campaign's round is closed.
                "model_compromised": sum(r.get("verdict_safe") == 0 for r in runs) if visible else None,
            },
        }

    # -- runs & reports ---------------------------------------------------
    def list_runs(self, role: str, limit: int | None = None, campaign_id: int | None = None,
                  round_id: int | None = None) -> list[dict]:
        sql, args = "SELECT * FROM runs WHERE 1 = 1", []
        if campaign_id is not None:
            sql += " AND campaign_id = ?"; args.append(campaign_id)
        if round_id is not None:
            sql += " AND round_id = ?"; args.append(round_id)
        sql += " ORDER BY id DESC" if limit else " ORDER BY id"
        if limit:
            sql += " LIMIT ?"; args.append(limit)
        closed = self.closed_rounds()
        return [run_view(r, role, r["round_id"] in closed) for r in self.conn.execute(sql, args)]

    def round_report(self, round_id: int, role: str) -> dict | None:
        proof = self.ledger.round_proof(round_id)
        if proof is None:
            return None
        return {
            "format": "rekha-audit/1",
            "generated_at": time.time(),
            "round_id": round_id,
            **proof,
            "runs": self.list_runs(role, round_id=round_id),
            "how_to_verify": "python verify_report.py report.json --key <published public key>",
        }

    # -- helpers ----------------------------------------------------------
    def _store_run(self, campaign_id, team, pack, attack, rekha_on, blocked, rule, model,
                   model_answer, red_reply, latency, raw_latency, verdict, attack_succeeded) -> int:
        cur = self.conn.execute(
            "INSERT INTO runs (campaign_id, round_id, team, pack, attack, rekha_on, blocked, rule, model, "
            "model_answer, red_reply, latency_ms, raw_latency_ms, verdict_safe, verdict_score, "
            "verdict_reason, attack_succeeded, ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (campaign_id, self.round_id, team, pack, attack, int(rekha_on), int(blocked), rule, model,
             model_answer, red_reply, latency, raw_latency,
             None if verdict is None else int(verdict.safe),
             None if verdict is None else verdict.score,
             None if verdict is None else verdict.reason,
             int(attack_succeeded), time.time()))
        return cur.lastrowid

    def _result(self, steps, reply, blocked, rekha_on, run_id, attack_succeeded=False, model=None) -> dict:
        return {
            "run_id": run_id,
            "round": self.round_id,
            "rekha_on": rekha_on,
            "blocked": blocked,
            "attack_succeeded": attack_succeeded,
            "model": model,
            "steps": steps,
            "red_sees": reply,
            "watchman": self.watchman.recent(6),
            "metrics": self.metrics.as_dict(),
        }
