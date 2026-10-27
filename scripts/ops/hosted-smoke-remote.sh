#!/usr/bin/env bash
#
# Runs scripts/hosted-smoke.mjs ON the production application host through SSM Run Command and
# prints its output. The script needs no gate password and no database route: it runs inside the
# release's migrate image, beside the app container, with the same environment the app uses.
#
# Usage (from the repo root, AWS credentials for account 166917387892 in the environment):
#   PYTHONUTF8=1 AWS_DEFAULT_REGION=ap-south-1 bash scripts/ops/hosted-smoke-remote.sh [migrate-image-by-digest]
#
# With no argument the migrate image of the running release is read from the host
# (/opt/knest/current is the app image; the migrate image is passed explicitly or found in ECR by the
# release tag convention). Secrets are read on the host and never printed.
set -euo pipefail
export MSYS_NO_PATHCONV=1

ENVIRONMENT="${ENVIRONMENT:-production}"
INSTANCE_ID="${INSTANCE_ID:-$(aws ec2 describe-instances --filters "Name=tag:knest-deploy-target,Values=$ENVIRONMENT" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].InstanceId' --output text)}"
MIGRATE_IMAGE="${1:-}"
if [ -z "$MIGRATE_IMAGE" ]; then
  echo "pass the migrate image URI (…@sha256:…) of the running release as the first argument" >&2
  exit 2
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
PAYLOAD="$(base64 -w0 "$HERE/../hosted-smoke.mjs")"

read -r -d '' REMOTE <<'EOS' || true
set -euo pipefail
ENVIRONMENT="__ENVIRONMENT__"
IMAGE="__IMAGE__"
TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 120')
REGION=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
param() { aws ssm get-parameter --region "$REGION" --name "/knest-$ENVIRONMENT/config/$1" --query Parameter.Value --output text; }
secret() { aws secretsmanager get-secret-value --region "$REGION" --secret-id "$1" --query SecretString --output text; }
umask 077
WORK=$(mktemp -d /run/knest-smoke.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
echo "__PAYLOAD__" | base64 -d > "$WORK/hosted-smoke.mjs"
# Hosted acceptance must exercise the same least-privilege identity as the web process.
# Never hide a broken runtime-role deployment by falling back to the database master.
RUNTIME_ARN=$(param db-runtime-secret-arn)
[ -n "$RUNTIME_ARN" ] && [ "$RUNTIME_ARN" != "None" ] || { echo "runtime database secret is not configured" >&2; exit 1; }
DB_SECRET=$(secret "$RUNTIME_ARN")
DB_USER=$(echo "$DB_SECRET" | jq -r .username)
DB_PASSWORD=$(echo "$DB_SECRET" | jq -rj .password | jq -sRr @uri)
{
  echo "DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@$(param db-endpoint):5432/knest"
  echo "DATABASE_SSL=verify"
  echo "DATABASE_SSL_CA_FILE=/etc/knest/rds-global-bundle.pem"
  echo "SITE_URL=$(param site-url)"
  echo "ORIGIN_VERIFY_SECRET=$(secret "knest-$ENVIRONMENT/origin-verify")"
} > "$WORK/smoke.env"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${IMAGE%%/*}" >/dev/null 2>&1
docker run --rm --network host --env-file "$WORK/smoke.env" \
  -v /opt/knest/rds-global-bundle.pem:/etc/knest/rds-global-bundle.pem:ro \
  -v "$WORK/hosted-smoke.mjs:/app/hosted-smoke.mjs:ro" \
  -w /app "$IMAGE" node hosted-smoke.mjs
EOS

REMOTE="${REMOTE//__ENVIRONMENT__/$ENVIRONMENT}"
REMOTE="${REMOTE//__IMAGE__/$MIGRATE_IMAGE}"
REMOTE="${REMOTE//__PAYLOAD__/$PAYLOAD}"

PARAMS_FILE="$(mktemp)"
trap 'rm -f "$PARAMS_FILE"' EXIT
printf '{"commands":[%s],"executionTimeout":["600"]}' "$(printf '%s' "$REMOTE" | python -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$PARAMS_FILE"

CMD_ID=$(aws ssm send-command --document-name AWS-RunShellScript --instance-ids "$INSTANCE_ID" \
  --parameters "file://$PARAMS_FILE" --comment "KNEST hosted smoke test" --query Command.CommandId --output text)
echo "command $CMD_ID on $INSTANCE_ID"
for _ in $(seq 1 90); do
  STATUS=$(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query Status --output text 2>/dev/null || echo Pending)
  case "$STATUS" in Success|Failed|Cancelled|TimedOut) break ;; esac
  sleep 5
done
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
[ "$STATUS" = "Success" ]
