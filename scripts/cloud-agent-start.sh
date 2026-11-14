#!/usr/bin/env bash
# Cloud Agent `start` — write apps/web/.env.local, bring up anonymous Convex + Next.js.
# Idempotent: skips services that are already listening.
# There is no demo seed in this repo.
set -euo pipefail

# Cursor runs `start` from the workspace root (sometimes via a copied script).
if [[ -f package.json && -d apps/web/convex ]]; then
  ROOT="$(pwd)"
elif [[ -f /workspace/package.json && -d /workspace/apps/web/convex ]]; then
  ROOT="/workspace"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$ROOT"
WEB="$ROOT/apps/web"

python3 - <<'PY'
import os
from pathlib import Path

root = Path.cwd()
env_path = root / "apps" / "web" / ".env.local"

# Preserve Convex URLs already written by `convex init` / `convex dev`.
preserved: dict[str, str] = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"')
        if k in (
            "NEXT_PUBLIC_CONVEX_URL",
            "CONVEX_DEPLOYMENT",
            "NEXT_PUBLIC_CONVEX_SITE_URL",
        ) and v:
            preserved[k] = v

def env(name: str, default: str = "") -> str:
    v = os.environ.get(name) or default
    if not v or "\n" in v or "\r" in v:
        return ""
    return v

def quote(name: str, value: str) -> str:
    if name.endswith("_KEY") or name.endswith("_SECRET") or name.endswith("_IDS"):
        return f'{name}="{value}"'
    return f"{name}={value}"

clerk_keys = {
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": env("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    "CLERK_SECRET_KEY": env("CLERK_SECRET_KEY"),
    "CLERK_FRONTEND_API_URL": env("CLERK_FRONTEND_API_URL"),
}
mcp = {
    "MCP_RESOURCE_URL": env("MCP_RESOURCE_URL"),
    "MCP_ROLE_SECRET": env("MCP_ROLE_SECRET"),
}

lines = [
    "# Convex — written by anonymous `convex init` / `convex dev` (do not inject cloud URLs)",
    f"NEXT_PUBLIC_CONVEX_URL={preserved.get('NEXT_PUBLIC_CONVEX_URL', '')}",
    f"CONVEX_DEPLOYMENT={preserved.get('CONVEX_DEPLOYMENT', '')}",
    "",
    "# Clerk",
]
for k, v in clerk_keys.items():
    lines.append(quote(k, v) if v else f"{k}=")

lines += ["", "# MCP"]
for k, v in mcp.items():
    lines.append(quote(k, v) if v else f"{k}=")

if preserved.get("NEXT_PUBLIC_CONVEX_SITE_URL"):
    lines += ["", f"NEXT_PUBLIC_CONVEX_SITE_URL={preserved['NEXT_PUBLIC_CONVEX_SITE_URL']}"]

env_path.write_text("\n".join(lines) + "\n")
print("env.local", sum(1 for L in lines if L and not L.startswith("#") and "=" in L))
PY

# Convex API health is /version (GET / often 404s; curl -f would treat that as down).
convex_up() {
  curl -sf -o /dev/null "http://127.0.0.1:3210/version" 2>/dev/null
}

next_up() {
  curl -sf -o /dev/null "http://127.0.0.1:3000/" 2>/dev/null
}

convex_cli() {
  env -u CONVEX_DEPLOYMENT -u NEXT_PUBLIC_CONVEX_URL -u NEXT_PUBLIC_CONVEX_SITE_URL \
    CONVEX_AGENT_MODE=anonymous pnpm exec convex "$@"
}

# Clear injected cloud Convex deployment so anonymous mode can win.
export CONVEX_AGENT_MODE="${CONVEX_AGENT_MODE:-anonymous}"
unset CONVEX_DEPLOYMENT NEXT_PUBLIC_CONVEX_URL NEXT_PUBLIC_CONVEX_SITE_URL || true

cd "$WEB"

if ! grep -q '^CONVEX_DEPLOYMENT=anonymous:' .env.local 2>/dev/null; then
  echo "[cloud-agent-start] configuring anonymous Convex…"
  pnpm exec convex init </dev/null
fi

# `convex init` starts the local backend and does not push functions.
# `convex dev` exits if auth.config.ts references an unset variable, so set
# deployment env before the first push.
if ! convex_up; then
  echo "[cloud-agent-start] waiting for Convex on :3210…"
  for _ in $(seq 1 90); do
    convex_up && break
    sleep 1
  done
  if ! convex_up; then
    echo "[cloud-agent-start] Convex did not become ready on :3210/version" >&2
    exit 1
  fi
fi

# Not a Clerk issuer and not a secret. Replaced when a Clerk app exists.
PLACEHOLDER_CLERK_ISSUER="https://clerk.example.invalid"
current_clerk="$(convex_cli env get CLERK_FRONTEND_API_URL 2>/dev/null || true)"
if [[ -n "${CLERK_FRONTEND_API_URL:-}" ]]; then
  echo "[cloud-agent-start] ensuring CLERK_FRONTEND_API_URL on Convex…"
  convex_cli env set CLERK_FRONTEND_API_URL "$CLERK_FRONTEND_API_URL" >/dev/null || true
elif [[ -z "${current_clerk//[$' \t\r\n']/}" ]]; then
  echo "[cloud-agent-start] CLERK_FRONTEND_API_URL unset; using placeholder issuer on local Convex"
  convex_cli env set CLERK_FRONTEND_API_URL "$PLACEHOLDER_CLERK_ISSUER" >/dev/null || true
fi

TMUX_CONF="/exec-daemon/tmux.portal.conf"
tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

ensure_tmux_session() {
  local name="$1"
  local cmd="$2"
  if tmux_cmd has-session -t "=${name}" 2>/dev/null; then
    return 0
  fi
  tmux_cmd new-session -d -s "$name" -c "$WEB" -- "${SHELL:-bash}" -l
  tmux_cmd send-keys -t "${name}:0.0" "$cmd" C-m
}

# Backend is already listening. This watcher pushes functions. It no-ops when
# the session is already running.
echo "[cloud-agent-start] ensuring Convex dev is running…"
ensure_tmux_session "convex-dev" \
  "env -u CONVEX_DEPLOYMENT -u NEXT_PUBLIC_CONVEX_URL -u NEXT_PUBLIC_CONVEX_SITE_URL CONVEX_AGENT_MODE=anonymous pnpm exec convex dev"

if [[ -n "${ADMIN_CLERK_USER_IDS:-}" ]]; then
  echo "[cloud-agent-start] ensuring ADMIN_CLERK_USER_IDS on Convex…"
  convex_cli env set ADMIN_CLERK_USER_IDS "$ADMIN_CLERK_USER_IDS" >/dev/null || true
fi

if [[ -n "${MCP_ROLE_SECRET:-}" ]]; then
  echo "[cloud-agent-start] ensuring MCP_ROLE_SECRET on Convex…"
  convex_cli env set MCP_ROLE_SECRET "$MCP_ROLE_SECRET" >/dev/null || true
fi

if next_up; then
  echo "[cloud-agent-start] Next.js already on :3000 — idle."
  exec sleep infinity
fi

echo "[cloud-agent-start] starting Next.js on :3000…"
exec env -u CONVEX_DEPLOYMENT -u NEXT_PUBLIC_CONVEX_URL -u NEXT_PUBLIC_CONVEX_SITE_URL \
  pnpm dev
