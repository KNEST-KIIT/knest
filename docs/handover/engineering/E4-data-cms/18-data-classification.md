# E4.18 Data classification and privacy register

Purpose: one list a privacy reviewer can work from. Classes used:

| Class | Meaning |
|---|---|
| PD-member | Personal data of a member, applicant or visitor |
| PD-staff | Personal data of staff, or records of what staff did |
| SEC | Authentication or credential material, whose disclosure grants access |
| PUB | Public content, published by design |
| OPS | Operational data with no direct personal data (may be indirectly identifying through ids or IP) |

Delete behaviour is the foreign-key action on the user relationship, from the schema files cited in
files 02 to 05. No code path deletes a user (`01`, section 3), so these describe what a future erasure
would meet.

## 1. `app` schema

| Table | Class | Personal fields | User FK action | Retention in code | Notes |
|---|---|---|---|---|---|
| `users` | PD-member, PD-staff, SEC | e-mail, name, image, bio, organisation, school, graduation year, LinkedIn and website URLs, skills, interests, goals, expertise, years of experience, journey stage, role fields; `password_hash` (SEC) | n/a | none; `is_active` flag only | Staff are rows here too (`staff_role`) |
| `accounts` | SEC, PD-member | provider id, OAuth `access_token`, `refresh_token`, `id_token` in plain text | CASCADE | none | empty unless Google sign-in is on |
| `sessions` | SEC | `session_token` in clear, user link, expiry | CASCADE | expiry column only; no purge job | see D-04 |
| `verification_tokens` | SEC | e-mail inside `identifier`; token stored as SHA-256 | none (string key) | consumed on use; expiry column; no purge job | |
| `applications` | PD-member | user link, program, decision note, question snapshot | CASCADE | none | decision note is staff-only text about a person |
| `application_answers` | PD-member | free-text answers (may include anything an applicant writes) | via application CASCADE | none | highest-risk free text |
| `application_documents` | PD-member | file name, size, type; object key to a file in S3 | via application CASCADE | none; object not deleted by cascade | files may be CVs, ids, pitch decks; reconcile worker cleans objects |
| `notifications` | PD-member | title and body text about the person's own activity | CASCADE | none | |
| `audit_logs` | PD-staff, PD-member | actor id; entity ids; `before`/`after` snapshots (for example status changes, decision notes, device-key label, CMS titles) | actor RESTRICT | none | the one user FK that blocks deletion of staff who acted |
| `event_registrations` | PD-member | user, event id, time | CASCADE | none | |
| `analytics_events` | PD-member (pseudonymous) | `session_id` cookie value, optional user id, event name, props (program ids, search terms) | SET NULL | none | `search_query` logs a processed term, may contain personal words |
| `enquiries` | PD-member | name, e-mail, free-text message, optional user id | SET NULL (both user columns) | none | anonymous visitors included; match on e-mail for erasure |
| `rate_limits` | OPS, PD-member (IP) | keys embed client IPs for anonymous routes, user ids for authenticated | none | **no purge** (D-03) | |
| `email_outbox` | PD-member, SEC (while body live) | recipient address, subject, body with single-use links | none | body blanked on send, expiry, or 7 days after creation when dead; **rows never deleted** | recipient and subject kept indefinitely |
| `lab_departments` | OPS | none | n/a | | |
| `labs`, `lab_hours`, `lab_blackouts` | OPS | none | n/a | | |
| `lab_staff` | PD-staff | who runs which lab (user id, role) | CASCADE | none | |
| `lab_bookings` | PD-member | user, purpose text, headcount, equipment, decision note, decider, assistant | user RESTRICT; decider and assistant SET NULL | none | RESTRICT blocks user deletion |
| `lab_attendance` | PD-member | outcome, who marked, reason | marker SET NULL; via booking CASCADE | none | |
| `lab_device_keys` | PD-member | public key, label, last-used time, who revoked | owner RESTRICT; revoker SET NULL | none | keys are not secret but identify a device owner |
| `lab_scan_events` | PD-member | scanner user, key ids, nonce, signed token, client clock, review note | scanner RESTRICT; reviewer SET NULL | none | append-only evidence; needs in-place anonymisation |
| `lab_qr_checks` | PD-member (via booking) | event links | via booking RESTRICT | none | |

## 2. `cms` schema

| Table group | Class | Personal fields | Notes |
|---|---|---|---|
| `programs*`, `cohorts*`, `events*` (+ `speakers`), `resources*`, `articles*`, `faqs`, `metrics`, `infrastructure*`, `partners*`, `homepage*` | PUB | `events.speakers[].name/title/organization/photo` name third parties; `articles.author` is free text | public once published (or always, for non-draft collections) |
| `startups*` | PUB | founder names appear through `founders` relation | |
| `founders*`, `mentors*` | PUB, PD-member | name, headline, bio, school, graduation year, LinkedIn URL, photo, **`user_id`** (internal account id) | published profile is public over REST including `user_id` (D-08); unpublishing removes from reads but versions retain history |
| `testimonials` | PUB, PD-member | quote, name, role, photo, consent flag | no draft state, public on save |
| `media` | PUB | `alt`, `credit` (photographer or source name), image content (faces) | world-readable URL |
| `staff` | PD-staff | e-mail, name, last staff role, id | mirror of `app.users`; never pruned (D-12); readable by any staff user |
| `payload_preferences*` | PD-staff | per-staff admin UI preferences | keyed to staff id |
| `payload_locked_documents*` | OPS | which staff holds a document lock | |
| `payload_kv`, `payload_migrations` | OPS | | |
| `_<slug>_v*` (versions) | as the live collection | full historical copies, including text since edited or removed | an unpublished or edited-away value persists here |

## 3. Cross-store personal data (outside the database)

- S3 bucket: application documents (PD-member) next to public media.
- Browser cookies set by the platform: Auth.js session cookie (SEC), `knest_sid` analytics cookie,
  180 days (`track.ts:5,26-33`).
- E-mail provider (SES or SMTP): content of every outbound message.
- Console logs: `[audit]`, `email_outbox_retry`, `email_outbox_dead`; these carry ids and sanitised
  errors, not addresses (`describeError`).

## 4. Points for the privacy impact assessment

1. **No retention policy is implemented for any table.** Only secrets are blanked (`email_outbox.body`).
   Candidates by risk: `application_answers`, `application_documents` and objects, `enquiries`,
   `analytics_events`, `rate_limits`, `sessions`, `email_outbox` metadata, `lab_scan_events`.
2. **Erasure is not designed.** Constraints that would stop `DELETE FROM app.users`: `audit_logs`,
   `lab_bookings`, `lab_device_keys`, `lab_scan_events` (all RESTRICT via the user), then cascade
   removal of applications, documents rows (objects remain), notifications, registrations and lab
   staff grants; SET NULL on analytics and enquiries leaves the free-text fields and e-mail in place.
   Rows keyed by e-mail string (`enquiries.email`, `email_outbox.to_address`,
   `verification_tokens.identifier`) are not reachable by user id.
3. **Public profile data has a second life in version tables** and in CDN or browser caches.
4. **Staff data**: `cms.staff` and `audit_logs.actor_user_id` hold identifiable staff activity;
   audit rows reference staff by id and the viewer joins to e-mail and name
   (`src/server/audit/queries.ts:30-37`).
5. **Special categories**: nothing in the schema is labelled special-category data, but
   `application_answers.value` and uploaded documents are free text and files under applicant
   control. Not determined from the code whether program questions ask for any.
6. **Transfers**: the e-mail provider (SES region from `AWS_REGION` or `S3_REGION`) and the S3 region
   are configuration. The region values are not in the repository.
