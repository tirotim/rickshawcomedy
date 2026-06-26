#!/usr/bin/env python3
"""Deploy docs/ to IONOS webspace via SFTP.

Usage:
  SFTP_HOST=... SFTP_USER=... SFTP_PASSWORD=... python3 scripts/deploy-sftp.py

Optional:
  SFTP_PORT=22
  SFTP_REMOTE_DIR=/            # account root on IONOS; use /htdocs if needed
  DEPLOY_SOURCE=docs
"""

from __future__ import annotations

import os
import stat
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("DEPLOY_SOURCE", ROOT / "docs")).resolve()
REMOTE_DIR = os.environ.get("SFTP_REMOTE_DIR", "/").rstrip("/") or "/"


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"Missing environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def connect():
    host = require_env("SFTP_HOST")
    user = require_env("SFTP_USER")
    password = require_env("SFTP_PASSWORD")
    port = int(os.environ.get("SFTP_PORT", "22"))
    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    return paramiko.SFTPClient.from_transport(transport), transport


def ensure_remote_dir(sftp: paramiko.SFTPClient, path: str) -> None:
    parts = [part for part in path.split("/") if part]
    current = ""
    for part in parts:
        current += "/" + part
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def upload_tree(sftp: paramiko.SFTPClient, local_root: Path, remote_root: str) -> int:
    count = 0
    for local_path in sorted(local_root.rglob("*")):
        rel = local_path.relative_to(local_root).as_posix()
        remote_path = remote_root if not rel else f"{remote_root}/{rel}"
        if local_path.is_dir():
            ensure_remote_dir(sftp, remote_path)
            continue
        ensure_remote_dir(sftp, os.path.dirname(remote_path))
        sftp.put(str(local_path), remote_path)
        count += 1
        if count % 25 == 0:
            print(f"Uploaded {count} files...")
    return count


def main() -> None:
    if not SOURCE.is_dir():
        print(f"Deploy source not found: {SOURCE}", file=sys.stderr)
        sys.exit(1)

    print(f"Deploying {SOURCE} -> {REMOTE_DIR}")
    sftp, transport = connect()
    try:
        ensure_remote_dir(sftp, REMOTE_DIR)
        total = upload_tree(sftp, SOURCE, REMOTE_DIR)
        print(f"Done. Uploaded {total} files to {REMOTE_DIR}")
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    main()
