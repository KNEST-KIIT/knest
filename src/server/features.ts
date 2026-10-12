/**
 * Feature flags. A flag that gates a server action must be checked inside the
 * action as well as on the page: server actions are POST endpoints that can be
 * called without ever rendering the page that hosts them.
 */

type Env = Record<string, string | undefined>

/**
 * Lab booking is off unless `FEATURE_LAB_BOOKING` is exactly "true". It is a
 * contracted module (ADR-002) that is being rebuilt, so the interim
 * implementation must not be reachable in any environment by default.
 */
export function isLabBookingEnabled(env: Env = process.env): boolean {
  return env.FEATURE_LAB_BOOKING === 'true'
}

/**
 * QR attendance (signed passes, two-sided scan, offline outbox, PWA) is off unless
 * `FEATURE_LAB_ATTENDANCE_QR` is exactly "true" AND lab booking is on. Enabling it in any real
 * environment needs the threat model (docs/delivery/LAB-ATTENDANCE-THREAT-MODEL.md) signed off by
 * KIIT and a lab head, and the real-device protocol run. The code records attendance; it opens no door.
 */
export function isLabAttendanceQrEnabled(env: Env = process.env): boolean {
  return isLabBookingEnabled(env) && env.FEATURE_LAB_ATTENDANCE_QR === 'true'
}
