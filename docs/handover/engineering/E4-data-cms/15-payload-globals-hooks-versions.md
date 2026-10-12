# E4.15 Global, audit hooks, delete guards, versions and drafts

## 1. The `homepage` global (`src/payload/globals/homepage.ts`)

Deliberately not a page builder (file header, lines 4-16): a fixed set of sections defined in code;
editors change copy, choose features, reorder and switch sections off, but cannot invent layout.
"Admin controls content; developers control experience."

| Tab | Fields |
|---|---|
| Sections | `sections[]`: `key` (select of 10 fixed keys, required, read-only in admin), `enabled` (checkbox, default true). `minRows = maxRows = 10`, so the array can be reordered and toggled, not added to or removed from |
| Hero | `heroHeadline` (req, default `WHAT IF YOU\nACTUALLY BUILT IT?`), `heroSubhead` (req, default), `heroPrimaryCta` (req, default `Start your journey`), `heroSecondaryCta` (default), `heroMedia` (upload media) |
| Narrative | `problemHeading`, `problemBody`, `personHeading`, `personLines[]` (`line` req), `knestHeading`, `knestBody` |
| Featured | `featuredPrograms` (max 4), `featuredStartups` (max 6), `featuredEvents` (max 3), `testimonials` (max 3), `metrics` (max 4); empty falls back to most recent |
| Closing | `closingHeading`, `closingBody`, `closingCta` |

Section keys: hero, problem, person, knest, journey_selector, journey, offer, ecosystem, startups,
closing (`homepage.ts:18-29`). Access: read `() => true`, update `canWrite('content')`.

Tables: `cms.homepage`, `homepage_sections`, `homepage_person_lines`, `homepage_rels`. Defaults for the
three required hero fields are `NOT NULL DEFAULT` in the database (baseline lines 985-1003), so a
fresh database returns usable copy. No versions or drafts are enabled on the global: **an edit is
live on save and the previous value is not retained** (no `versions` key in the config; no
`cms._homepage_v` table in the baseline).

Seeding: `seed-cms.ts` fills the ten section rows and the copy from
`src/server/content/homepage-copy.ts` only when `heroHeadline` is empty (`10-seeds...md`).

## 2. Audit hooks (`src/payload/audit-hooks.ts`)

Purpose: "close the remaining gap for CMS actions (module 43)". Review decisions, member changes and
enquiries already write their own rows; CMS publish, unpublish, edit and delete did not.

| Hook | Trigger | Row written to `app.audit_logs` |
|---|---|---|
| `auditAfterChange` (30-51) | collection `afterChange` | `action` = `cms.create` (operation create); else `cms.publish` if `_status` changed to published; `cms.unpublish` if changed to draft; else `cms.update`. `entity_type` = collection slug, `entity_id` = document id. `before` = null on create, else `{status, title, slug}` of the previous document; `after` = `{status, title, slug}` |
| `auditAfterDelete` (53-56) | collection `afterDelete` | `cms.delete`, `before = {title, slug}`, `after = null` |
| `auditGlobalAfterChange` (58-61) | global `afterChange` | `cms.update`, `entity_type = global:<slug>`, `entity_id = <slug>`, `after = {updated: true}` |
| `withAudit(collection)` (64-73) | applied in `payload.config.ts:67` | appends both hooks after the collection's own hooks, preserving them |

Properties and why:

- **No document body is copied** (header, lines 5-9). The document and its version history are the
  record of content; the audit row only answers who and what status transition. Titles and slugs are
  copied, so a title that is itself sensitive would appear in the audit row.
- **No actor, no row** (`record`, lines 20-21): requests without a signed-in staff user (seeds,
  migrations) are skipped, because `actor_user_id` is `NOT NULL` with a foreign key.
- **Best effort, never blocks the edit**: a failed insert is caught and logged to the console as
  `[audit] could not record a content change` (lines 23-27). The trail can therefore have gaps when
  the database write fails; the console is the only signal. This differs from the transactional
  guarantee of operational audit rows.
- **Not in the same transaction as the change**, because `db` here is the Drizzle pool, not Payload's
  transaction. A rolled-back Payload change after `afterChange` could still leave an audit row; whether
  Payload runs `afterChange` pre-commit is not determined from the code.
- **Excluded**: the `staff` collection is not wrapped (`payload.config.ts:66-67`), because its mirror
  is upserted on every admin request.
- **Actor id** is `req.user.id` as string. For staff that is the `app.users.id`, which satisfies the
  FK. Proven by `tests/integration/43-cms-audit.test.ts` (create, publish, unpublish, delete for
  `events`, all rows carry the actor).
- **Autosave** is not enabled (see below), so a draft save is one `cms.update` row, not a stream.

## 3. Delete guards

| Where | Guard |
|---|---|
| `programs` `beforeDelete` (`programs.ts:43-58`) | counts `app.applications` for the program id; throws `APIError(message, 409, undefined, true)` (public message) when above zero. Reason: applications reference the program with no FK, so the database cannot stop the orphaning (R-04). The remedy is to unpublish |
| `staff` | `delete: () => false` |
| everything else | role-based `delete` access only |

No guard exists for events (registrations), infrastructure (labs), mentors/founders (user links),
media (referenced images; FKs set the reference to null), or the cohort that startups reference.

## 4. Versions and drafts

Configured exactly as `versions: { drafts: true }` on nine collections: programs, startups, founders,
mentors, partners, events, resources, articles, infrastructure (the file for each, line with
`versions:`). No `maxPerDoc`, `autosave`, `schedulePublish` or `validate` option is set, so Payload's
defaults apply for those; the default values are not determined from this repository.

Effects visible in the code and schema:

- **`_status`** column (`draft` | `published`, default `draft`) on the main table, enum
  `enum_<slug>_status` in `cms`.
- **A `_<slug>_v` table** holds each saved version (`parent_id`, `version_*` copies of every field,
  and a `latest` boolean; baseline line 253 for programs) with array and rels children
  (`_programs_v_version_timeline`, `_programs_v_rels`, ...). Heavy: a version stores a full copy of
  every richText body.
- **Public read** is filtered to `_status = published` by `readPublished`, so an editor can prepare
  changes without exposing them, and unpublishing removes a document from every public read path.
- **Created as draft**: a new document is `draft` by default; the tests create with `draft: true` and
  publish with `_status: 'published'`.
- **Collections without drafts** (cohorts, testimonials, faqs, metrics, media, staff and the
  homepage global) have no draft state and no version history: an edit is immediately live and
  not recoverable from the database. Backups are the only recovery.
- **Why that split**: items that are a person's quote, a statistic, or a join row are either present or
  not; editorial pages with long text need review before going live.

Version-table growth is unbounded by configuration. Not determined from the code whether Payload
prunes by default.
