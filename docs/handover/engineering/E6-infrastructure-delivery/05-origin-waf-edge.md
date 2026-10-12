# E6.05 `origin.yaml`, `waf.yaml`, `edge.yaml`

Sources: `infra/cfn/origin.yaml` (129 lines), `infra/cfn/waf.yaml` (108), `infra/cfn/edge.yaml` (269). Status in all three headers ("not deployed") is stale; the stacks exist (`V1-DEPLOYMENT-REPORT.md:39`). Behaviour under real traffic has been observed only through the preview checks listed in `V1-DEPLOYMENT-REPORT.md:21-26`.

## 1. `origin.yaml`: the production HTTPS boundary

### Parameters (`origin.yaml:9-25`)

| Parameter | Constraint | Purpose |
|---|---|---|
| `VpcId`, `PublicSubnetAId`, `PublicSubnetBId`, `AppInstanceId`, `AppSecurityGroupId` | typed AWS IDs | Outputs of `app.yaml`. |
| `AppPort` | 1024-65535, default 3000 | Must equal `app.yaml` `AppPort`. Nothing enforces equality across stacks. |
| `CloudFrontPrefixListId` | `^pl-[0-9a-f]+$` | Managed list `com.amazonaws.global.cloudfront.origin-facing`. |
| `OriginDomainName` | hostname pattern, default `origin.kiitnest.com` | The name on the ACM certificate and the CNAME target; CloudFront connects to this name. |
| `AlertTopicArn` | `arn:aws:sns:ap-south-1:<12 digits>:...` | Alarm action. Region is hardcoded to ap-south-1 in the pattern. |

Rule `DifferentSubnets` (`:27-31`) asserts the two subnet IDs differ. It cannot check the AZs differ; that relies on `app.yaml`.

### Resources

- `Certificate` (`:34-38`): regional ACM certificate for `OriginDomainName`, DNS validation. The stack stays `CREATE_IN_PROGRESS` until the validation CNAME exists at the DNS provider (`:6-7`). Failure mode: if the CNAME is never added, CloudFormation waits until its own timeout, then rolls back. During the first deployment the CNAME was added at GoDaddy (`V1-DEPLOYMENT-REPORT.md:19`).
- `OriginSecurityGroup` (`:40-48`): ingress 443 from the CloudFront prefix list only; egress replaced by `127.0.0.1/32` (nothing).
- `OriginToApp` (`:50-57`) egress to the app group on `AppPort`; `AppFromOrigin` (`:59-66`) the matching ingress on the app group. These two standalone rules avoid circular references between stacks and groups. This is the only inbound path to the instance in production.
- `LoadBalancer` (`:68-76`): internet-facing application LB across both public subnets, `routing.http.drop_invalid_header_fields` on. Security group is the CloudFront-only group, so a direct request to the ALB's DNS name times out; `V1-DEPLOYMENT-REPORT.md:25` reports the ALB hostname not reachable directly.
- `TargetGroup` (`:78-92`): HTTP to the instance on `AppPort`, instance target, health check `GET /api/health` expecting 200, healthy and unhealthy thresholds 2, deregistration delay 60 s. Health checks do not carry `X-Origin-Verify`; the application exempts `/api/health` from the origin check for this reason (`src/server/security/edge-guard.ts:29-30,65-71`).
- `Listener` (`:94-102`): HTTPS 443, policy `ELBSecurityPolicy-TLS13-1-2-2021-06`, forward to the target group. No port 80 listener exists, so plain HTTP to the ALB is refused by the security group anyway.
- `HealthyTargetsAlarm` (`:104-119`): see `03-...md` section 4.

### Why it is shaped this way

CloudFront validates the origin certificate against the origin host name, and an EC2 public DNS name cannot get a public certificate (`AWS-PRODUCTION-BUDGET.md:61-63`). An ALB with an ACM certificate on a name the project owns removes the problem. Cost: about USD 18-25 per month (`:59`). TLS stops at the ALB; the ALB-to-instance hop is plain HTTP inside the VPC.

### Limits and failure modes

