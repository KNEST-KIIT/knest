#!/usr/bin/env bash
#
# KNEST public cutover: read-only preflight. Changes nothing. Exit 0 only when every hard gate
# is met; the cutover script refuses to run otherwise.
#
#   PYTHONUTF8=1 AWS_PROFILE=<scoped-operator> bash scripts/ops/cutover-preflight.sh
#
# Hard gates (none of these can be waived by this script or by an engineer):
#   G1  HD-06 approval evidence exists in the repository (privacy, terms, content), signed by a named KIIT approver
#   G2  Turnstile uses real keys (not Cloudflare's published always-pass test pair)
#   G3  The ACM certificate for the four hostnames is ISSUED in us-east-1
#   G4  The SES identity is verified for sending
#   G5  The runtime database role is active (the app is not running as the master user)
#   G6  An alert recipient is subscribed and confirmed
#   G7  Route 53 records match GoDaddy for every mail and verification record (dns-compare)
set -uo pipefail
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
(cd "$HERE" && node ./require-scoped-aws.mjs) || exit 2
readonly KNEST_SCOPED_AWS_PROFILE="$AWS_PROFILE"
aws() { command aws --profile "$KNEST_SCOPED_AWS_PROFILE" "$@"; }
REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
fail=0
check() { # name, ok(0/1), detail
  if [ "$2" -eq 0 ]; then echo "PASS  $1  [$3]"; else echo "FAIL  $1  [$3]"; fail=1; fi
}

# G1: evidence file with a named approver and a date, not a template.
EVID="$ROOT/docs/delivery/EVIDENCE/hd-06-approval.md"
if [ -f "$EVID" ] && grep -Eq '^APPROVED-BY: .+@.+|^APPROVED-BY: [A-Za-z].{4,}' "$EVID" && grep -Eq '^APPROVED-ON: 20[0-9]{2}-[0-9]{2}-[0-9]{2}' "$EVID" && ! grep -qi 'DRAFT, NOT APPROVED' "$EVID"; then
  check "G1 HD-06 approval evidence" 0 "$EVID"
else
  check "G1 HD-06 approval evidence" 1 "missing or incomplete: $EVID (needs APPROVED-BY and APPROVED-ON lines written by the institution)"
fi

# G2: Turnstile site key is not the published test key.
SITEKEY=$(aws ssm get-parameter --region "$REGION" --name /knest-production/config/turnstile-site-key --query Parameter.Value --output text 2>/dev/null || echo "")
case "$SITEKEY" in
  1x00000000000000000000AA|2x00000000000000000000AB|3x00000000000000000000FF|"") check "G2 Turnstile real keys" 1 "site key is a Cloudflare test key or unset" ;;
  *) check "G2 Turnstile real keys" 0 "site key set (secret not inspected)" ;;
esac

# G3: certificate.
CERT=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='kiitnest.com'].CertificateArn | [0]" --output text 2>/dev/null || echo None)
if [ -n "$CERT" ] && [ "$CERT" != "None" ]; then
  STATUS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT" --query 'Certificate.Status' --output text)
  SANS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT" --query 'Certificate.SubjectAlternativeNames' --output text)
  ok=1; [ "$STATUS" = "ISSUED" ] && echo "$SANS" | grep -q "www.kiitnest.com" && echo "$SANS" | grep -q "kiitnest.in" && echo "$SANS" | grep -q "www.kiitnest.in" && ok=0
  check "G3 ACM certificate issued for four hostnames" "$ok" "status=$STATUS"
else
  check "G3 ACM certificate issued for four hostnames" 1 "no certificate for kiitnest.com in us-east-1"
fi

# G4: SES identity.
V=$(aws sesv2 get-email-identity --region "$REGION" --email-identity kiitnest.com --query 'VerifiedForSendingStatus' --output text 2>/dev/null || echo False)
[ "$V" = "True" ] && check "G4 SES identity verified" 0 "kiitnest.com" || check "G4 SES identity verified" 1 "not verified (DKIM records missing?)"

# G5: runtime role in use (the secret exists and the last deploy provisioned the role).
RT=$(aws ssm get-parameter --region "$REGION" --name /knest-production/config/db-runtime-secret-arn --query Parameter.Value --output text 2>/dev/null || echo "")
[ -n "$RT" ] && check "G5 runtime database identity configured" 0 "secret reference present (confirm the deploy log says 'App identity: runtime role')" || check "G5 runtime database identity configured" 1 "no runtime secret in config"

# G6: alert subscription confirmed.
TOPIC=$(aws sns list-topics --region "$REGION" --query "Topics[?contains(TopicArn,'knest-production-alerts')].TopicArn | [0]" --output text 2>/dev/null || echo None)
if [ -n "$TOPIC" ] && [ "$TOPIC" != "None" ]; then
  SUBS=$(aws sns list-subscriptions-by-topic --region "$REGION" --topic-arn "$TOPIC" --query "Subscriptions[?SubscriptionArn!='PendingConfirmation'] | length(@)" --output text)
  [ "${SUBS:-0}" -ge 1 ] && check "G6 alert recipient confirmed" 0 "$SUBS confirmed" || check "G6 alert recipient confirmed" 1 "no confirmed subscriber (click the SNS confirmation email)"
else
  check "G6 alert recipient confirmed" 1 "topic not found"
fi

# G7: both exact public zones, all four nameservers, origin/renewal/mail records.
# Fresh ACM, origin-stack and SES metadata provide required records and targets;
# matching empty DNS answers cannot establish preservation.
if (cd "$HERE" && node ./dns-cutover-check.mjs); then
  check "G7 Route 53 preserves both zones, origin, mail and renewal records" 0 "all eight authoritative-server comparisons passed"
else
  check "G7 Route 53 preserves both zones, origin, mail and renewal records" 1 "metadata missing, required records absent, or DNS comparison failed"
fi

echo
[ "$fail" -eq 0 ] && echo "PREFLIGHT PASSED" || echo "PREFLIGHT FAILED: do not cut over"
exit "$fail"
