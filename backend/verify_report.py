"""
Verify a Rekha audit report offline, without trusting the Rekha server.

    python verify_report.py report.json --key <published public key hex>

Checks that:
  1. every ledger entry's SHA-256 hash is correct (no entry was edited),
  2. each entry points at the previous one (nothing removed or reordered),
  3. the last hash is the one in the signed checkpoint,
  4. the Ed25519 signature on that checkpoint is valid,
  5. (with --key) the signature was made by the key you expect.
Needs only PyNaCl: pip install pynacl
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys

import nacl.encoding
import nacl.signing


def entry_hash(e: dict) -> str:
    body = {k: e[k] for k in ("index", "round_id", "step", "payload", "prev_hash", "ts")}
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def verify(report: dict, expected_key: str | None = None) -> tuple[bool, str]:
    prev = report["prev_hash"]
    for e in report["entries"]:
        if e["prev_hash"] != prev:
            return False, f"chain broken before entry {e['index']}"
        if entry_hash(e) != e["hash"]:
            return False, f"entry {e['index']} was edited after it was written"
        prev = e["hash"]

    cp = report["checkpoint"]
    if prev != cp["head_hash"]:
        return False, "the signed checkpoint does not match the last entry"
    if expected_key and cp["public_key"].lower() != expected_key.lower():
        return False, "signed by a different key than the one you expected"
    try:
        key = nacl.signing.VerifyKey(cp["public_key"], encoder=nacl.encoding.HexEncoder)
        key.verify(cp["head_hash"].encode("utf-8"), bytes.fromhex(cp["signature"]))
    except Exception:
        return False, "the checkpoint signature is not valid"
    return True, f"round {report['round_id']}: {len(report['entries'])} entries, signature valid"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("report", help="report JSON downloaded from Rekha")
    parser.add_argument("--key", help="the public key Rekha publishes (hex)")
    args = parser.parse_args()
    with open(args.report, encoding="utf-8") as f:
        ok, message = verify(json.load(f), args.key)
    print(("PASS  " if ok else "FAIL  ") + message)
    if ok and not args.key:
        print("note: pass --key to also check WHO signed it")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
