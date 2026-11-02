#!/usr/bin/env bash
#
# Zero-downtime container swap on ONE host: two slots (knest-a on port 3000, knest-b on port 3001), both registered
# with the load balancer's target group. A release is started in the idle slot, proven healthy locally and by the
# load balancer, and only then is the old slot taken out of rotation, drained and stopped. At no point does the
# target group have zero healthy targets, and any failure leaves the old slot exactly as it was.
#
#   deploy-slot.sh <image>
#
# Environment (all but the first three have defaults):
#   TARGET_GROUP_ARN   the load balancer target group
#   INSTANCE_ID        this instance's id, as registered in the target group
#   RUN_OPTS           extra `docker run` options (env file, mounts, log driver)
#   REGION, SLOT_A_PORT, SLOT_B_PORT, DRAIN_SECONDS, HEALTH_TRIES, TARGET_TRIES, POLL_SECONDS
#
# The very first swap meets the old single container named `knest` (port 3000). It is treated as the live slot: the
# release starts in slot b, and `knest` is drained and removed like any old slot.
#
# STATUS: tested with stand-in docker/aws commands (infra/deploy-slot.test.ts). NOT yet wired into the deploy document
# in infra/cfn/app.yaml, and not yet run against a real load balancer. See docs/delivery/ZERO-DOWNTIME-DEPLOY.md.
set -euo pipefail

IMAGE="${1:?usage: deploy-slot.sh <image>}"
: "${TARGET_GROUP_ARN:?TARGET_GROUP_ARN is required}"
: "${INSTANCE_ID:?INSTANCE_ID is required}"
REGION="${REGION:-ap-south-1}"
RUN_OPTS="${RUN_OPTS:-}"
PORT_A="${SLOT_A_PORT:-3000}"
PORT_B="${SLOT_B_PORT:-3001}"
DRAIN_SECONDS="${DRAIN_SECONDS:-60}"
HEALTH_TRIES="${HEALTH_TRIES:-45}"
TARGET_TRIES="${TARGET_TRIES:-30}"
POLL_SECONDS="${POLL_SECONDS:-2}"

# No Docker `--format` Go templates anywhere in this file: it is embedded in an SSM document, where a pair of opening braces
# starts a parameter placeholder. Names are the last column of `docker ps`; health comes from `docker inspect` through jq.
running() { docker ps | awk 'NR > 1 { print $NF }' | grep -qx "$1"; }
port_of() { case "$1" in knest-a | knest) echo "$PORT_A" ;; knest-b) echo "$PORT_B" ;; esac; }

# Which container is serving now?
LIVE=""
if running knest-a; then LIVE="knest-a"; fi
if running knest-b; then
  if [ -n "$LIVE" ]; then echo "Both slots are running; refusing to guess which is live. Stop one and retry." >&2; exit 3; fi
  LIVE="knest-b"
fi
if [ -z "$LIVE" ] && running knest; then LIVE="knest"; fi

# The release goes to the other slot. With nothing running, or the legacy container, that is slot b / slot a.
if [ "$LIVE" = "knest-a" ] || [ "$LIVE" = "knest" ]; then NEW="knest-b"; else NEW="knest-a"; fi
if [ "$LIVE" = "knest" ]; then NEW="knest-b"; fi
NEW_PORT="$(port_of "$NEW")"

target() { echo "Id=$INSTANCE_ID,Port=$1"; }

registered=0
cleanup_failed_release() {
  echo "Release failed; leaving ${LIVE:-nothing} in service." >&2
  if [ "$registered" = "1" ]; then
    aws elbv2 deregister-targets --region "$REGION" --target-group-arn "$TARGET_GROUP_ARN" --targets "$(target "$NEW_PORT")" >/dev/null 2>&1 || true
  fi
  docker logs --tail 40 "$NEW" >&2 2>&1 || true
  docker rm -f "$NEW" >/dev/null 2>&1 || true
}

echo "Live: ${LIVE:-none}. Starting $IMAGE as $NEW on port $NEW_PORT."
docker rm -f "$NEW" >/dev/null 2>&1 || true
# shellcheck disable=SC2086  # RUN_OPTS is a list of options on purpose
if ! docker run -d --name "$NEW" --restart unless-stopped $RUN_OPTS -p "${NEW_PORT}:3000" "$IMAGE" >/dev/null; then
  cleanup_failed_release
  exit 1
fi

# 1. The container's own health check.
ok=0
for _ in $(seq 1 "$HEALTH_TRIES"); do
  status="$(docker inspect "$NEW" 2>/dev/null | jq -r '.[0].State.Health.Status // "starting"' 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then ok=1; break; fi
  sleep "$POLL_SECONDS"
done
if [ "$ok" != "1" ]; then
  echo "$NEW did not become healthy." >&2
  cleanup_failed_release
  exit 1
fi

# 2. Put it in rotation and wait until the load balancer agrees. The old slot is still serving throughout.
if ! aws elbv2 register-targets --region "$REGION" --target-group-arn "$TARGET_GROUP_ARN" --targets "$(target "$NEW_PORT")" >/dev/null; then
  cleanup_failed_release
  exit 1
fi
registered=1
ok=0
for _ in $(seq 1 "$TARGET_TRIES"); do
  state="$(aws elbv2 describe-target-health --region "$REGION" --target-group-arn "$TARGET_GROUP_ARN" --targets "$(target "$NEW_PORT")" --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text 2>/dev/null || echo unknown)"
  if [ "$state" = "healthy" ]; then ok=1; break; fi
  sleep "$POLL_SECONDS"
done
if [ "$ok" != "1" ]; then
  echo "The load balancer did not mark $NEW healthy." >&2
  cleanup_failed_release
  exit 1
fi

# 3. Only now retire the old slot: out of rotation first, wait out the drain, then stop it.
if [ -n "$LIVE" ]; then
  aws elbv2 deregister-targets --region "$REGION" --target-group-arn "$TARGET_GROUP_ARN" --targets "$(target "$(port_of "$LIVE")")" >/dev/null || true
  sleep "$DRAIN_SECONDS"
  docker rm -f "$LIVE" >/dev/null 2>&1 || true
fi
echo "live=$NEW"
