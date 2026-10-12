# E3.07 QR attendance protocol: keys, token format and cryptographic choices

Sources: `src/lib/lab-qr/constants.ts`, `encoding.ts`, `keys.ts`, `tokens.ts`, `client/qr.ts`; tests `src/lib/lab-qr/protocol.test.ts:57-142, 389-398`.

Status: built, behind `FEATURE_LAB_ATTENDANCE_QR` (off by default), threat model not signed off. The constants are "PROPOSED defaults ... None is an approved policy" (`constants.ts:3-6`). The protocol has run only under Node WebCrypto and a fake IndexedDB; it has not run on a phone (E3.10).

## 1. Primitives

| Item | Choice | Where |
|---|---|---|
| Signature | ECDSA, curve P-256, hash SHA-256, through WebCrypto `subtle` (same code in browser and server) | `keys.ts:12-13` |
| Signature encoding | IEEE P1363: 64 bytes, `r` (32) then `s` (32). Verification rejects any other length before calling WebCrypto | `keys.ts:4-6, 56` |
| Private key | generated with `extractable = false`: page script can ask it to sign but cannot read it | `keys.ts:21-23` |
| Public key | 65 byte uncompressed point `0x04 || X || Y`; imported only if length is 65 and the first byte is `0x04`; WebCrypto rejects points not on the curve | `keys.ts:19, 26-38` |
| Key id | first 12 bytes of SHA-256(raw public key), base64url: **16 characters** | `keys.ts:41-44` |
| Nonce | 12 bytes from `crypto.getRandomValues`, base64url: **16 characters** | `keys.ts:64-67` |
| Time step | `floor(unixMilliseconds / 30000)` | `tokens.ts:75`, `constants.ts:13-14` |
| Text encoding | base64url without padding, canonical only; UTF-8 for JSON | `encoding.ts` |

### 1.1 base64url (`encoding.ts`)

Alphabet `A-Za-z0-9-_`, no `=` padding. `fromBase64Url` returns null unless the text matches `^[A-Za-z0-9_-]*$`, its length mod 4 is not 1, **and** re-encoding the decoded bytes reproduces the input exactly (`encoding.ts:24-42`). The last check rejects "non-canonical" strings whose final character carries stray low bits, so one byte string has exactly one text form (`encoding.ts:40`). The matching test is `protocol.test.ts:58`.

### 1.2 Key id and why its truncation is safe

A key id is a lookup handle, not a secret and not the trust anchor. The verifier resolves the id to a registered public key and then checks the signature with that key. Registration recomputes the id from the key (`attendance-qr.ts:53`), so a client cannot register a key under an id of its choosing. A chance 96-bit collision would be refused at insertion (primary key) rather than create an impersonation.

## 2. The token envelope

```
K1.<payload>.<signature>

payload   = base64url( UTF-8 bytes of compact JSON )
signature = base64url( ECDSA-P256-SHA256 signature, 64 bytes )
signed bytes = UTF-8("knest-lab-attendance/v1/" + type + "\n") || payload bytes
```

- `K1` is the version prefix; a wire format change changes it and old tokens stop verifying (`constants.ts:9-10`).
- `type` is one of `pass`, `chal`, `scan`, `reg`. Including it in the signed bytes is **domain separation**: a signature made for one message type does not verify as another (`tokens.ts:5-13, 73`; test `protocol.test.ts:111`).
- The signature is computed over the exact payload bytes that travel in the token. There is no JSON canonicalisation: the verifier hashes the bytes it received, so key order and spacing cannot change the meaning. The server stores the token verbatim (`lab_scan_events.token`).
- Maximum length 2048 characters (`constants.ts:52`), checked on parse and on creation (`tokens.ts:83, 107`).

### 2.1 Parse order (`parseToken`, `tokens.ts:82-100`)