- Single instance target: the ALB gives no redundancy. During a deploy the container is removed (`app.yaml:633`), so the target is unhealthy and CloudFront returns 502/503/504 for the outage.
- The certificate renews automatically only while its validation CNAME remains in DNS. The CNAME lives at GoDaddy and is not part of `dns.yaml` (`dns.yaml` models only the `AcmCom*`/`AcmIn*` records of the cert stack, not the origin certificate's record). After the nameserver move, `origin.kiitnest.com` and its validation record must exist in Route 53, or the origin certificate will not renew and the ALB listener will eventually serve an expired certificate, which CloudFront rejects. This is a design gap (D-08).
- The `X-Origin-Verify` check is in the application, not in the ALB. A request that reaches the ALB with a valid CloudFront source (any CloudFront customer's distribution shares the prefix list) is refused by the app with 403 unless it carries the secret.

## 2. `waf.yaml`: web ACL

Deployed in us-east-1 (CLOUDFRONT scope exists only there). Parameters: `Environment`, `AuthRateLimit` (default 100 per 5 minutes per IP to `/api/auth/*`, minimum 10), `GlobalRateLimit` (default 2000, minimum 10) (`waf.yaml:10-22`).

`DefaultAction: Allow`. Rules (`waf.yaml:36-104`, priorities 10-50):

| Priority | Rule | Action | Detail |
|---|---|---|---|
| 10 | `AWSManagedRulesCommonRuleSet` | rule group actions, `OverrideAction: None` | `SizeRestrictions_BODY` overridden to Count, because application documents are multipart bodies up to 10 MB and the managed rule would block them; the app limits and inspects uploads itself (`src/server/applications/actions.ts` per the comment). The effect is that WAF never blocks large bodies; the app's 10 MB limit (`27-document-upload.test.ts:156`) is the only bound. |
| 20 | `AWSManagedRulesKnownBadInputsRuleSet` | as group | |
| 30 | `AWSManagedRulesAmazonIpReputationList` | as group | |
| 40 | `RateLimitAuth` | Block | Rate-based on IP, scope-down `UriPath STARTS_WITH /api/auth/` after LOWERCASE. Limit `AuthRateLimit` per 5 minutes. |
| 50 | `RateLimitGlobal` | Block | Rate-based on IP, all requests, `GlobalRateLimit`. |

No CAPTCHA, Bot Control or fraud-control groups (owner decision ARCH-2); `templates.test.ts:200-212` asserts exactly five rules and absence of those names. Five rules plus one ACL is USD 10 per month (`AWS-PRODUCTION-BUDGET.md:19-20`).

Failure modes and caveats:

- **Shared IP.** Rate limits key on the connecting IP seen by CloudFront. A campus NAT makes many students one IP: 100 auth requests per 5 minutes and 2000 requests per 5 minutes for everyone behind it. Not measured; `load-test.mjs` explicitly says it cannot test per-address limits (`LOAD-TEST.md:56-60`).
- **Auth path scope.** `/api/auth/` covers the application's password login and signup, which live under `/api/auth/password/*` (`verify-core.mjs:116`). Other sensitive paths (application submission, enquiries) fall under the global limit only; app-level limits cover them (`RUNBOOK.md:349`, gap 13: not all routes have limits).
- **Managed rule false positives.** Common rule set can block legitimate rich-text posted through the CMS admin. No exclusions are configured except body size. Not observed.
- **Count mode metrics.** All five rules have CloudWatch metrics and sampled requests on, but no alarm consumes them.
- **No logging configuration** (no `AWS::WAFv2::LoggingConfiguration`). Blocked requests are visible only as sampled requests in the console.
- Output `WebAclArn` is passed as a plain string to `edge.yaml`, pattern-checked for us-east-1 (`edge.yaml:42-46`).

## 3. `edge.yaml`: CloudFront, function, policies

### Parameters (`edge.yaml:10-66`)

| Parameter | Constraint | Notes |
|---|---|---|
| `Environment` | s1/production | |
| `OriginDomainName` | hostname, no scheme/port/path | |
| `OriginPort` | 1-65535, default 443 | Production rule forces 443. |
| `OriginProtocol` | `http-only`/`https-only`, default `https-only` | `http-only` is S-1 only. |
| `OriginVerifySecretId` | `^[A-Za-z0-9/_+=.@-]{1,512}$` | Interpolated into a dynamic reference; the pattern excludes `:` and `}` so a value cannot rewrite the reference (`:39`). |
| `WebAclArn` | `^arn:aws:wafv2:us-east-1:...:global/webacl/...` | |
| `AccessHash` | `NoEcho`, `^([0-9a-f]{64})?$`, default empty | Empty = public site. Interpolated into JavaScript, hence the strict hex pattern (`:51-52`). |
| `AcmCertificateArn` | empty or us-east-1 ACM ARN | Empty uses the default `*.cloudfront.net` certificate. |
| `Aliases` | CommaDelimitedList, default `''` | |

### Rules and conditions (`:68-85`)

- `ProductionOriginUsesTls`: in production, protocol must be `https-only` and port `'443'`.
- `AliasesNeedACertificate`: if `Aliases` does not contain the empty string (so aliases were supplied), the certificate ARN must be non-empty.
- Conditions `HasCertificate`, `HasAliases`.

### Viewer-request function (`:88-172`)

CloudFront Function, runtime `cloudfront-js-2.0`, `AutoPublish: true`. Logic:

1. Lower-case the Host header, strip the port. If the host is `www.kiitnest.com`, `kiitnest.in` or `www.kiitnest.in`, return **301** to `https://kiitnest.com` + URI + rebuilt query string, `cache-control: public, max-age=3600` (`:151-160`). Failure mode: the 301 is cacheable for an hour in browsers; a wrong redirect cannot be corrected quickly.
2. If `ACCESS_HASH` is non-empty: require `Authorization: Basic ...`; decode, SHA-256 hex of the decoded `user:password`, compare to the hash; mismatch gives 401 with `WWW-Authenticate: Basic realm="KNEST (restricted)"` and `cache-control: no-store`. On success the Authorization header is deleted so the origin never sees it (`:162-169`).
3. Otherwise pass the request through.

Observations:

- The hash is an unsalted SHA-256 of a low-entropy string and is visible to anyone who can call `cloudfront:GetFunction` (the operator policy grants `cloudfront:Get*`, `operator-policy.json:70`). Gate strength equals password strength. WAF's global rate rule is the only throttle on guessing (2000 per 5 minutes per IP).
- The same function is attached to the `/_next/static/*` behaviour (`:257-259`), so static assets are gated too.
- `infra/edge/viewer-request.test.ts` runs the function logic and `templates.test.ts:192-197` asserts the file `infra/edge/viewer-request.js` equals the inline copy apart from the hash placeholder. The function cannot be unit-tested for CloudFront's real event shape; querystring handling follows the documented structure only.
- The gate is the "private-first" control: preview traffic is `401` without credentials (`V1-DEPLOYMENT-REPORT.md:23`).

### Policies and distribution (`:174-262`)

- `SecurityHeaders` response-headers policy: HSTS only, one year, no subdomains, no preload, `Override: true`. CSP and the rest are set by the application (`:179`); `29-edge-controls.test.ts:83-100` asserts them at the origin.
- `StaticAssetsCachePolicy`: TTL 0/86400/31536000, gzip and brotli in key, no cookies, headers or query strings in the key.
- `Distribution`: HTTP/2 and HTTP/3, IPv6, `PriceClass_All`, WAF attached, aliases and certificate conditional (`sni-only`, TLS 1.2 2021).
  - Origin `app`: custom header `X-Origin-Verify` from `{{resolve:secretsmanager:<id>:SecretString}}` (`:223-225`), TLS 1.2 only to origin, `OriginReadTimeout: 60`.
  - Default behaviour: redirect to HTTPS, all methods, **CachingDisabled** managed policy `4135ea2d-...`, origin request policy `AllViewerAndCloudFrontHeaders-2022-06` (`33f36d7e-...`) forwarding cookies, headers (Host, `CloudFront-Viewer-Address`, used for the client IP) and query strings, response-headers policy, viewer-request function.
  - One extra behaviour: `/_next/static/*`, GET/HEAD, the static cache policy.
- Outputs: `DistributionId`, `DistributionDomainName` (used by `dns.yaml` and `cutover-apply.sh:47`).

### Why caching is off for everything dynamic

Nothing session-specific may be stored by a shared cache; the application also sends `Cache-Control: private, no-store` on private paths and an integration test asserts it (`AWS-NATIVE-ARCHITECTURE.md:27` and `29-edge-controls.test.ts:22-42`). `verify-production.mjs` re-checks it on the live distribution (file 12).

### Failure modes

| Symptom | Cause | Where to look |
|---|---|---|
| Every page 403 | `X-Origin-Verify` differs from the app's `ORIGIN_VERIFY_SECRET` (secret regenerated, replica stale, edge not redeployed) | file 15, `RUNBOOK.md:284` |
| Stack create fails on dynamic reference | secret does not exist in the stack's region | file 15 |
| 502 from CloudFront | ALB certificate expired or ALB has no healthy target | `origin.yaml` |
| Sign-in forms fail with 403 only on a host name | `SITE_URL` does not match the browser's origin | `edge-guard.ts:73-80`, `V1-DEPLOYMENT-REPORT.md:49` |
| Stack update fails with "alias already used" | alias attached to another distribution | not determined from the code |
