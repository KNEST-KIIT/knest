# 04. Documents and object storage

Module: `src/server/storage/` (`index.ts`, `s3-config.ts`, `reconcile.ts`, `reconcile-worker.ts`), `src/server/security/file-verify.ts`, and the call sites in `src/server/applications/actions.ts` and the staff download route.

## 1. What is stored where

| Thing | Where | Key shape |
|---|---|---|
| Application document bytes | Object store (S3) in production; `uploads/` under the working directory in development | `YYYY-MM-DD/<32 hex chars>[.ext]` |
| Application document metadata | `app.application_documents` | one row per (application, question) |
| CMS media | Same S3 bucket, prefix `media/`, managed by Payload's `s3Storage` plugin | `media/...` |

The CMS media and the application documents share one bucket (`src/payload/payload.config.ts:85-95`). The disjoint key shapes are what keep reconciliation from touching media (section 5).

## 2. Backend selection and the storage API

`src/server/storage/index.ts`. A single module hides the backend from callers (`:6-16`).

Selection is made once at module load: `s3Configured = Boolean(process.env.S3_BUCKET)` (`:20`). Credentials are optional; with none set the AWS SDK default chain is used, which on AWS finds the instance role so no long-lived key is stored (`:18-19`, `s3-config.ts:3-11`). Consequence: changing `S3_BUCKET` requires a process restart, and a process started without it will use local disk for its lifetime.

| Function | Signature | S3 mode | Local mode |
|---|---|---|---|
| `generateStorageKey` (`:28-34`) | `(originalName: string) => string` | same | same |
| `putFile` (`:36-53`) | `(key, buffer) => Promise<void>` | `PutObject` | refuses with an error when `NODE_ENV === 'production'` (`:46-48`), otherwise `mkdir -p` and `writeFile` under `uploads/` |
| `getFile` (`:55-68`) | `(key) => Promise<Buffer>` | `GetObject`, whole body to a byte array; throws on empty body (`:63`) | `readFile` |
| `deleteFile` (`:70-79`) | `(key) => Promise<void>` | `DeleteObject` | `rm -f` |
| `listFiles` (`:84-100`) | `(prefix = '') => Promise<StoredObject[]>` | `ListObjectsV2`, paginated by continuation token | returns `[]`: "local development has nothing to reconcile" (`:83-85`) |

Why local production is refused: an ephemeral container filesystem would silently lose uploads, so the module fails loudly instead (`:12-15`). Additionally the production environment check requires `S3_BUCKET` and `S3_REGION` at boot (`src/server/env.ts:32-33`), and refuses one of the two key halves without the other (`env.ts:80-82`).

The S3 client is created per call (`s3Client()`, `:23-26`), with a dynamic import of `@aws-sdk/client-s3`. There is no client reuse and no explicit timeout or retry configuration in this file; SDK defaults apply. Not determined from the code what those defaults give in this deployment.

`getFile` loads the full object into memory, and the staff route sends it as one response body. The ceiling is therefore the 10 MiB upload limit, which is acceptable at that size.

## 3. Key generation

`generateStorageKey` (`index.ts:28-34`):

- Prefix is the current UTC date (`toISOString().slice(0,10)`), then 16 random bytes in hex (`randomBytes(16)`, 128 bits).
- The only part of the client's file name that can reach the key is an extension, and only when it matches `^\.[a-z0-9]{1,8}$` after lower-casing. Anything else is dropped (test `storage-key.test.ts:11-15`: `a.p/df`, backslashes, 30 chars, spaces, `<svg>`, no extension).

Why: the key becomes an S3 key and a local path. Restricting it to a date, hex and a short alphanumeric extension removes path traversal and header injection from this value by construction. The user's original name is kept separately in `file_name` for display and the `Content-Disposition` filename (file 03).

The key carries no applicant or application identifier, so an object cannot be traced to its owner without the database row. That is intentional but it also means orphans (section 5) cannot be attributed from the bucket alone.

