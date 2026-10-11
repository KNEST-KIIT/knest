import { sql } from 'drizzle-orm'
import { bigint, check, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { appSchema } from './enums'
import { labBookings } from './labs'
import { users } from './users'

/**
 * QR attendance (contract modules 30 and 31). Design and threat model: docs/delivery/LAB-ATTENDANCE-THREAT-MODEL.md.
 *
 * Assurance level: RECORD ATTENDANCE. Nothing here opens a door. The whole feature sits behind
 * FEATURE_LAB_ATTENDANCE_QR (default off, and it also needs FEATURE_LAB_BOOKING); enabling it needs
 * the threat model signed off by KIIT and a lab head.
 *
 * No personal data is stored in a QR payload. Public keys and key ids are not secret.
 */

export const labScanSide = appSchema.enum('lab_scan_side', ['staff', 'student'])
export const labScanAction = appSchema.enum('lab_scan_action', ['in', 'out'])
export const labScanStatus = appSchema.enum('lab_scan_status', ['accepted', 'review', 'rejected'])
export const labQrCheckState = appSchema.enum('lab_qr_check_state', ['partial_staff', 'partial_student', 'verified'])

/**
 * A device public key. One person may have several (phone, second phone); a key belongs to a person,
 * never to a shared tablet (T11). The id is derived from the key, so it cannot be chosen.
 */
export const labDeviceKeys = appSchema.table(
  'lab_device_keys',
  {
    /** First 12 bytes of SHA-256 of the raw public key, base64url: 16 characters. */
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    /** The 65-byte uncompressed P-256 point, base64url. */
    publicKey: text('public_key').notNull(),
    label: text('label').notNull().default(''),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
    revokedBy: text('revoked_by').references(() => users.id, { onDelete: 'set null' }),
    revokedReason: text('revoked_reason'),
  },
  (t) => [
    index('lab_device_keys_user_idx').on(t.userId),
    uniqueIndex('lab_device_keys_public_key_idx').on(t.publicKey),
    check('lab_device_keys_id_shape', sql`char_length(${t.id}) = 16`),
  ],
)

/**
 * Every scan event the server has seen from a signed-in submitter, kept append-only with its signed
 * token so a dispute can be settled from the record itself (T12). The server decides `status`.
 */
export const labScanEvents = appSchema.table(
  'lab_scan_events',
  {
    /** The UUID the scanning device chose: the idempotency key of the outbox. */
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull().references(() => labBookings.id, { onDelete: 'restrict' }),
    side: labScanSide('side').notNull(),
    action: labScanAction('action').notNull(),
    scannerUserId: text('scanner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    scannerKeyId: text('scanner_key_id').notNull(),
    innerKeyId: text('inner_key_id'),
    innerUserId: text('inner_user_id'),
    innerNonce: text('inner_nonce'),
    innerStep: bigint('inner_step', { mode: 'number' }),
    /** The signed scan token, verbatim, including the scanned pass or challenge. */
    token: text('token').notNull(),
    status: labScanStatus('status').notNull(),
    /** Reject or review reason code. */
    code: text('code'),
    /** The scanner's own clock when it scanned, and when it submitted (milliseconds since epoch). */
    clientAtMs: bigint('client_at_ms', { mode: 'number' }).notNull(),
    clientSyncAtMs: bigint('client_sync_at_ms', { mode: 'number' }).notNull(),
    /** Scan time on the server timeline after correcting for the measured skew. */
    effectiveAt: timestamp('effective_at', { mode: 'date', withTimezone: true }),
    receivedAt: timestamp('received_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { mode: 'date', withTimezone: true }),
    reviewNote: text('review_note'),
  },
  (t) => [
    index('lab_scan_events_booking_idx').on(t.bookingId, t.action),
    index('lab_scan_events_review_idx').on(t.status, t.receivedAt),
    index('lab_scan_events_scanner_idx').on(t.scannerUserId, t.receivedAt),
    // Replay: a student pass nonce is single use; a student scans a given desk challenge once.
    uniqueIndex('lab_scan_events_staff_nonce_idx')
      .on(t.innerKeyId, t.innerNonce)
      .where(sql`${t.side} = 'staff' and ${t.status} <> 'rejected'`),
    uniqueIndex('lab_scan_events_student_nonce_idx')
      .on(t.scannerKeyId, t.innerNonce)
      .where(sql`${t.side} = 'student' and ${t.status} <> 'rejected'`),
    check('lab_scan_events_client_times', sql`${t.clientAtMs} > 0 and ${t.clientSyncAtMs} > 0`),
  ],
)

/**
 * The outcome per booking and direction. `verified` only when the server accepted both a staff-side
 * and a student-side event inside the pair window. The interface never says verified before this.
 */
export const labQrChecks = appSchema.table(
  'lab_qr_checks',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    bookingId: text('booking_id').notNull().references(() => labBookings.id, { onDelete: 'restrict' }),
    action: labScanAction('action').notNull(),
    state: labQrCheckState('state').notNull(),
    staffEventId: text('staff_event_id').references(() => labScanEvents.id, { onDelete: 'restrict' }),
    studentEventId: text('student_event_id').references(() => labScanEvents.id, { onDelete: 'restrict' }),
    verifiedAt: timestamp('verified_at', { mode: 'date', withTimezone: true }),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('lab_qr_checks_booking_action_idx').on(t.bookingId, t.action),
    check('lab_qr_checks_verified_has_both', sql`${t.state} <> 'verified' or (${t.staffEventId} is not null and ${t.studentEventId} is not null and ${t.verifiedAt} is not null)`),
  ],
)
