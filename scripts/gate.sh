#!/usr/bin/env bash
# The single definition of "done". Every task ends with this green.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

if [ ! -d node_modules ]; then
  step "install"
  npm ci
fi

step "suppressions"
# Guardrails cannot be switched off from inside the code.
if grep -rnE '@ts-(ignore|nocheck|expect-error)|eslint-disable|@effect-diagnostics' --exclude=gate.sh src test scripts; then
  echo "Remove the suppression comments above and fix the underlying problem." >&2
  exit 1
fi

step "typecheck"
npm run -s typecheck

step "effect diagnostics"
npm run -s effect:check

step "lint"
npm run -s lint

step "tests"
npm run -s test

step "smoke: app on its own port"
port="$(node -e 'const s=require("node:net").createServer().listen(0,()=>{process.stdout.write(String(s.address().port));s.close()})')"
log="$(mktemp)"
PORT="$port" node src/main.ts >"$log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; rm -f "$log"' EXIT
for _ in $(seq 1 50); do
  curl -fsS "http://localhost:$port/health" >/dev/null 2>&1 && break
  if ! kill -0 "$pid" 2>/dev/null; then cat "$log" >&2; echo "app exited before it was healthy" >&2; exit 1; fi
  sleep 0.1
done
curl -fsS "http://localhost:$port/health" >/dev/null || { cat "$log" >&2; echo "app never became healthy on port $port" >&2; exit 1; }
classes="$(curl -fsS "http://localhost:$port/classes" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).length)))')"
[ "$classes" -gt 0 ] || { echo "no seeded classes served" >&2; exit 1; }
echo "app served $classes seeded classes on port $port"

printf '\n\033[1;32mgate: green\033[0m\n'
