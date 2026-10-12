# E3.09 The device app: PWA, service worker, offline outbox, sync and camera scanning

Sources: `src/app/lab-device/*`, `src/lib/lab-qr/client/*`, `public/sw.js`, `public/manifest.webmanifest`, `public/offline.html`, `next.config.ts:29-30, 82-83`, tests `client.test.ts`, `session.test.ts`, `qr.test.ts`, `pwa-assets.test.ts`, `44-lab-attendance-qr.test.ts:440-540`.

Everything here runs in a browser. The unit tests use Node, a fake IndexedDB and a pure JavaScript QR round trip. The one real-browser test (`44:440-540`) uses Playwright on a desktop engine. **Behaviour on Android, Samsung Internet and iOS Safari has not been observed** (E3.10).

## 1. Boot sequence (`device-app.tsx`)

`/lab-device` serves a static shell; all personal data is read from the device's own storage after load (`page.tsx:6-10`, `device-app.tsx:34-38`).

1. Open the device store: IndexedDB if present, else in-memory with a visible warning that keys will not persist (`store.ts:93-100`, `device-app.tsx:200`).
2. Register the service worker `/sw.js` with scope `/lab-device`, `updateViaCache: 'none'`; once ready, post it the `/_next/static/` URLs the page has already loaded so they are precached (`device-app.tsx:50-63`).
3. `resolveIdentity`: call `/api/lab-attendance/me` with `no-store`. 401: wipe identity and roster, show "Sign in". Network failure or non-OK: fall back to the cached identity if it is under 24 hours old, and mark offline. Success: store it; if a different user than the cached one, wipe the roster (`session.ts:20-45`).
4. `ensureKey`: load the key stored for this user id or create one; if not yet registered, try to register (needs the network). If registration fails while online the page shows "This device could not be set up" with Try again; while offline it proceeds with an unregistered key (`device-app.tsx:65-77`, `device-key.ts:49-65`).
5. Phases: `loading`, `signed-out`, `no-identity` ("Connect to get started"), `no-key`, `failed` (any thrown error, "never sit on opening forever", line 74), `ready`.

Staff see two tabs, "My pass" and "Scan for a lab"; ordinary members only the pass (`device-app.tsx:191-232`; tab access is a UI choice, the server enforces roles).

## 2. Local storage layout (`store.ts`)

IndexedDB database `knest-lab-attendance`, version 1, four object stores with out-of-line keys:

| Store | Key | Holds |
|---|---|---|
| `keys` | user id | `{userId, keyId, privateKey: CryptoKey, publicKey: CryptoKey, publicKeyB64, createdAt, registered}` |
| `outbox` | event id | `{id, userId, token, createdAt, lastError, result}` |
| `roster` | `roster` or `passes` | `{userId, fetchedAt, expiresAt, entries}` |
| `meta` | `identity` | `{userId, name, isStaff, savedAt}` |

The `CryptoKey` objects are stored by structured clone; the non-extractable private key remains usable after reopening the database (test `qr.test.ts:74`). Keys are per user id, so another person on the same browser profile gets their own key (T11, `client.test.ts:39`).

The service worker opens this database read-only for its sync handler and aborts if the stores do not exist: "the page creates the stores; never create them here" (`sw.js:166-173`).

## 3. Device key lifecycle

- Generated once per user per browser profile, non-extractable (E3.07).
- Registration sends `{publicKey, proof, label}` where label is the first 60 characters of `navigator.userAgent` (`device-app.tsx:70`).
- If storage is evicted the key is gone and the person enrols again online: "That is expected (T2), not an error to hide" (`device-key.ts:11-13`). The old key remains **active on the server** until revoked and still counts toward the cap of five (D-12).
- After a server-side revocation the device does not notice. Its stored record says `registered: true`, `ensureDeviceKey` does nothing, and the next scans are refused as `key-revoked`. Nothing in the client generates a replacement key or tells the person (D-12).

## 4. The outbox (`outbox.ts`)

Delivery rules:

- `enqueue(id, token)` is idempotent on the event id (lines 34-38).
- `status()` returns pending count, age of the oldest, `stale` when older than 1 hour, and answered results since last clear (lines 45-51). Only items of the current user count.
- `flush(send)` sends all pending items in slices of at most 50, one request per slice, each with `clientNowMs = now()` taken at that moment (lines 54-92). It never throws:
  - `signed-out` (HTTP 401): stop, leave everything queued.
  - network error or non-OK status (including 429): mark the slice's `lastError`, stop.
  - OK: results are matched **by position** to the events sent; each item gets `result {status, code, verified, at}`. An item with no result at its position gets `lastError: 'no answer'` and stays pending.
- An answered item is kept until `clearAnswered` so the screen can show the outcome; nothing deletes unanswered items.
- An answered `rejected` item is final: the client never resends it. So an event rejected for a reason that later becomes false (for example `unknown-key` because the key had not yet been registered) is not retried automatically; the person would have to scan again.