1. Is a non-empty string no longer than 2048.
2. `split('.')` gives exactly 3 parts and part 0 is `K1`.
3. Payload and signature decode as canonical base64url; the signature is exactly 64 bytes.
4. Payload bytes decode as strict UTF-8 (`fatal: true`) and parse as JSON.
5. The JSON is an object (not null, not an array), its `t` equals the type the caller expects.
6. The strict shape check for that type passes (section 3): exactly the listed keys, no extras, each of the right type and pattern.

Nothing from the payload is trusted until `verifyToken` has found the signer's registered key by `payload.k` and the signature has verified (`tokens.ts:119-126`). Failure codes: `malformed`, `unknown-key`, `bad-signature`.

## 3. The four payloads

Field patterns: UUID `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (lower case only); key id and nonce `^[A-Za-z0-9_-]{16}$`; step and time are positive safe integers (`tokens.ts:15-42`).

### 3.1 `pass`: a student's pass, signed by the student's device key

| Field | Value | Meaning |
|---|---|---|
| `v` | `1` | payload version |
| `t` | `"pass"` | type |
| `a` | `"in"` or `"out"` | action this pass is for |
| `b` | UUID | booking id |
| `k` | key id | the student's key (the signer) |
| `s` | integer | time step the pass was made in |
| `n` | 16 char nonce | single use |

Example shape: `{"v":1,"t":"pass","a":"in","b":"<uuid>","k":"<16>","s":59726438,"n":"<16>"}`. Key order is as the builder writes it (`tokens.ts:131`). Payload 129 bytes, token about **262 characters** (computed from the field widths; QR symbol size not determined here).

### 3.2 `chal`: the lab desk's code, signed by the assistant's device key

| Field | Value | Meaning |
|---|---|---|
| `m` | `"in"` or `"out"` | the mode the desk is in |
| `l` | UUID | **lab** id (not a booking id) |
| `k`, `s`, `n` | as above | the assistant's key, step, nonce |

A challenge is lab-wide: it does not name a booking or a student, so any student with a booking in that lab may scan it within its window.

### 3.3 `scan`: a scan event, signed by the scanning device

| Field | Value | Meaning |
|---|---|---|
| `id` | UUID | chosen by the scanning device; the idempotency key |
| `sd` | `"staff"` or `"student"` | which side scanned. `staff` scanned a pass; `student` scanned a challenge |
| `a` | `"in"` or `"out"` | action |
| `k` | key id | the scanner's own key (the signer) |
| `at` | integer ms | the scanner's own clock at scan time |
| `bk` | UUID | the booking this scan is about |
| `ol` | `0` or `1` | `1` = device had no connection when it scanned; signed by the device |
| `tok` | string, 1 to 2048 | the scanned token **verbatim** (a `pass` or a `chal`) |

An event with an embedded pass is about **688 characters**: payload 448 bytes (computed from field widths with a 262 character `tok`). It is therefore never shown as a QR; it travels in JSON to the server.

### 3.4 `reg`: proof of possession at enrolment

| Field | Value |
|---|---|
| `u` | user id string, 1 to 128 characters |
| `k` | key id of the key being registered |
| `at` | the device clock in ms |

Signed by the key it names. About 226 characters.

## 4. What the signatures do and do not establish

Establishes:

- A pass was made by whoever holds the private key whose id is `k` **and** that public key is registered to a particular account (the key-to-account link is made by the registration proof, section 5).
- The scan event was made by the holder of the scanner key and carried that exact scanned token (the token is inside the signed payload, so it cannot be swapped).
- Tampering with any byte of a payload, or moving a signature between types, fails verification (tests `protocol.test.ts:100, 111`).
- A token minted by one staff or student key cannot be passed off as another key's: the signature must verify with the key the payload names (test `protocol.test.ts:182`: a registered key id claimed but a different key used).

Does not establish:

- **Physical presence.** A code is data; whoever can see or receive its text can present it within the window. The threat model accepts this (T2) and relies on a person looking at the student and their ID. The paste-the-text path (`ScanInput`, `lab-device/parts.tsx:128-141`) makes a remote relay a copy and paste.
- **That a key sits in a real, non-extractable device store.** The server cannot verify non-extractability; there is no attestation. `extractable: false` is a property of the honest client code. A person running modified client code could generate an extractable key and share it. This is within the "student colludes with themself" boundary of the model, not something the code detects.
- **Confidentiality.** Payloads are readable by anyone who sees the code: they expose a booking UUID, a lab UUID and key ids, never a name or e-mail (`protocol.test.ts:89`).
- **Freshness beyond the step window**, section 6.

## 5. Registration proof (`attendance-qr.ts:43-78`)

Order of checks in `registerDeviceKey`:

1. Both fields are strings; the public key decodes to exactly 65 bytes and imports as a P-256 point.
2. `keyId = keyIdFor(raw)`.
3. `verifyToken(proof, 'reg', id => id === keyId ? imported : null)`: the proof must be signed by **the key being registered**. This proves the caller holds the private half.
4. `proof.u === session user id`: the proof is bound to the authenticated account, so another account cannot replay it (`forbidden`).
5. `|server now - proof.at| <= 5 minutes` (`MAX_CLOCK_SKEW_MS`), else a "device clock is more than five minutes off" message. This bounds replay of a stolen proof.
6. If the key id already exists: owned by someone else -> `conflict`; revoked -> `forbidden` ("Generate a new one"); otherwise return the existing row (idempotent).
7. At most 5 active (unrevoked) keys per person (`limit`).
8. Insert with `onConflictDoNothing`; audit `lab_device_key_registered`.

Limits: the proof binds a key to the **session** that registered it. Anyone who controls a signed-in session can register their own key to that account (up to 5). Session protection is outside this volume.

## 6. Time-step validity

Constants (`constants.ts`): `STEP_SECONDS = 30`, `STEP_TOLERANCE = 1`. The server accepts a pass or challenge when `|token.s - step(effective scan time)| <= 1` (`tokens.ts:153-155`, applied at `decide.ts:154`). A token made at some moment in step `s` is therefore accepted for effective times from the start of step `s-1` to the end of step `s+1`: a window of **90 seconds**, of which the first 30 are the period it is on screen. The comment states the trade: one step each way tolerates about a minute of drift between two phones, at the cost of up to 90 s in which a photo still works (`constants.ts:16-21`). The pass screen tells the user "A screenshot stops working after about a minute" (`pass-panel.tsx:184`).

The comparison is against the **corrected scan time**, not the time of submission, so an offline scan synced hours later still validates (E3.08 section 4).

## 7. Choices and their limits, in one table

| Choice | Why | Limit |
|---|---|---|
| Asymmetric signatures, not a shared HMAC secret | A shared per-booking secret on an assistant's phone would let a thief mint passes for every student on the roster (threat model section 3) | Anyone holding the *public* keys can verify but not forge; a phone holds only its owner's private key |
| WebCrypto non-extractable keys | Script cannot exfiltrate the private key (T9) | No attestation; storage eviction destroys the key (section 8 of E3.09); XSS can still *use* the key |
| One key per person per browser profile, up to 5 | A lost phone is one revocation (threat model line 90) | No rotation protocol; a re-enrolled device leaves an orphan active key until someone revokes it, and the cap counts it |
| 30 s step, plus or minus 1 | Screenshot resistance vs drift tolerance | A live relay within seconds is not stopped |
| Domain-separated signed type | A pass cannot be reused as a scan or registration | None known |
| Nonce 96 bits, single use in the database | Replay defence is a database unique index, not memory | Only effective for accepted or held events (E3.02 section 5) |
| ECDSA signatures are randomised by WebCrypto | Standard | Security relies on the platform's randomness; not independently verified |
| `ol` flag signed by the device | Lets the server apply clock correction only to events the device says it created offline | The device is untrusted, so the flag is a claim; its effect is bounded (E3.08 section 4) |
