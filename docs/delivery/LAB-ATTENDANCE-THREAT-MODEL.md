# Lab attendance: QR and offline threat model

**Purpose:** validate the threat model *before* the attendance mechanism (blueprint LB-07, LB-08, LB-10) is implemented. **No code is to be written for QR passes, scanning or offline sync until sections 6 and 7 are signed off.**

**Status:** DRAFT for review by the owner and a KIIT lab head. Nothing here has been tested on a device. Statements about browser behaviour come from published compatibility data (Background Sync is unsupported on Safari and Firefox; `BarcodeDetector` is experimental and not available everywhere), not from tests on KIIT's phones.

## 1. What is being protected

| Asset | Why it matters |
|---|---|
| The attendance record ("this person was in this lab during this slot") | It feeds utilisation reports KIIT will use to justify the facilities, and may be used in disputes about equipment damage or access |
| Booking integrity | Approved slots must be real and unique |
| Student identity and schedule | Privacy; the record is personal data (HD-06) |
| Lab assistants' and heads' accountability | Their actions are audited |

The contract says the platform "gates physical lab access" and that a "screenshot of somebody else's pass does not work". **How much assurance is actually needed depends on whether the QR code opens a door or only records attendance. That is an open policy question (HD-16) and it changes the answer.** This model treats the stricter reading as the target and flags where a weaker one would do.

## 2. Actors

| Actor | Motive |
|---|---|
| Student | Be recorded as present without attending, or attend without a booking |
| Student's friend | Proxy attendance (be present as someone else, or vouch remotely) |
| Lab assistant | Record attendance that did not happen, skip duty, or cover for a friend |
| Lab head | Normally trusted; can approve and edit; accountable |
| Outsider who steals or finds a phone | Impersonate a student or assistant |
| Anyone on the network | Replay or tamper with scans |
| Malicious script on the site (XSS) | Steal keys or forge scans |

## 3. Design under review

The R1 baseline proposed a rotating code derived from a per-booking shared secret (HMAC), with assistant devices provisioned with the secrets for their own roster so they can verify offline.

**This model finds that design weaker than it looked.** A shared secret on the assistant's phone lets whoever controls that phone (the assistant, or a thief) mint a valid pass for every student on that roster. The recommended replacement is below.

### Recommended mechanism (subject to the validation in section 6)
- **Asymmetric signatures instead of shared secrets.** When a booking is approved, the student's device generates a P-256 key pair with WebCrypto, marked non-extractable, and registers only the **public** key with the server. The pass is a short-lived signed message: booking id, key id, a time step, a random nonce. The assistant's device is provisioned with the **public** keys for its roster, so it can verify offline without holding anything that can forge a pass.
- **The reverse direction is symmetric in shape.** Each assistant has their own device key pair; the lab-side code is a short-lived signed message that the student's device checks against the assistant's registered public key.
- **Scan events are signed by the scanning device** and carry both messages, a UUID, and the scanner's local time. The server, not the device, decides whether an event counts.
- **Verified means the server validated both directions** within the slot window. One direction is "partially recorded". The interface never shows "Verified" before the server acknowledges.
- **Manual attendance** by an assistant or head is permitted, requires a reason, and is stored and reported as "manual, not QR-verified".

## 4. Threats and assessment