When it runs (`device-app.tsx:93-119`): on page open when online, when the `online` event fires (`useSyncExternalStore` of `navigator.onLine`), when the tab becomes visible, after each scan, and by the "Send saved scans now" button. If anything is pending the page also asks for Background Sync with tag `knest-lab-outbox` where `registration.sync` exists. There is no periodic timer and no exponential back-off; a retry needs one of those triggers.

Offline probe (`probeOffline`, `device-app.tsx:121-129`): `navigator.onLine === false` means offline; otherwise a `GET /api/lab-attendance/me` with a 1.5 s timeout; offline if the request fails or the answer is neither OK nor 401. The result is signed into the scan as `ol`. Consequence: any non-OK answer other than 401, including a 429 from the rate limiter, makes a perfectly online device sign its scans as offline (D-09). The server then applies skew correction from `clientNowMs` instead of holding the event to its own clock; for an honest device this changes little.

## 5. Roster and pass caches (`roster-cache.ts`, `session.ts:49-86`)

- Two records, `roster` (assistant) and `passes` (booker), each `{userId, fetchedAt, expiresAt = fetchedAt + 24 h, entries}`.
- Loading: network first with `no-store`; on success it is saved. On a network failure it falls back to the cache; the cache is returned only if it belongs to the same user, has not expired and was not "fetched in the future" (more than 5 minutes ahead of now, a guard against a manipulated clock) (`roster-cache.ts:21-29`).
- HTTP 403 deletes the roster cache ("Not a lab person: nothing to keep", `session.ts:59-63`).
- Contents are display names and public keys only; no e-mail address is ever sent to a scanning device (`attendance-qr.ts:220`).
- The server returns bookings from now minus 1 hour to now plus 24 hours, so the cache is bounded by design (T10).

## 6. Log out and shared devices (`wipe.ts`, `logout-button.tsx:26`)

On logout: the roster store is cleared, every Cache Storage cache whose name starts `knest-lab-` is deleted, and the service worker is told to wipe too. **Deliberately left:** the outbox ("unsent scan events belong to the person who signed them ... deleting them would silently lose attendance records", `wipe.ts:4-8`), the key store and the cached identity. Consequences: a shared device retains the previous person's unsent signed events and their non-extractable key handle until that person signs in again; a different person signing in sees only their own items (outbox filter by user id). The cached shell is among the caches removed, so after logout the next open of `/lab-device` needs a network visit to re-cache it.

## 7. The service worker (`public/sw.js`)

Plain script: no imports, no `eval`, no remote code; a test enforces this (`pwa-assets.test.ts:37-39`). Cache name `knest-lab-shell-v1`.

