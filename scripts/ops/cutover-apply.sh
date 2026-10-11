#!/usr/bin/env bash
#
# KNEST public cutover, in two stages. Neither stage runs unless the read-only preflight passes
# (HD-06 approval evidence, real Turnstile keys, issued certificate, verified SES identity, ...).
#
#   Stage ALIASES  (safe before DNS moves; the preview gate stays on, nothing becomes public):
#       bash scripts/ops/cutover-apply.sh aliases
#   Stage PUBLIC   (the cutover: site URL, indexing, DNS records, gate removal):
#       bash scripts/ops/cutover-apply.sh public
#
# Between ALIASES and PUBLIC the account owner changes the nameservers at GoDaddy (needs the
# owner's emailed one-time code). That step is manual and is the only point of no easy return;
# see docs/delivery/CUTOVER-RUNBOOK.md for the rollback of each step.
set -euo pipefail
export MSYS_NO_PATHCONV=1 PYTHONUTF8=1
HERE="$(cd "$(dirname "$0")" && pwd)"
STAGE="${1:-}"
CERT_ARN="$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='kiitnest.com'].CertificateArn | [0]" --output text)"

bash "$HERE/cutover-preflight.sh" || { echo "Refusing to continue: preflight failed." >&2; exit 1; }

prev_params() { # stack region, then the keys to override are skipped by the caller
  aws cloudformation describe-stacks --stack-name "$1" --region "$2" --query 'Stacks[0].Parameters[].ParameterKey' --output text | tr '\t' '\n'
}

changeset() { # stack region name template-args...  then params via env PARAMS
  local stack="$1" region="$2" name="$3"; shift 3
  aws cloudformation create-change-set --stack-name "$stack" --region "$region" --change-set-name "$name" "$@" >/dev/null
  aws cloudformation wait change-set-create-complete --stack-name "$stack" --region "$region" --change-set-name "$name"
  echo "--- change set $name on $stack:"
  aws cloudformation describe-change-set --stack-name "$stack" --region "$region" --change-set-name "$name" \
    --query 'Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]' --output text
  aws cloudformation execute-change-set --stack-name "$stack" --region "$region" --change-set-name "$name"
  aws cloudformation wait stack-update-complete --stack-name "$stack" --region "$region"
}

case "$STAGE" in
  aliases)
    # Attach the certificate and the four aliases to the distribution. The access gate stays.
    OVERRIDE="Aliases AcmCertificateArn"
    P=$(prev_params knest-production-edge us-east-1 | grep -vxE 'Aliases|AcmCertificateArn' | awk '{printf "ParameterKey=%s,UsePreviousValue=true ",$1}')
    changeset knest-production-edge us-east-1 "aliases-$(date +%s)" --use-previous-template \
      --parameters $P "ParameterKey=Aliases,ParameterValue=kiitnest.com\,www.kiitnest.com\,kiitnest.in\,www.kiitnest.in" "ParameterKey=AcmCertificateArn,ParameterValue=$CERT_ARN"
    echo "Aliases attached. Public DNS is unchanged; the site is still gated."
    ;;
  public)
    DIST_DOMAIN="$(aws cloudformation describe-stacks --stack-name knest-production-edge --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue | [0]" --output text)"
    echo "1/4 application: SiteUrl=https://kiitnest.com, SiteIndexing=on"
    P=$(prev_params knest-production-app ap-south-1 | grep -vxE 'SiteUrl|SiteIndexing' | awk '{printf "ParameterKey=%s,UsePreviousValue=true ",$1}')
    changeset knest-production-app ap-south-1 "public-$(date +%s)" --use-previous-template --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM \
      --parameters $P ParameterKey=SiteUrl,ParameterValue=https://kiitnest.com ParameterKey=SiteIndexing,ParameterValue=on
    echo "    redeploy the running container so it reads the new settings: see OPERATOR-COMMANDS.md item 'redeploy'."
    echo "2/4 Route 53 web records (inert until GoDaddy nameservers are changed)"
    P=$(prev_params knest-production-dns us-east-1 2>/dev/null | grep -vx 'CloudFrontDomainName' | awk '{printf "ParameterKey=%s,UsePreviousValue=true ",$1}')
    changeset knest-production-dns us-east-1 "web-$(date +%s)" --use-previous-template \
      --parameters $P "ParameterKey=CloudFrontDomainName,ParameterValue=$DIST_DOMAIN"
    echo "3/4 MANUAL: owner changes the nameservers at GoDaddy to the four Route 53 values for kiitnest.com, then kiitnest.in."
    echo "    Wait until 'nslookup -type=MX kiitnest.com 8.8.8.8' and 1.1.1.1 answer from Route 53 and test mail flows both ways."
    read -r -p "Type YES when DNS has moved and mail was tested, to remove the preview gate: " ANSWER
    [ "$ANSWER" = "YES" ] || { echo "Gate left in place."; exit 0; }
    echo "4/4 removing the preview gate"
    P=$(prev_params knest-production-edge us-east-1 | grep -vx 'AccessHash' | awk '{printf "ParameterKey=%s,UsePreviousValue=true ",$1}')
    changeset knest-production-edge us-east-1 "ungate-$(date +%s)" --use-previous-template --parameters $P "ParameterKey=AccessHash,ParameterValue="
    echo "Public. Verify with: node scripts/verify-production.mjs --url https://kiitnest.com --alt www.kiitnest.com,kiitnest.in,www.kiitnest.in --waf"
    ;;
  *)
    echo "usage: $0 aliases|public" >&2
    exit 2
    ;;
esac
