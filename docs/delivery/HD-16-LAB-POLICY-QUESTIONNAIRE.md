# HD-16: lab operating policy: questions for KNEST and the lab heads

**Status: BLOCKED. No answers have been given.** The lab booking platform (contract modules 25-32) and the QR/PWA modules (36-38) cannot be built to a real policy until these are answered. The "recommended default" column is a starting point for discussion, not a decision. Blank cells are blank on purpose; they are to be filled by the people named in "Decides".

How to use: a KNEST lead and 1-3 pilot lab heads go through this together (about 90 minutes). Return it filled in, and the answers become the configuration of the booking rules, not code changes.

| # | Question | Why it matters | Options | Recommended default | Answer | Decides |
|---|---|---|---|---|---|---|
| 1 | Which 1-3 labs or spaces pilot first? For each: name, department, equipment, capacity, the head, the assistants | Pilot-B scope, who gets accounts and training | any | One maker space, one cabin/studio, one department lab | | KNEST lead |
| 2 | Who may book? | Abuse, safety, fairness | (a) any verified student; (b) verified and onboarded founder; (c) accepted into a program; (d) approved by a lab head per person | (b), plus a staff-granted flag for exceptions | | KNEST lead + heads |
| 3 | Operating hours per lab, blackout dates (exams, holidays, maintenance) | Slot generation | per lab | Weekdays 9:00-18:00 IST; blackout calendar owned by the head | | Heads |
| 4 | Slot length and granularity | Utilisation vs flexibility | 30 / 60 / 120 min, or free-form | 60 min blocks, up to 3 consecutive | | Heads |
| 5 | How far ahead and how late can a booking be made? | Planning, no-shows | min lead time, max horizon | At least 4 h ahead, at most 14 days ahead | | Heads |
| 6 | Limits per person | Stops one person holding a lab | open requests, hours per week | 3 open requests, 6 h per week | | KNEST lead |
| 7 | Who approves, and how fast? What happens if nobody answers? | Pending requests must not rot | head only / head or assistant; SLA; auto-expire | Head approves; SLA 2 working days; request expires at slot start | | Heads |
| 8 | May a head propose a different time instead of rejecting? | Contract module 28 | yes/no | Yes | | Heads |
| 9 | Does an assistant have to be present for a booking to happen? | Roster, safety, QR design | always / only some equipment / never | Always for machinery, else optional | | Heads |
| 10 | **What does a scan do: open a door, or only record attendance?** | **Decides how strong the QR/offline design must be** (see `LAB-ATTENDANCE-THREAT-MODEL.md`) | (a) records attendance for reports; (b) gates entry | (a) for the pilot; (b) only after real-device testing | | KNEST lead + heads |
| 11 | May an assistant or head mark attendance manually? Who reviews those? | Forged attendance, devices without a camera | allowed with reason / not allowed | Allowed with a reason; shown separately in reports | | Heads |
| 12 | Cancellation: cut-off, late-cancellation and no-show rule | Fairness | none / warning / temporary block | Cancel free until 2 h before; no-show = a warning; three in a term = review by the head | | KNEST lead |
| 13 | Safety and induction: what must a person have done first? Who records it? | Liability | none / checklist / training record | Per-lab checklist; head records completion | | Heads + KIIT safety |
| 14 | Groups and guests: headcount, may guests attend? | Capacity, identification | n | Headcount declared at booking; no unregistered guests | | Heads |
| 15 | What booker data may a lab head or assistant see? | Privacy (HD-06) | name only / name + purpose / + e-mail | Name, purpose, headcount; e-mail only for the head | | KNEST lead |
| 16 | How long are booking and attendance records kept? | Privacy, storage | months / terms | Per HD-06 (undecided) | | KIIT legal |
| 17 | What reports does KIIT want, for whom, how often? | Contract module 32 | utilisation, no-shows, hours, by lab/department | Monthly utilisation by lab and department; no-show rate | | KNEST lead |
| 18 | Who answers a failure at the lab door (the AMC treats this as a priority-1 incident)? | Support rota | name, phone, hours | A named assistant per lab during opening hours + KNEST support after | | KNEST lead |
| 19 | Accessibility: what must work for people who cannot use a phone camera? | WCAG, fairness | manual check-in, staff device | Manual check-in always available | | Heads |
| 20 | Which devices will assistants use (own phones, a shared tablet at the desk)? | Offline design, key storage | own / shared | Own phone, signed in as themselves; no shared logins | | Heads |

## Sign-off (to be completed by people, never by the engineering team)

| Role | Name | Date | Signature / evidence |
|---|---|---|---|
| KNEST lead | | | |
| Lab head, lab 1 | | | |
| Lab head, lab 2 | | | |
| Lab head, lab 3 | | | |
