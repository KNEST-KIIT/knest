# E4.08 Payload migrations and the `cms` schema

Location: `src/migrations/` (set by `migrationDir`, `src/payload/payload.config.ts:111`). Index:
`src/migrations/index.ts:1-21`. Applied by `payload migrate` (the second step of `pnpm migrate`,
`package.json:20`). Payload records applied files in `cms.payload_migrations`
(baseline `20261008_114259_baseline.ts:962-968`).

Auto-push is off: `push: false` (`payload.config.ts:110`). The comment records why: dev-mode push
"never ran in production, so a production database could not be created at all (KN-04), and an
interactive push cannot run in CI".

| Order | File | Direction functions | Purpose |
|---|---|---|---|
| 1 | `20261008_114259_baseline.ts` (+ `.json` snapshot) | `up`, `down` | Creates schema `cms` and every table, enum, FK and index for all collections, the homepage global and Payload internals |
| 2 | `20261009_073957_media_s3_prefix.ts` | `up`, `down` | Adds `prefix` and `_objectkey` to `cms.media` |
| 3 | `20261009_083013_drop_cms_lab_bookings.ts` | `up`, `down` | Removes the abandoned `cms.lab_bookings` collection |

The `.json` files are Payload's schema snapshots used to compute the next diff; they are 13k lines
each and are generated, not edited.

## 1. Baseline `20261008_114259_baseline`

- **Hand edit.** Line 7 was added by hand: `CREATE SCHEMA IF NOT EXISTS "cms"`, because generated SQL
  assumed the schema already existed (dev push used to create it) and a migrate on an empty database
  failed with `schema "cms" does not exist` (comment lines 4-6). Regenerating this file would lose the
  line.
- **Contents.** 80 `CREATE TABLE` statements and 64 enum types (counted from the file). Groups:
  - Per collection: main table (`programs`, `cohorts`, `startups`, `founders`, `mentors`, `partners`,
    `events`, `resources`, `articles`, `infrastructure`, `testimonials`, `faqs`, `metrics`, `media`,
    `staff`).
  - Array fields become child tables (`programs_timeline`, `programs_faqs`,
    `programs_application_questions`, `programs_application_questions_options`, `startups_story`,
    `startups_achievements`, `events_speakers`, `infrastructure_equipment`,
    `homepage_sections`, `homepage_person_lines`), keyed by `_parent_id` and `_order`, with the array
    row's own `id` as `varchar` primary key. That `varchar` id is the "stable question id" that
    `app.application_answers.question_id` stores.
  - Multi-select fields become one table per field (`programs_stage`, `programs_sectors`,
    `programs_audience`, `mentors_expertise`, `resources_stages`, and so on).
  - Relationship fields become `<collection>_rels` tables (`programs_rels`, `startups_rels`,
    `events_rels`, `homepage_rels`, ...). Single upload and single relationship fields on a document
    are plain `<field>_id integer` columns with FK to the target.
  - Version tables for every collection with drafts: `_<collection>_v`, `_<collection>_v_rels`,
    `_<collection>_v_version_<array>`. Versioned collections: programs, startups, founders, mentors,
    partners, events, resources, articles, infrastructure. No versions for cohorts, testimonials,
    faqs, metrics, media, staff.
  - Payload internals: `payload_kv`, `payload_locked_documents` (+ `_rels`), `payload_preferences`
    (+ `_rels`), `payload_migrations`.
  - The global: `homepage`, `homepage_sections`, `homepage_person_lines`, `homepage_rels`. Globals
    have no version table here because the global does not enable versions.
- **Ids.** Collection ids are `serial` integers, except `cms.staff.id` which is `varchar` so it can
  hold the `app.users.id` UUID (`staff.ts:41-44`; baseline line 901). `payload_locked_documents_rels.
  staff_id` and `payload_preferences_rels.staff_id` are `varchar` for the same reason.
