# Lab attendance: real-device test protocol

**Purpose:** the evidence that `LAB-ATTENDANCE-THREAT-MODEL.md` section 6 requires before `FEATURE_LAB_ATTENDANCE_QR` is switched on anywhere real people use it. This is a protocol and a results template. **No results exist yet; every result cell is blank.** Emulators and desktop "mobile mode" do not count.

**Update 2026-10-12.** The mechanism has now been built (behind the flag, off), so this protocol no longer runs against a throwaway page: run it against the real screen `/lab-device` on a staging or local HTTPS origin with `FEATURE_LAB_BOOKING=true` and `FEATURE_LAB_ATTENDANCE_QR=true`. Section 5 says exactly what the local suite already proves and what only a device can.

**Who runs it:** an engineer plus the devices below, in the actual lab, under the lighting and network the lab really has. **Code involved:** the production screen at `/lab-device`, served over HTTPS (browsers refuse the camera and the service worker on plain HTTP except for `localhost`). A tunnel to a local build is enough for the first run.

## 1. Devices (minimum)

| ID | Device | OS / browser | Mode | Owner |
|---|---|---|---|---|
| D1 | A mid-range Android phone | Chrome, current | browser tab and installed PWA | |
| D2 | A Samsung phone | Samsung Internet, current | browser tab and installed PWA | |
| D3 | An older iPhone (oldest model KIIT students commonly use) | Safari, current iOS | browser tab and **Add to Home Screen** | |
| D4 | A recent iPhone | Safari | browser tab and Add to Home Screen | |
| D5 | The shared desk tablet, if one is planned | its browser | as deployed | |

## 2. Tests

| # | Test | Method | Pass criterion (proposed; approve or change) | D1 | D2 | D3 | D4 | D5 |
|---|---|---|---|---|---|---|---|---|
| T1 | Key generation: WebCrypto P-256 key pair, non-extractable | Generate, sign, verify on server | Works on every device | | | | | |
| T2 | Key persistence | Store in IndexedDB; reopen after 1 h, 24 h, 7 days, after closing the app, after low-storage warning | Key present after 7 days on installed PWAs; any loss is detected and the person re-enrols online | | | | | |
| T3 | Signature time | Time create + verify, 100 runs | Median under 200 ms, worst under 1 s | | | | | |
| T4 | QR decode | Scan the pass at hand's length and desk distance, lab lighting, cracked or dim screens, 50 scans each | At least 95% decoded within 2 s; native decoder where present, JS decoder otherwise | | | | | |
| T5 | Camera permission flow | First use, denied, revoked, installed vs browser | A clear recovery path; manual check-in still possible | | | | | |
| T6 | Clock skew | Compare each device's clock with the server at 10 points over a day | Skew recorded; server tolerance (proposed 5 min) is adequate | | | | | |
| T7 | Offline outbox | Airplane mode: queue 20 scan events, restore signal, reopen app | All events reach the server once (idempotent); "not yet verified" shown until acknowledged; nothing shown as verified early | | | | | |
| T8 | Browser-kill and eviction | Queue events, force-quit the app, fill storage, wait 24 h | Unsynced items survive, or their loss is shown to the user | | | | | |
| T9 | Two-way exchange | Student and assistant devices exchange codes for 20 pairs, timed | Under 15 s per student; no queue at the door | | | | | |
| T10 | Screenshot and relay | Photograph the pass and replay it after 5, 30, 90 s; relay a live code to a second device | Rejected after the validity window; the live-relay result is recorded honestly as a residual risk | | | | | |
| T11 | Replay of a captured scan payload | Submit the same event twice, and from another device | Second submission rejected | | | | | |
| T12 | Accessibility | Operate the scan page with a screen reader and with large text | Usable, or the manual path is | | | | | |

## 3. Record for every run

Date, tester, device model and OS/browser versions, app mode (tab / installed), lab and lighting, network, raw numbers, screenshots or screen recordings stored under `docs/delivery/EVIDENCE/lab-devices/` (no personal data in them), and any anomaly. A failed test is recorded as failed and changes the design; it is not repeated until it passes.

## 4. Outcome

| Decision | Basis |
|---|---|
| Proceed with asymmetric-signature passes and the app-level outbox | all of T1-T3, T7, T9 pass on D1-D4 |
| Fall back to server-issued short codes with manual verification | T1 or T2 fails on iOS |
| Manual attendance only for iOS | T4 or T5 fails on D3 |
| Re-scope with the lab heads | T9 exceeds 15 s |

