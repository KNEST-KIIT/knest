#!/usr/bin/env bash
#
# Verifies the three application-engine fixes named in PHASE-7-9-
# RETROSPECTIVE.md §1 (carried forward, unfixed, from PHASE-5-6-
# RETROSPECTIVE.md §1/§4) actually hold against a running server:
#   1. startApplication's idempotency is atomic — two concurrent starts for
#      the same user+program return the same applicationId, neither 500s.
#   2. submitApplication checks program.applicationStatus, not only the
#      deadline — closing a program mid-cohort blocks a pending draft from
#      submitting.
#   3. changeApplicationStatus uses the route-handler guard family — a
#      non-staff request gets a JSON 403, not an empty-body 404.
#
# Usage:  pnpm dev  (in another shell, seeded)  &&  ./scripts/verify-application-flow.sh
set -u

BASE="${BASE_URL:-http://localhost:3000}"
PASSWORD="${SEED_PASSWORD:-knest-dev-password}"
JAR_DIR="$(mktemp -d)"
APPLICANT_EMAIL="app-flow-check-$$@knest.local"
LOG="${DEV_LOG:-/tmp/knest-dev.log}"
failures=0
PROGRAM_ID=""

cleanup() {
  if [ -n "$PROGRAM_ID" ]; then
    curl -s -b "$JAR_DIR/admin.jar" -X DELETE "$BASE/api/programs/$PROGRAM_ID" > /dev/null
  fi
  PGPASSWORD=knest psql -h 127.0.0.1 -U knest -d knest -q -c \
    "DELETE FROM app.users WHERE email='$APPLICANT_EMAIL';" > /dev/null 2>&1
  rm -rf "$JAR_DIR"
}
trap cleanup EXIT

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ✓ %-58s %s\n' "$label" "$actual"
  else
    printf '  ✗ %-58s got %s, expected %s\n' "$label" "$actual" "$expected"
    failures=$((failures + 1))
  fi
}

echo "Application-engine fixes — $BASE"
echo

curl -s -c "$JAR_DIR/admin.jar" -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@knest.local\",\"password\":\"$PASSWORD\"}" \
  "$BASE/api/auth/password/login" > /dev/null

PROGRAM_ID=$(curl -s -b "$JAR_DIR/admin.jar" -X POST "$BASE/api/programs" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "App Flow Check Program",
    "tagline": "temp",
    "whoItsFor": {"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"test","version":1}],"version":1}],"direction":null,"format":"","indent":0,"version":1}},
    "stage": ["idea"],
    "applicationStatus": "open",
    "_status": "published"
  }' | python3 -c "import json,sys; print(json.load(sys.stdin)['doc']['id'])")

curl -s -c "$JAR_DIR/applicant.jar" -X POST -H 'Content-Type: application/json' \
  -d "{\"name\":\"Flow Check\",\"email\":\"$APPLICANT_EMAIL\",\"password\":\"first-password-123456\"}" \
  "$BASE/api/auth/password/signup" > /dev/null

sleep 1
VTOKEN=$(grep -oP "verify/confirm\?email=[^&]*&token=\K[a-f0-9]+" "$LOG" | tail -1)
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$APPLICANT_EMAIL\",\"token\":\"$VTOKEN\"}" \
  "$BASE/api/auth/password/verify/confirm" > /dev/null

echo "startApplication's idempotency is atomic under concurrency:"
curl -s -b "$JAR_DIR/applicant.jar" -X POST "$BASE/api/applications/start" \
  -H 'Content-Type: application/json' -d "{\"programSlug\":\"app-flow-check-program\"}" \
  -o "$JAR_DIR/start1.json" -w '%{http_code}' > "$JAR_DIR/start1.status" &
curl -s -b "$JAR_DIR/applicant.jar" -X POST "$BASE/api/applications/start" \
  -H 'Content-Type: application/json' -d "{\"programSlug\":\"app-flow-check-program\"}" \
  -o "$JAR_DIR/start2.json" -w '%{http_code}' > "$JAR_DIR/start2.status" &
wait

STATUS1=$(cat "$JAR_DIR/start1.status")
STATUS2=$(cat "$JAR_DIR/start2.status")
ID1=$(python3 -c "import json; print(json.load(open('$JAR_DIR/start1.json')).get('applicationId',''))")
ID2=$(python3 -c "import json; print(json.load(open('$JAR_DIR/start2.json')).get('applicationId',''))")

check "first concurrent start"           "200" "$STATUS1"
check "second concurrent start"          "200" "$STATUS2"
check "both return the same applicationId" "$ID1" "$ID2"

APPLICATION_ID="$ID1"

echo
echo "submitApplication checks applicationStatus, not only the deadline:"
curl -s -b "$JAR_DIR/admin.jar" -X PATCH "$BASE/api/programs/$PROGRAM_ID" \
  -H 'Content-Type: application/json' -d '{"applicationStatus":"closed"}' > /dev/null

SUBMIT_CODE=$(curl -s -b "$JAR_DIR/applicant.jar" -o "$JAR_DIR/submit.json" -w '%{http_code}' \
  -X POST "$BASE/api/applications/$APPLICATION_ID/submit")
check "submit rejected once the program is closed" "400" "$SUBMIT_CODE"

echo
echo "changeApplicationStatus uses the route-handler guard family (JSON error, not empty 404):"
RESPONSE=$(curl -s -b "$JAR_DIR/applicant.jar" -w '\n%{http_code}' \
  -X POST "$BASE/api/admin/applications/$APPLICATION_ID/status" \
  -H 'Content-Type: application/json' -d '{"status":"under_review"}')
STATUS_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

check "non-staff request rejected" "403" "$STATUS_CODE"
if echo "$BODY" | grep -q '"error"'; then
  echo "  ✓ response body carries a JSON error, not empty"
else
  echo "  ✗ response body has no JSON error — got: $BODY"
  failures=$((failures + 1))
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "All application-flow checks passed."
else
  echo "$failures check(s) FAILED."
fi
exit "$failures"