- **Slug uniqueness**: unique btree indexes `<collection>_slug_idx` on programs, startups, founders,
  mentors, partners, events, resources, articles, infrastructure (baseline lines 1169-1412); `media`
  has a unique `media_filename_idx`; `payload_kv` has unique `payload_kv_key_idx`.
- **Defaults baked into the schema.** The `homepage` table has `NOT NULL DEFAULT` on `hero_headline`,
  `hero_subhead` and `hero_primary_cta` (baseline lines 985-1003), so an empty-database read returns
  copy. These defaults come from `src/payload/globals/homepage.ts:69-77`.
- **Leftover.** The baseline still creates `cms.lab_bookings` and `enum_lab_bookings_status`
  (lines 820-830) and the `lab_bookings_id` column on `payload_locked_documents_rels`. No such
  collection exists in `payload.config.ts`. It is removed by migration 3.
- **`down`** (line 1501 onward) drops every table with `CASCADE` and then every type. It does not drop
  schema `cms`. Running it destroys all CMS content; there is no partial down.

## 2. `20261009_073957_media_s3_prefix`

```
ALTER TABLE "cms"."media" ADD COLUMN "prefix" varchar DEFAULT 'media';
ALTER TABLE "cms"."media" ADD COLUMN "_objectkey" varchar;
```

- Why: the S3 storage plugin adds `prefix` (default taken from `collections.media.prefix = 'media'`,
  `payload.config.ts:91`) and `_objectkey` to the upload collection when it is enabled. The
  collection schema therefore **depends on whether `S3_BUCKET` is set when Payload loads config**.
- Consequence enforced by test: the drift test sets `S3_BUCKET=drift-check-bucket` so the committed
  migrations describe the production schema "whether or not the machine running this has a .env that
  sets a bucket" (`tests/integration/60-...:39-41`).
- Data effects: existing media rows get `prefix = 'media'` through the default; `_objectkey` stays
  null. Objects uploaded before the plugin was enabled sit on local disk, not in S3, and are not
  moved by this migration.
- Rollback (`down`): drops both columns; harmless to row data otherwise.

## 3. `20261009_083013_drop_cms_lab_bookings`

- `up`: disables RLS on and drops `cms.lab_bookings CASCADE`, drops FK
  `payload_locked_documents_rels_lab_bookings_fk`, index
  `payload_locked_documents_rels_lab_bookings_id_idx`, column `lab_bookings_id`, and type
  `enum_lab_bookings_status`.
- Why: lab booking moved to `app.lab_bookings` (Drizzle, migration 0010) because operational data
  belongs in `app` and needs the exclusion constraint. The CMS collection was a first attempt.
- Data effects: any rows in `cms.lab_bookings` are destroyed. Not determined from the code whether
  any environment ever held rows; the abandoned collection fields (`user_id`, `user_email`) would
  have been personal data.
- `down` recreates the table and constraints empty. It does not restore rows.
- Formatting note: `index.ts:19` has no trailing comma on the last `name:` property; harmless, this
  file is generated.

## 4. How to change a collection

1. Edit the collection or global config.
2. `pnpm payload migrate:create <name>`; review the SQL; commit the `.ts`, the `.json` and the
   regenerated `index.ts`.
3. Update `src/payload/payload-types.ts` with `pnpm generate:types`.
4. The drift test (`60-...:34-52`) fails CI if step 2 was skipped: it runs `payload migrate:create
   drift_check --skip-empty`, deletes anything created, and asserts that nothing was created.

## 5. Ordering with Drizzle

`pnpm migrate` runs Drizzle first, then Payload, then the runtime role script
(`package.json:20`). The two histories are independent: no Payload migration references an `app`
object and no Drizzle migration references a `cms` object. The one runtime-time coupling is the raw
upsert into `"cms"."staff"` in `src/payload/auth-strategy.ts:51-61`, which requires the baseline's
`cms.staff` table to exist with columns `id, email, name, staff_role, created_at, updated_at`
(baseline lines 901-908). Renaming those fields in `staff.ts` without updating that SQL would break
every admin request silently, because the error is caught and logged (`auth-strategy.ts:62-64`).