## 4. Upload content verification

`verifyFileContents(buffer, declaredMimeType)` (`src/server/security/file-verify.ts:25-35`): the declared type must be a key of `ACCEPTED_SNIFFED_MIME_TYPES`; `fileTypeFromBuffer` must find a signature; the sniffed MIME must be in the list for that declared type.

| Declared | Accepted sniffed type |
|---|---|
| `application/pdf` | `application/pdf` |
| `application/msword` | `application/x-cfb` |
| `application/vnd.ms-powerpoint` | `application/x-cfb` |
| DOCX MIME | the DOCX MIME |
| PPTX MIME | the PPTX MIME |

Limits to be aware of:

- Magic-number sniffing only. A file that starts with a valid signature and carries arbitrary content after it passes. No parsing, macro stripping or malware scanning exists in the modules read.
- CFB (legacy Office container) is the sniffed type for `.doc`, `.ppt`, and other legacy formats. A `.xls` or an installer in a CFB container declared as `application/msword` is accepted (`file-verify.ts:8-11`).
- OOXML detection relies on the library recognising the `[Content_Types].xml` structure; its behaviour with deliberately crafted archives is not determined from this code.
- Mitigations downstream: documents are served only to staff, always as `attachment` with `nosniff` and the stored (allow-listed) content type (`documents/[questionId]/route.ts:50-61`), so they are not rendered in the site origin.

## 5. Orphan reconciliation

### Why it exists

Uploads write the object first and the row second, and the replaced object is deleted afterwards on a best-effort basis (`actions.ts:190-221`). A crash or failed delete in between leaves an object no row references. `reconcile.ts:5-17` compares the bucket to the table and removes such objects once they are old enough that no upload can still be in flight.

### The plan: `planReconciliation` (pure, `reconcile.ts:154-174`)

Inputs: object listing, the set of known keys from the table, `now`, optional `graceMs`.

1. Only keys matching `DOCUMENT_KEY = /^\d{4}-\d{2}-\d{2}\/[0-9a-f]{32}(\.[A-Za-z0-9]{1,9})?$/` are considered (`:19,40`). CMS media (`media/...`) and anything else in the bucket is ignored (test `reconcile.test.ts:28-37`). The regex allows extensions of up to nine characters while the generator emits at most eight; this is a superset, harmless.
2. An object is an **orphan** when its key is not in `knownKeys` and `now - lastModified >= GRACE_MS` (48 hours, `:142`). The grace period guarantees an in-flight upload (object written, row not yet committed) is not removed.
3. `missing` lists keys that rows reference but that are not in the bucket. They are reported, never repaired (`:26-27`).
4. **Refusal guards** (`:47-50`): if more than 10 documents are in the bucket and the table lists none, or if there are at least 20 documents and more than half are orphans, `plan.refused` is set and nothing may be removed. Reason: either of those patterns means the job is looking at a different database than the one the objects belong to (wrong environment, restored snapshot, empty replica), and deleting on that evidence would destroy applicant files.

### The run: `reconcileDocuments` (`reconcile.ts:56-76`)

- `apply: false` by default; `now` injectable.
- Lists the bucket and selects every `storage_key` from `application_documents`. Both are read in memory in full (`:57-60`), so memory grows with object count; not an issue at current volumes, a limit to note if the bucket grows into the hundreds of thousands.
- When `apply` and not refused: at most `MAX_REMOVALS = 200` orphans per run (`:21,64`). For each, re-query the table for that key immediately before deleting (`:66-67`): an upload may have recorded it since the listing. Skip if found, else `deleteFile` and count.
- Always logs one line: `storage_reconcile considered=N orphans=N missing=N removed=N applied=bool [refused="..."]` (`:72-74`).
- Returns `{ ...plan, removed, applied }`.

Safety properties: idempotent (deleting an absent key is a no-op in S3 and `rm -f` locally); capped per run; grace period; re-check before delete; refusal guards; production buckets are versioned, so a removal leaves a recoverable delete marker (`reconcile.ts:16-17`; the bucket setting itself is infrastructure and not verified here).

