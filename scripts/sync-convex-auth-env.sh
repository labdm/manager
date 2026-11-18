#!/usr/bin/env bash
# Copy the Clerk issuer and MCP role secret onto the Convex deployment
# selected by CONVEX_DEPLOY_KEY. Values are not printed.
set -euo pipefail

if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

python3 - << 'PY'
import base64
import os
import re
import subprocess
import sys

root = os.getcwd()
deploy_key = os.environ.get("CONVEX_DEPLOY_KEY", "")

def scrub(text: str) -> str:
    for secret in (
        deploy_key,
        os.environ.get("MCP_ROLE_SECRET", ""),
        os.environ.get("CLERK_SECRET_KEY", ""),
        os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", ""),
        os.environ.get("CLERK_PUBLISHABLE_KEY", ""),
        os.environ.get("VITE_CLERK_PUBLISHABLE_KEY", ""),
    ):
        if secret:
            text = text.replace(secret, "[redacted]")
    return text

def convex_env_set(name: str, value: str) -> None:
    result = subprocess.run(
        ["pnpm", "--filter", "@manager/backend", "exec", "convex", "env", "set", name, value],
        cwd=root,
        capture_output=True,
        text=True,
    )
    sys.stdout.write(scrub(result.stdout + result.stderr))
    if result.returncode != 0:
        sys.exit(result.returncode)

pk = (
    os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
    or os.environ.get("CLERK_PUBLISHABLE_KEY")
    or os.environ.get("VITE_CLERK_PUBLISHABLE_KEY")
    or ""
).strip()
if not pk:
    sys.exit("Clerk publishable key is not set")

normalized = re.sub(r"^pk_(test|live)_", "", pk).replace("-", "+").replace("_", "/")
normalized += "=" * ((4 - len(normalized) % 4) % 4)
issuer = "https://" + base64.b64decode(normalized).decode().rstrip("$")
if issuer.endswith("/"):
    sys.exit("Clerk issuer must not have a trailing slash")
convex_env_set("CLERK_FRONTEND_API_URL", issuer)

secret = os.environ.get("MCP_ROLE_SECRET", "").strip()
if secret:
    convex_env_set("MCP_ROLE_SECRET", secret)
print("synced convex auth env")
PY
