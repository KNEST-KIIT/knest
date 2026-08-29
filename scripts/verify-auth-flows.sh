#!/usr/bin/env bash
#
# Verifies the signup/verify/reset security properties end to end against a
# running server: single-use tokens, session revocation on password reset,
# and enumeration resistance. These are properties that are easy to silently
# break in a later refactor, so they are checked here rather than only by
# having been tested once by hand.
#
# Usage:  pnpm dev  (in another shell)  &&  ./scripts/verify-auth-flows.sh
set -u

BASE="${BASE_URL:-http://localhost:3000}"
EMAIL="auth-flow-check-$$@knest.local"
LOG="${DEV_LOG:-/tmp/knest-dev.log}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
failures=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ✓ %-58s %s\n' "$label" "$actual"
  else
    printf '  ✗ %-58s got %s, expected %s\n' "$label" "$actual" "$expected"
    failures=$((failures + 1))
  fi
}

echo "Auth flow security properties — $BASE"
echo

curl -s -c "$JAR" -X POST -H 'Content-Type: application/json' \
  -d "{\"name\":\"Flow Check\",\"email\":\"$EMAIL\",\"password\":\"first-password-123456\"}" \
  "$BASE/api/auth/password/signup" > /dev/null

check "signup issues a session immediately" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/api/auth/session")"

sleep 1
VTOKEN=$(grep -oP "verify/confirm\?email=[^&]*&token=\K[a-f0-9]+" "$LOG" | tail -1)

echo
echo "Email verification tokens are single-use:"
check "first use succeeds" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"token\":\"$VTOKEN\"}" "$BASE/api/auth/password/verify/confirm")"
check "reuse is rejected" "400" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"token\":\"$VTOKEN\"}" "$BASE/api/auth/password/verify/confirm")"

echo
echo "Password reset revokes every existing session, not just the requester's:"
curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}" \
  "$BASE/api/auth/password/reset/request" > /dev/null
sleep 1
RTOKEN=$(grep -oP "reset/confirm\?email=[^&]*&token=\K[a-f0-9]+" "$LOG" | tail -1)

curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"token\":\"$RTOKEN\",\"password\":\"second-password-654321\"}" \
  "$BASE/api/auth/password/reset/confirm" > /dev/null

check "the pre-reset session is dead" "null" \
  "$(curl -s -b "$JAR" "$BASE/api/auth/session")"
check "the old password is rejected" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"first-password-123456\"}" "$BASE/api/auth/password/login")"
check "the new password works" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"second-password-654321\"}" "$BASE/api/auth/password/login")"

echo
echo "Enumeration resistance:"
check "reset request for an unknown email still reports ok" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d '{"email":"definitely-nobody-here@knest.local"}' "$BASE/api/auth/password/reset/request")"

PGPASSWORD=knest psql -h 127.0.0.1 -U knest -d knest -q -c \
  "DELETE FROM app.users WHERE email='$EMAIL';" > /dev/null 2>&1

echo
if [ "$failures" -eq 0 ]; then
  echo "All auth flow checks passed."
else
  echo "$failures check(s) FAILED."
fi
exit "$failures"
