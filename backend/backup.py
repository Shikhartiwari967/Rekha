"""
Back up the Rekha database safely while the server is running.

    python backup.py                      # one backup into data/backups/, keep the newest 14
    python backup.py --dir /backups --keep 30

Uses SQLite's online backup API, so the copy is consistent even mid-write.
"""

from __future__ import annotations

import argparse
import glob
import os
import sqlite3
import time

from rekha import db


def backup(src_path: str, out_dir: str, keep: int) -> str:
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, time.strftime("rekha-%Y%m%d-%H%M%S.db"))
    src = sqlite3.connect(src_path)
    with sqlite3.connect(dest) as out:
        src.backup(out)
    src.close()
    for old in sorted(glob.glob(os.path.join(out_dir, "rekha-*.db")))[:-keep]:
        os.remove(old)
    return dest


def main() -> None:
    p = argparse.ArgumentParser(description="Back up the Rekha SQLite database.")
    p.add_argument("--dir", default=os.path.join(os.path.dirname(db.default_path()), "backups"))
    p.add_argument("--keep", type=int, default=14, help="how many backups to keep")
    args = p.parse_args()
    print("backup written:", backup(db.default_path(), args.dir, max(1, args.keep)))


if __name__ == "__main__":
    main()
