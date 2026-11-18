#!/usr/bin/env bash
# Cloud Agent `start` — anonymous Convex plus the Vite app on port 3000.
# Idempotent: skips services that are already listening.
set -euo pipefail

if [[ -f package.json && -d packages/backend/convex ]]; then
  ROOT="$(pwd)"
elif [[ -f /workspace/package.json && -d /workspace/packages/backend/convex ]]; then
  ROOT="/workspace"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$ROOT"

python3 - <<'PY'
import os
from pathlib import Path

root = Path.cwd()
backend_env = root / "packages" / "backend" / ".env.local"
web_env = root / "apps" / "web" / ".env.local"

preserved: dict[str, str] = {}
if backend_env.exists():
    for line in backend_env.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"')
        if key in ("CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL", "CONVEX_DEPLOYMENT") and value:
            preserved[key] = value

def env(name: str) -> str:
    value = os.environ.get(name) or ""
    if not value or "\n" in value or "\r" in value:
        return ""
    return value

convex_url = preserved.get("CONVEX_URL") or preserved.get("NEXT_PUBLIC_CONVEX_URL") or ""
backend_lines = [
    "# Written by scripts/cloud-agent-start.sh",
    f"CONVEX_DEPLOYMENT={preserved.get('CONVEX_DEPLOYMENT', '')}",
    f"CONVEX_URL={convex_url}",
    f"NEXT_PUBLIC_CONVEX_URL={convex_url}",
    f"CLERK_FRONTEND_API_URL={env('CLERK_FRONTEND_API_URL')}",
]
backend_env.parent.mkdir(parents=True, exist_ok=True)
backend_env.write_text("\n".join(backend_lines) + "\n")

publishable = env("VITE_CLERK_PUBLISHABLE_KEY") or env("CLERK_PUBLISHABLE_KEY") or env("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
web_lines = [
    "# Written by scripts/cloud-agent-start.sh",
    f"VITE_CONVEX_URL={convex_url}",
    f"VITE_CLERK_PUBLISHABLE_KEY={publishable}",
]
web_env.parent.mkdir(parents=True, exist_ok=True)
web_env.write_text("\n".join(web_lines) + "\n")
print("wrote env files")
PY

convex_up() {
  curl -sf -o /dev/null "http://127.0.0.1:3210/version" 2>/dev/null
}

web_up() {
  curl -sf -o /dev/null "http://127.0.0.1:3000/" 2>/dev/null
}

export CONVEX_AGENT_MODE="${CONVEX_AGENT_MODE:-anonymous}"
unset CONVEX_DEPLOYMENT CONVEX_URL NEXT_PUBLIC_CONVEX_URL || true

cd "$ROOT/packages/backend"
if ! grep -q '^CONVEX_DEPLOYMENT=anonymous:' .env.local 2>/dev/null; then
  echo "[cloud-agent-start] configuring anonymous Convex…"
  pnpm exec convex init </dev/null || true
fi

if ! convex_up; then
  echo "[cloud-agent-start] waiting for Convex on :3210…"
  for _ in $(seq 1 90); do
    convex_up && break
    sleep 1
  done
fi

PLACEHOLDER_CLERK_ISSUER="https://clerk.example.invalid"
run_convex() {
  env -u CONVEX_DEPLOYMENT -u CONVEX_URL -u NEXT_PUBLIC_CONVEX_URL \
    CONVEX_AGENT_MODE=anonymous pnpm exec convex "$@"
}

if [[ -n "${CLERK_FRONTEND_API_URL:-}" ]]; then
  run_convex env set CLERK_FRONTEND_API_URL "$CLERK_FRONTEND_API_URL" >/dev/null || true
else
  run_convex env set CLERK_FRONTEND_API_URL "$PLACEHOLDER_CLERK_ISSUER" >/dev/null || true
fi

if [[ -n "${ADMIN_CLERK_USER_IDS:-}" ]]; then
  run_convex env set ADMIN_CLERK_USER_IDS "$ADMIN_CLERK_USER_IDS" >/dev/null || true
fi
if [[ -n "${MCP_ROLE_SECRET:-}" ]]; then
  run_convex env set MCP_ROLE_SECRET "$MCP_ROLE_SECRET" >/dev/null || true
fi

# convex init writes the local URL into packages/backend/.env.local.
python3 - <<'PY'
from pathlib import Path
vals = {}
backend = Path(".env.local")
if backend.exists():
    for line in backend.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        vals[key] = value.strip().strip('"')
url = vals.get("CONVEX_URL") or vals.get("NEXT_PUBLIC_CONVEX_URL") or "http://127.0.0.1:3210"
web = Path("../../apps/web/.env.local")
lines = web.read_text().splitlines() if web.exists() else []
found = False
out = []
for line in lines:
    if line.startswith("VITE_CONVEX_URL="):
        out.append(f"VITE_CONVEX_URL={url}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"VITE_CONVEX_URL={url}")
web.parent.mkdir(parents=True, exist_ok=True)
web.write_text("\n".join(out) + "\n")
print("mirrored convex url to vite")
PY

cd "$ROOT"
if web_up; then
  echo "[cloud-agent-start] Vite already on :3000 — idle."
  exec sleep infinity
fi

echo "[cloud-agent-start] starting Vite on :3000…"
exec pnpm dev