| # | Threat | Likelihood | Impact | Mitigation in the recommended design | Residual risk |
|---|---|---|---|---|---|
| T1 | Student shares a **screenshot or photo** of a pass | High | Medium | Pass expires within the time step (proposed 30 s); static codes are never accepted | Low |
| T2 | **Live relay**: friend at the lab, student remote, student streams the live code within seconds, or photographs the lab-side code and scans it from elsewhere | Medium | Medium-High | Two-way exchange needs both codes inside the window; the assistant is expected to look at the person and their ID (procedure, not software) | **Medium.** A QR code cannot prove physical presence. Browsers have no BLE/NFC proximity. State this plainly to KIIT instead of promising it is solved. |
| T3 | Thief or insider uses the **assistant's phone** | Medium | High under the R1 design | With signatures the phone holds only that assistant's own private key and public keys of students; it cannot forge a student's pass. It can still forge *its own* side, so scans stay attributable to that assistant | Low-Medium |
| T4 | **Replay** of a captured scan payload | Medium | Medium | Nonce plus time step plus UUID; server rejects duplicates; the student's embedded timestamp must fall in the slot | Low |
| T5 | **Clock manipulation** on either phone | Medium | Medium | Server stores client time and receipt time; events whose client clock is more than a threshold (proposed 5 min) off the server at sync, or synced more than 24 h late, go to head review | Low-Medium |
| T6 | **Lost offline data**: assistant's browser storage is cleared or evicted (iOS can evict script-writable storage; this is a documented risk), or the phone is lost before sync | Medium | Medium | Sync on every app open and on `online`; a visible unsynced count; the student's device holds its own record of the lab-side scan; unsynced items older than 1 h raise a warning | Medium. Some records will be lost; the system must say "not yet verified", never invent success. |
| T7 | **Assistant fabricates** manual attendance | Low-Medium | Medium | Reason required; head approval; manual share per assistant is reported | Low |
| T8 | Student account takeover books or checks in | Low-Medium | Medium | Verified email, Turnstile, rate limits, booking-time eligibility check repeated at approval | Low |
| T9 | Key theft by **XSS** | Low | High | Non-extractable CryptoKeys (script can use but not read them), strict CSP, no third-party scripts on the lab pages | Low |
| T10 | **Privacy**: assistant devices cache names and schedules | Medium | Medium | Cache only the next 24 h of the roster, no email addresses, wipe on logout and on a timer; QR payloads contain no personal data | Low |
| T11 | Shared **lab-desk tablet** used by several people | Medium | Medium | Per-person sign-in; device keys are per user, never per tablet | Low |
| T12 | **Repudiation**: "I never scanned" or "I was there" | Medium | Medium | Append-only event log with both signatures and key ids; key rotation keeps old public keys | Low |
| T13 | Scanner user cannot use a camera (disability, broken camera, no light) | Medium | Medium | Manual path with a reason code; it must not be a lesser-class experience | Low |
| T14 | Stale keys after a **lost student phone** | Low | Medium | Head can revoke a booking's key; the student re-enrols online, which needs connectivity | Low |

## 5. Platform constraints that shape the design

- **iOS Safari:** no Background Sync. The outbox therefore has to be application-level (IndexedDB queue, retried on open, on `online` and by a "Sync now" button). `BarcodeDetector` is unavailable, so a JS/WASM decoder is needed and its speed on older iPhones must be measured. Storage can be evicted when a site is not installed or not used.
- **Android Chrome / Samsung Internet:** Background Sync exists but is best-effort; use it only as an enhancement.
- **Firefox:** neither Background Sync nor, in general, `BarcodeDetector`.
- **Camera:** needs HTTPS and a user gesture; the permissions policy must allow `camera=(self)` on the scan page only.

## 6. What must be validated before implementation

1. **Assurance level (HD-16):** does a scan open a door, or only record attendance for reports? If only the latter, T2 is acceptable with a visual ID check, and the design can be simpler.
2. **Device spike (no production code):** on real devices KIIT labs will use (at least one mid-range Android, one older iPhone, one Samsung Internet): generate and persist non-extractable keys; install as a PWA and test whether keys survive a week and a storage-pressure event; measure QR decode success rate and time under lab lighting at the student-held and assistant-held distances; time the signature create and verify.
3. **Workflow trial:** two real assistants run the two-way scan on paper-prototype slots for a day. If it takes more than about 15 s per student or queues form at the door, the design is wrong for the lab regardless of its security.
4. **Clock drift:** sample the real skew of 20 devices against server time.
5. **Review:** a KIIT lab head reads sections 1, 4 and 5 and confirms the threats and the residual risks are acceptable.

## 7. Decision record

| Decision | Status |
|---|---|
| Replace shared-secret HMAC with per-device asymmetric signatures | PROPOSED, supersedes the R1 wording |
| Verified requires server validation of both directions | PROPOSED |
| Application-level outbox; Background Sync as an optional extra | PROPOSED |
| Manual attendance allowed, labelled, reported separately | PROPOSED |
| Accepting T2 (live relay) as a residual risk | NEEDS OWNER AND KIIT DECISION |
| Implementation of LB-07, LB-08, LB-10 | **BLOCKED** until sections 6.1-6.5 are complete |

Nothing in this document is a promise that the attendance system will be secure, only a statement of what it can and cannot prove.