## 5. What the local suite proves, and what it cannot

Written 2026-10-12 by the engineer who built it. Be explicit about the gap: **nothing below has run on an Android or iOS device.**

### Proven in CI on this build (no phone involved)

| Area | How | Test |
|---|---|---|
| P-256 key generation, non-extractable private key, deterministic key id, off-curve key refusal | Node WebCrypto (the same API as a browser) | `src/lib/lab-qr/protocol.test.ts` |
| Pass, desk code and scan event signing; tamper, wrong-type, over-long and extra-field tokens refused | unit | same |
| Forgery by a staff key, by an unregistered key, by a key claiming another key id; another student; another booking; wrong lab; wrong action; not staff; not the assigned assistant | unit and integration | `protocol.test.ts`, `tests/integration/44-lab-attendance-qr.test.ts` |
| Screenshot (expired step), step drift tolerance of exactly one step | unit and integration | same |
| Replay: same event id, same pass nonce under a new id, captured event submitted by another account | unit and integration (real PostgreSQL unique indexes) | same |
| Clock skew: exact 5 minute boundary, over 24 h late sync, future-dated, online events held to server time | unit | `protocol.test.ts` |
| Key revocation before, at and after a scan; head revocation; revoked key cannot re-register | unit and integration | same |
| Two halves arriving at the same instant yield one verified check and one attendance row; 40 events sent twice in parallel are stored once | integration | `44-lab-attendance-qr.test.ts` |
| Outbox: batching, retry on failure, nothing shown verified early, signed-out stop, stale warning | unit | `src/lib/lab-qr/client/client.test.ts` |
| 24 h roster cache expiry, wipe when another person signs in, kept separate per user | unit | `session.test.ts` |
| QR encode then JavaScript decode round trip of real tokens; IndexedDB store incl. a non-extractable key handle surviving a reopen | unit, fake-indexeddb | `qr.test.ts` |
| Flag off means every route answers 404; flag needs both flags exactly "true" | unit | `features.test.ts`, `qr-http.test.ts` |

### Not proven, and what would prove it

| # | Claim | Why a laptop cannot show it | Which test above covers it |
|---|---|---|---|
| U1 | Keys persist for a week in Safari and in the installed PWA, and survive storage pressure | iOS eviction policy is a property of the real OS; fake-indexeddb has none | T2, T8 |
| U2 | The JavaScript decoder reads a pass off a real screen, at real distance, in lab lighting, at the speed the lab needs | The unit test decodes a clean raster, not a camera frame with glare, moire and motion | T4 |
| U3 | `BarcodeDetector` is used where present and behaves | Absent in Node and in most desktop test browsers | T4 |
| U4 | Camera permission prompt, denial and recovery flow on iOS Safari, Samsung Internet and an installed PWA | Needs the real permission UI | T5 |
| U5 | "Add to Home Screen" and Android install prompt work with the manifest and icons (maskable crop is acceptable) | Needs the install UI | T5 |
| U6 | The service worker serves the shell offline, and the page works in airplane mode after one online visit | Never run in a real browser engine in this suite | T7 |
| U7 | Background Sync fires on Chrome and Samsung Internet; iOS correctly relies on open/online/visibility sync | Needs the browser scheduler | T7, T8 |
| U8 | Two-way exchange takes under 15 s per student with a real assistant at a real desk | Human workflow | T9 |
| U9 | Real clock skew between phones is inside the 30 s step tolerance often enough; 5 minute review threshold is right | Needs the 20-device sample | T6 |
| U10 | A screen reader and large text can complete the pass and scan screens | Needs TalkBack and VoiceOver; automated axe is not a substitute | T12 |
| U11 | The CSP and `Permissions-Policy: camera=(self)` from the hardening branch do not break the camera or the worker in a real browser | Header correctness is tested; behaviour in iOS WebKit is not | T5, T6 |
| U12 | Battery, thermal and memory behaviour of continuous camera decoding on an older iPhone | Hardware | T4 |

### Run order for the first device session

1. `U6` and `U2` on one Android phone first: if the shell does not open offline or decode fails, stop and fix before involving anyone else.
2. Then D3 (older iPhone): `T1`, `T2` (start the 7 day clock), `T4`, `T5`.
3. `T9` with two real people, then `T10` and `T11` with captured payloads from the browser's network panel.
4. File results under `docs/delivery/EVIDENCE/lab-devices/`; a failed test changes the design, it is not repeated until it passes.
