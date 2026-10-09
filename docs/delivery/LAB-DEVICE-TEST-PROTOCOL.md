# Lab attendance: real-device test protocol

**Purpose:** the evidence that `LAB-ATTENDANCE-THREAT-MODEL.md` section 6 requires before LB-07, LB-08 or LB-10 are implemented. This is a protocol and a results template. **No results exist yet; every result cell is blank.** Emulators and desktop "mobile mode" do not count.

**Who runs it:** an engineer plus the devices below, in the actual lab, under the lighting and network the lab really has. **Code involved:** a throwaway test page (not production code), served over HTTPS from a staging origin, so it can be discarded.

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
