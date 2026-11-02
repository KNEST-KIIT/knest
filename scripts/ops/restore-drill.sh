#!/usr/bin/env bash
#
# Restore drill: proves a database snapshot can be turned back into a running database, and measures how long
# that takes. A backup nobody has restored is a hope, not a backup.
#
#   bash scripts/ops/restore-drill.sh --dry-run                 # print what would happen, change nothing
#   bash scripts/ops/restore-drill.sh                           # restore the newest pre-migrate snapshot
#   bash scripts/ops/restore-drill.sh pre-migrate-20261029...   # restore a named snapshot
#
# It uses only what the operator policy allows (infra/iam/operator-policy.json, "SnapshotsAndRestoreDrills"):
# restoring a pre-migrate-* or knest-drill-* snapshot into a NEW instance named knest-drill-*, in the production
# subnet group and database security group, never publicly reachable. It never touches the live database.
#
# The operator policy deliberately cannot delete anything, so the drill instance is removed by the account owner
# with the command this script prints at the end. The instance bills by the hour until then; db.t4g.micro is cents.
#
# What the script proves: the snapshot restores and the instance reaches "available", and how long that took (the
# recovery time to quote). What it cannot do from here: look inside. The last step of the runbook is a row-count
# check from the app host, because the database is private. docs/delivery/RESTORE-DRILL.md lists it.
set -euo pipefail
export MSYS_NO_PATHCONV=1 PYTHONUTF8=1
HERE="$(cd "$(dirname "$0")" && pwd)"

DRY_RUN=0
SNAPSHOT=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) SNAPSHOT="$arg" ;;
  esac
done

(cd "$HERE" && node ./require-scoped-aws.mjs) || exit 2
readonly KNEST_SCOPED_AWS_PROFILE="$AWS_PROFILE"
aws() { command aws --profile "$KNEST_SCOPED_AWS_PROFILE" "$@"; }

REGION="${KNEST_REGION:-ap-south-1}"
SOURCE_DB="${KNEST_DB_INSTANCE:-}"
if [ -z "$SOURCE_DB" ]; then
  SOURCE_DB="$(aws ssm get-parameter --region "$REGION" --name /knest-production/config/db-instance-id --query Parameter.Value --output text)"
fi

if [ -z "$SNAPSHOT" ]; then
  SNAPSHOT="$(aws rds describe-db-snapshots --region "$REGION" --db-instance-identifier "$SOURCE_DB" --snapshot-type manual \
    --query "reverse(sort_by(DBSnapshots[?starts_with(DBSnapshotIdentifier, 'pre-migrate-') && Status=='available'], &SnapshotCreateTime))[0].DBSnapshotIdentifier" --output text)"
fi
if [ -z "$SNAPSHOT" ] || [ "$SNAPSHOT" = "None" ]; then
  echo "No available pre-migrate snapshot found for $SOURCE_DB. Name one explicitly." >&2
  exit 1
fi

TARGET="knest-drill-$(date -u +%Y%m%d%H%M%S)"
SUBNET_GROUP="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$SOURCE_DB" --query 'DBInstances[0].DBSubnetGroup.DBSubnetGroupName' --output text)"
SECURITY_GROUPS="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$SOURCE_DB" --query 'DBInstances[0].VpcSecurityGroups[].VpcSecurityGroupId' --output text)"
PARAMETER_GROUP="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$SOURCE_DB" --query 'DBInstances[0].DBParameterGroups[0].DBParameterGroupName' --output text)"

echo "Source database : $SOURCE_DB"
echo "Snapshot        : $SNAPSHOT"
echo "Drill instance  : $TARGET (class db.t4g.micro, private, subnet group $SUBNET_GROUP)"
echo "Security groups : $SECURITY_GROUPS"

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run: nothing was created."
  exit 0
fi

START=$(date +%s)
# shellcheck disable=SC2086  # the security group ids are a space-separated list on purpose
aws rds restore-db-instance-from-db-snapshot --region "$REGION" \
  --db-instance-identifier "$TARGET" --db-snapshot-identifier "$SNAPSHOT" \
  --db-instance-class db.t4g.micro --db-subnet-group-name "$SUBNET_GROUP" \
  --vpc-security-group-ids $SECURITY_GROUPS --db-parameter-group-name "$PARAMETER_GROUP" \
  --no-publicly-accessible --no-multi-az --deletion-protection \
  --tags Key=purpose,Value=restore-drill Key=source,Value="$SOURCE_DB" >/dev/null
echo "Restore started. Waiting for it to become available (this is the number to quote)..."
aws rds wait db-instance-available --region "$REGION" --db-instance-identifier "$TARGET"
SECONDS_TAKEN=$(( $(date +%s) - START ))
ENDPOINT="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$TARGET" --query 'DBInstances[0].Endpoint.Address' --output text)"

echo
echo "RESTORE DRILL RESULT"
echo "  snapshot        : $SNAPSHOT"
echo "  time to usable  : ${SECONDS_TAKEN} seconds"
echo "  drill endpoint  : $ENDPOINT"
echo
echo "Now, from the app host (the database is private), compare a few row counts with production, for example:"
echo "  psql \"host=$ENDPOINT dbname=knest user=<migration user> sslmode=verify-full\" -c 'select count(*) from app.users; select count(*) from app.applications;'"
echo
echo "Then record the result in docs/delivery/RESTORE-DRILL.md and remove the drill instance. The operator policy cannot delete,"
echo "so the account owner runs:"
echo "  aws rds modify-db-instance --region $REGION --db-instance-identifier $TARGET --no-deletion-protection --apply-immediately"
echo "  aws rds delete-db-instance --region $REGION --db-instance-identifier $TARGET --skip-final-snapshot --delete-automated-backups"
