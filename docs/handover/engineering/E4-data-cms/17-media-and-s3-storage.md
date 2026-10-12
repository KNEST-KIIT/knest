# E4.17 Media collection and S3 storage

Files: `src/payload/collections/media.ts`, the `s3Storage` plugin block in
`src/payload/payload.config.ts:85-95`, `src/server/storage/s3-config.ts`,
`src/server/storage/index.ts`, `src/server/storage/reconcile.ts`.

There are two distinct stores that share one bucket and one client configuration:

| Store | Written by | Key shape | DB record | Public? |
|---|---|---|---|---|
| CMS media | Payload upload via the S3 plugin | `media/<filename>` (prefix `media`), plus resized variants | `cms.media` row | yes, same-origin file URLs; `read: () => true` |
| Application documents | `putFile` in `src/server/storage/index.ts` | `<YYYY-MM-DD>/<32 hex>.<ext>` (`generateStorageKey`, lines 28-34), no prefix | `app.application_documents.storage_key` | no; only through a staff-only download route that writes an audit row |

## 1. Media collection (`media.ts`)

| Item | Value |
|---|---|
| Slug / table | `media` / `cms.media` (no versions) |
| Read | `() => true` (public) |
| Create, update, delete | `canWrite('content')` (content_admin, super_admin). Comment (lines 8-9): NF-03 / KN-22j, media is served same-origin to every visitor, so only the role that owns site content may change it; previously any staff role could |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/avif` (line 20). Explicit allow-list: "anything not named here cannot be uploaded, so a new dangerous type is safe by default" |
| Excluded on purpose | SVG and XML (can carry script, served same-origin; Payload advisories GHSA-2pwp-2369-8fg3, GHSA-9qpg-3cf8-w33x cited in the comment). Tested: an SVG with `<script>` is refused (`tests/integration/20-roles-and-media.test.ts:98-110`) |
| Image sizes | `thumbnail` 400x300, `card` 800x600, `hero` 1920x1080, all `position: 'centre'` (21-25); produced by `sharp` (`payload.config.ts:98`) |
| Admin thumbnail | `thumbnail` |
| Focal point | enabled (`focal_x`, `focal_y` columns) |
| Fields | `alt` (text, **required**; "write decorative" for decorative images), `credit` (text) |

Table columns (baseline lines 866-899): `id serial`, `alt varchar NOT NULL`, `credit`, `url`,
`thumbnail_u_r_l`, `filename` (unique index), `mime_type`, `filesize`, `width`, `height`, `focal_x`,
`focal_y`, and six columns per size variant (`sizes_<name>_url|width|height|mime_type|filesize|filename`),
plus `prefix varchar DEFAULT 'media'` and `_objectkey varchar` from migration
`20261009_073957_media_s3_prefix`.

Properties:

- `filename` is unique, so two uploads of the same file name conflict; Payload's default is to
  rename on collision (library behaviour; not determined from this repo).
- The mime allow-list is checked by Payload from the declared and sniffed type; file-content
  verification of application uploads is separate (`src/server/security/file-verify.ts`, not part of
  this volume).
- Media is not versioned: replacing a file overwrites the object; deleting the row does not
  automatically restore anything.
- References from content use `ON DELETE set null`, so removing a media row blanks the picture on
  pages instead of breaking them.

## 2. S3 plugin configuration (`payload.config.ts:85-95`)

```
s3Storage({
  enabled: Boolean(process.env.S3_BUCKET),
  collections: { media: { prefix: 'media' } },
  bucket: process.env.S3_BUCKET || '',
  config: s3ClientConfig(process.env),
})
```

- **Why**: "A container's disk is replaced on every deploy, so media on local disk would be lost."
  Without `S3_BUCKET` (local development) the plugin is off and Payload keeps its own folder.
- **Schema dependency**: with the plugin enabled Payload adds `prefix` and `_objectkey` to
  `cms.media`; the committed migration describes the enabled schema, and the drift test forces
  `S3_BUCKET` so the result does not depend on a developer's `.env`
  (`60-dependencies-and-migrations.test.ts:39-41`).
- **A guard test**: `60-...:167-169` asserts that no `media/` directory was written into the
  repository, i.e. the integration run used S3 (the stub), not the local folder.

## 3. Client settings (`s3-config.ts:1-33`)

| Input | Effect |
|---|---|
| `S3_REGION` | `region` |
| `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` | explicit credentials when both set; otherwise `credentials: undefined`, so the AWS SDK default chain finds the EC2 instance role and no long-lived key is stored |
| `S3_ENDPOINT` (optional) | custom endpoint with `forcePathStyle: true`; used by the test suite's local stub |
| `S3_BUCKET` | single bucket for both stores |

The production environment check requires `S3_BUCKET` and `S3_REGION` and rejects exactly one of the
two key variables set (`src/server/env.ts:32-35,80-82`).

## 4. Application documents in the same bucket

- Backend chosen by `Boolean(S3_BUCKET)` at module load (`storage/index.ts:20`). Local development
  writes to a gitignored `uploads/` directory; production refuses to fall back to local disk
  (header comment lines 11-13).
- Key is server-generated: date folder plus 16 random bytes in hex plus an extension kept only if it
  matches `^\.[a-z0-9]{1,8}$`; nothing else from the client file name reaches the key
  (lines 28-34).
- `application_documents.file_name` stores the client name for display only.
- **Reconciliation** (`reconcile.ts`, started by `startReconcileWorker`, `instrumentation.ts:17-19`):
  daily comparison of bucket and table; dry run unless `STORAGE_RECONCILE=apply`. Scope is limited
  so "CMS media (media/...) and anything else in the bucket is never touched" (`reconcile.ts:15`), and
  rows are re-checked immediately before an object is removed (line 65). It exists because cascade
  deletes of `application_documents` rows do not delete objects.

## 5. Privacy and operations notes

- CMS media URLs are public and un-authenticated; any image uploaded is world-readable once its URL
  is known. Do not upload anything not meant for the public (for example, a photograph of a person who
  has not consented). `credit` and `alt` text are public as well.
- Application documents are personal data held in the same bucket as public media; separation is by
  key layout and by application code, not by bucket policy, as far as this repository shows. Bucket
  policy and lifecycle rules are infrastructure, outside the files reviewed (not determined).
- EXIF metadata handling for uploaded photographs is not configured in the collection; whether
  `sharp` strips it on resized variants is library default behaviour and not determined from the
  code. The original file is stored as uploaded.
