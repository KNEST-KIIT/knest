#!/usr/bin/env bash
#
# Verifies the authorization boundary against a running server.
#
# Role checks in components decide what to render; they are not access control.
# This probes the server directly with curl, which is the only way to show that
# the boundary holds when the UI is bypassed entirely.
#
# Usage:  pnpm dev  (in another shell, seeded)  &&  ./scripts/verify-auth-boundary.sh
set -u

BASE="${BASE_URL:-http://localhost:3000}"
PASSWORD="${SEED_PASSWORD:-knest-dev-password}"
JAR_DIR="$(mktemp -d)"
trap 'rm -rf "$JAR_DIR"' EXIT
failures=0

login() {
  curl -s -c "$JAR_DIR/$2.jar" -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}" \
    "$BASE/api/auth/password/login" > /dev/null
}

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ✓ %-52s %s\n' "$label" "$actual"
  else
    printf '  ✗ %-52s got %s, expected %s\n' "$label" "$actual" "$expected"
    failures=$((failures + 1))
  fi
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "Authorization boundary — $BASE"
echo

login student@knest.local student
login admin@knest.local admin

echo "/admin is staff-only, and answers 404 so it does not confirm it exists:"
check "anonymous"                "404" "$(status "$BASE/admin")"
check "student (staffRole=null)" "404" "$(status -b "$JAR_DIR/student.jar" "$BASE/admin")"
check "super_admin"              "200" "$(status -b "$JAR_DIR/admin.jar" "$BASE/admin")"

echo
echo "Credentials:"
check "wrong password rejected" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d "{\"email\":\"admin@knest.local\",\"password\":\"definitely-wrong\"}" \
      "$BASE/api/auth/password/login")"

echo
echo "The session endpoint must not publish the session secret:"
if curl -s -b "$JAR_DIR/admin.jar" "$BASE/api/auth/session" | grep -q 'sessionToken'; then
  echo "  ✗ /api/auth/session leaks sessionToken"
  failures=$((failures + 1))
else
  echo "  ✓ /api/auth/session omits sessionToken"
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "All boundary checks passed."
else
  echo "$failures check(s) FAILED."
fi
exit "$failures"