| Event | Behaviour |
|---|---|
| `install` | Add `/offline.html`, `/icons/icon-192.png`, `/icons/icon-512.png` (failures ignored). Fetch `/lab-device` (`credentials: 'omit'`, `no-store`); if 200, cache it and every `/_next/static/...` URL its HTML mentions, then the static files named inside any cached CSS (fonts). A missing optional chunk does not fail install. `skipWaiting()` |
| `activate` | Delete caches with prefix `knest-lab-` other than the current name; `clients.claim()` |
| `fetch` | Only `GET`, same origin, never `/api/`. A navigation to `/lab-device` or `/lab-device/` is **network-first**: a plain 200 that is not a redirect and is `basic` is stored; on network failure serve the cached shell, else `/offline.html`, else a 503 text response. Paths under `/_next/static/` or `/icons/` are **cache-first** (a lookup ignoring the query string, because build ids and deployment queries change the URL but not a hashed file's content), with network fallback and store of OK basic responses; offline and uncached returns 504. Anything else is untouched |
| `message` | `{type:'wipe'}` deletes all `knest-lab-` caches; `{type:'precache', urls}` adds up to 80 static URLs not yet cached |
| `sync` (tag `knest-lab-outbox`) | `flushOutbox`: read pending items from IndexedDB, POST in slices of 50 with `clientNowMs: Date.now()`, write results back; stop quietly on 401; throw on non-OK so the browser retries; leave items whose answer is `not-your-key` because they belong to another account |

What it never does, by test and by reading: cache authenticated HTML, any `/dashboard/*` page or any API response (`pwa-assets.test.ts:45-52`).

Caveats from the code:

- **No pruning of old hashed assets.** The cache name is fixed (`v1`); each deployment's new chunks are added and old ones stay until a logout wipe or a manual name bump. Growth is unbounded in principle (not measured).
- **Flag off but cached:** with the QR flag off the server answers 404 for `/lab-device`, which is not cached; a device that cached the shell earlier and is offline keeps showing the old shell, whose API calls then 404. Online it gets the 404 page because the network answered.
- **Stale shell versus new API:** the shell is refreshed on every online navigation, so the main risk is only a long offline period across a deployment.
- The service worker's sync flush cannot know which account is signed in, so it sends all queued items and relies on the server's `not-your-key` answer (which is not stored) to keep others' events queued.

## 8. Manifest and install

`public/manifest.webmanifest`: `id` and `start_url` and `scope` all `/lab-device`, `display: standalone`, `orientation: portrait`, `lang: en-IN`, `theme_color #0d1321`, `background_color #f8f4e9`, icons 192 and 512 `any` and a 512 `maskable`. The page also sets `appleWebApp` metadata and an Apple touch icon (`page.tsx:13-19`). A test pins that the start URL is inside scope and the icons exist (`pwa-assets.test.ts:19-33`). Whether install prompts, maskable cropping and Add to Home Screen behave is unproven (U5).

Headers (`next.config.ts`): `worker-src 'self'`, `manifest-src 'self'`, `connect-src 'self'` (lines 29-30 and the `connect-src` line above), and `Permissions-Policy: camera=(self)` (line 83). The threat model asked for camera permission "on the scan page only" (`threat-model:69`); the header is set for the whole origin. Tested as a header string only (`29-edge-controls.test.ts:92`).

## 9. Camera scanning (`client/camera.ts`, `client/qr.ts`, `lab-device/parts.tsx`)

- **User gesture.** The camera starts only from a "Start camera" button (`parts.tsx:105`), as the permission prompt needs one.
- **Preconditions** (`cameraSupport`): secure context (HTTPS or localhost) and `navigator.mediaDevices.getUserMedia`; otherwise the problem is `insecure` or `unsupported`.
- **Stream:** `video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }`, no audio, `playsinline`, muted.
- **Decode loop:** every 150 ms (`setTimeout`, not animation frames), skipped while the previous decode is running. Native `BarcodeDetector` with `qr_code` if the browser has it; otherwise, or if it finds nothing, the frame is drawn to a canvas scaled to at most 720 px wide and decoded by `jsQR` with `inversionAttempts: 'attemptBoth'` (`camera.ts:67-91`, `qr.ts:60-63`). jsQR is pure JavaScript, so no `wasm-unsafe-eval` is needed.
- **Dedupe:** the same text from consecutive frames is handed over at most once per 4 seconds (`parts.tsx:78`). After 4 seconds a code still in view is delivered again and becomes a second event that the server will reject as `replay` (harmless, but it shows in the "not counted" total).
- **Errors** map to words and a way forward (`parts.tsx:36-43`): `denied` (NotAllowedError, SecurityError), `no-camera`, `busy`, `insecure`, `unsupported`, `unknown`. Each message points at the paste box.
- **QR drawing:** `qrcode-generator`, byte mode, error correction level M; rendered as an SVG path with a 4 module quiet zone, `crispEdges` (`qr.ts:14-39`, `parts.tsx:16-23`).
- **Text alternative:** every scan input has a textarea that takes the same token and runs the same checks; the pass has a "Pass as text" disclosure and copy button; the desk code has a text disclosure.

Not determined from the code or tests: decode success rate and speed on real screens, glare, distance, battery and heat on old iPhones, whether `BarcodeDetector` exists on the target devices (U2, U3, U12).

## 10. iOS and other platform limits, as they apply to this code

| Limit | Effect in this build | Evidence level |
|---|---|---|
| No Background Sync on Safari and Firefox | Unsent scans move only when the page is open and visible or `online` fires. An assistant who scans offline and closes the app sends nothing until it is reopened. The code feature-detects `registration.sync` and depends on nothing else (`device-app.tsx:114-119`) | Stated by the threat model from published compatibility data; not tested on devices |
| Script-writable storage can be evicted when a site is unused or the device is low on storage | Key, outbox and caches can vanish. The code does not request persistent storage (`navigator.storage.persist` is not called anywhere in `src/` or `public/`) | Documented risk (threat model T6); eviction not tested (U1) |
| `BarcodeDetector` not on Safari or Firefox | jsQR is the only decoder there | Compatibility data; speed unmeasured |
| Camera needs HTTPS and a gesture | Handled with explicit start button and messages | Messages unit tested; permission flows untested (U4) |
| Service worker needs a first online visit | `offline.html` says so (`offline.html:18-19`) | Page text tested; offline reload tested only in Playwright on desktop (`44:447-517`) |
| `visibilitychange` and `online` can be late or suppressed in a backgrounded iOS web app | Sync triggers may not fire until the person reopens the page | Not determined from the code or tests |

The offline behaviour exercised in the Playwright test (desktop engine): online setup registers a key and draws a pass; the browser is set offline and the page is reloaded from the service worker cache; a scan of the desk code is saved and not shown as verified; when online returns the event is sent (`44:440-540`). That is the extent of "proof" for the offline claim.