The check at `:66` and the delete at `:68` are not atomic. What makes the window safe in practice is the 48 hour grace period: a key is generated fresh for each upload and written to the row within one request, so an object already older than 48 hours is not one a live upload will still commit. The re-check is an additional guard for a row recorded after the listing was taken.

### The worker: `startReconcileWorker` (`reconcile-worker.ts:12-22`)

- Does nothing if already started, if `S3_BUCKET` is unset, or if `STORAGE_RECONCILE === 'off'` (`:13`).
- First pass 5 minutes after start, then every 24 hours (`:19-20`); both timers are `unref`'d so they do not hold the process open.
- Applies deletions only when `STORAGE_RECONCILE === 'apply'`; any other value (including unset) runs a dry run (`:15`).
- Errors are caught and logged as `storage_reconcile_failed <message>` (`:16-18`).
- Registered from `src/instrumentation.ts:17-19`, which runs it only for a production Node.js process that is not a build or a preview deployment (`instrumentation.ts:2-5`, `src/server/env.ts:105-110`).

Operational consequences:

- It runs inside every web process. With more than one instance, each would run it; the comment accepts this because deletes are idempotent (`reconcile-worker.ts:3-6`). The refusal guards and re-check make concurrent runs safe, but they do multiply listing cost.
- It is a `setInterval` in the web process. On a platform that freezes or recycles processes between requests it will not run reliably. Not determined from the code whether the Vercel deployment (`next.config.ts:61` selects `standalone` output only off Vercel) keeps a process alive long enough; the container deployment does.
- Deployment must flip `STORAGE_RECONCILE=apply` deliberately after reading the dry-run counts. Nothing in the code enables deletion by default.

## 6. Configuration

| Variable | Read in | Meaning |
|---|---|---|
| `S3_BUCKET` | `index.ts:20`, `reconcile-worker.ts:13`, `payload.config.ts:90-92`, `env.ts:32` | Turns S3 on |
| `S3_REGION` | `s3-config.ts:17`, `env.ts:33` | Region |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `s3-config.ts:13-14`, `env.ts:34-35,80-82` | Both or neither; neither means the SDK default chain |
| `S3_ENDPOINT` | `s3-config.ts:15,19` | S3-compatible endpoint with path-style addressing; used by the test suite's local stub |
| `STORAGE_RECONCILE` | `reconcile-worker.ts:13,15` | `off` disables; `apply` enables deletion; anything else dry-runs |
| `NODE_ENV` | `index.ts:46` | Production refuses local disk |

## 7. Tests

| File | What it proves |
|---|---|
| `src/server/storage/storage-key.test.ts` | Key shape, extension sanitising |
| `src/server/storage/reconcile.test.ts` | Plan: grace, foreign keys ignored, missing reported, both refusal guards |
| `tests/integration/41-storage-reconcile.test.ts:34,43` | Against a real listing and delete: dry run removes nothing; apply removes the old orphan, keeps a young one and CMS media |
| `tests/integration/27-document-upload.test.ts` | Replace removes the old object after commit; real bytes round trip; spoofed bytes refused and nothing stored; 10 MB accepted; over 10 MB refused; ownership and submission checks |

Not covered by an automated test in the files read: the `MAX_REMOVALS` cap, the pre-delete row re-check, and the worker's scheduling.

## 8. Known limitations

- No antivirus or content scanning.
- No per-applicant storage quota beyond the upload rate limit (20 per hour) and one document per question.
- A row whose object is missing surfaces as a 500 on staff download (no handling in the route) and as `missing=` in the nightly log line; nothing repairs it.
- The first dry-run output is only in the process log; there is no admin screen for reconciliation results.
- No object-level encryption options (SSE) are passed in `PutObjectCommand` (`index.ts:40-42`); whatever the bucket default is applies. Not determined from the code what that is.
