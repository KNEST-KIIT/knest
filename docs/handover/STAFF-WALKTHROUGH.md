# Staff console walkthrough

Audience: KNEST staff who review applications, answer enquiries, manage accounts and watch what is happening on the platform.

After reading this you can sign in, find the screens your role allows, review an application from first look to decision, handle an enquiry, change an account, and read the audit trail.

For website content (programs, events, mentors, articles, homepage, pictures) read `CONTENT-EDITING-GUIDE.md`. For labs read `LAB-OPERATIONS-GUIDE.md`.

## Status of this guide

Written on 2026-10-09 from the code. The site is not live yet (see `ARCHITECTURE.md`). Screens were tested by automated tests against local data, not by staff on a live site. If a screen differs from this guide, trust the screen and tell: [PLACEHOLDER: engineering contact].

## Two places, one account

There are two parts to the admin area. They share one sign-in.

| Part | Address | For |
|---|---|---|
| The staff console | `/admin/overview` and the screens below | Applications, enquiries, members, labs, audit, analytics |
| The full admin (Payload) | `/admin` | Website content: programs, events, mentors, startups, articles, homepage, media |

The header of the staff console has a link to the full admin: "Full admin (content, programs, startups)".

## Sign in and out

1. Go to `/login`. Enter your email and password. Complete the human check.
2. Open `/admin/overview`.

There is one account for everyone. Your staff role is a setting on your account. A super admin sets it. Nobody can change their own role.

- If you open an admin address and see "not found", you do not have the role for that screen. This is deliberate. The console does not confirm that a screen exists to people who cannot use it.
- Sessions last 30 days. Changing your staff role or deactivating your account ends your sessions at once. You will be asked to sign in again.
- The staff console header has a **Log out** button. It ends the session on the server. This button is new, and was still uncommitted work when this guide was written, so confirm it is present on the live site.
- A password needs at least 12 characters. A reset email link works for 1 hour.

### First super admin

The first super admin is created by an engineer with the seed command, using a password chosen for that purpose. There is no screen for creating the first one. [PLACEHOLDER: name of the person who holds the first super admin account]

## Which screens you see

The header shows only the screens your role may open.

| Screen | Address | Roles |
|---|---|---|
| Overview | `/admin/overview` | Any staff role |
| Applications | `/admin/applications` | Reviewer, program manager, super admin |
| Enquiries | `/admin/enquiries` | Content admin, super admin |
| Members | `/admin/members` | Super admin |
| Labs | `/admin/labs` | Lab admin, super admin. Hidden while lab booking is off. |
| Audit trail | `/admin/audit` | Super admin |
| Analytics | `/admin/analytics` | Super admin |

The staff roles are: reviewer, content admin, program manager, startup manager, mentor manager, lab admin, super admin.

Some roles work only in the full admin. If you are a startup manager or a mentor manager, the overview tells you so and points you there.

## Overview

`/admin/overview` shows what needs attention for your role. Each figure is counted from live records and links to the screen behind it. You see only the figures for areas you may open.

| Figure | What it counts | Who sees it |
|---|---|---|
| Applications awaiting a first look | Applications with status Submitted | Reviewer, program manager, super admin |
| Applications in progress | Under review, shortlisted, interview or waitlisted | The same |
| New enquiries | Enquiries not yet marked handled | Content admin, super admin |
| Active accounts | Accounts that can sign in | Super admin |
| Deactivated accounts | Accounts switched off | Super admin |
| Latest staff actions | The five newest audit entries | Super admin |

## Review an application

Roles: reviewer, program manager, super admin.

### Find applications

1. Open **Applications**.
2. Use the filters: **Name or email** search, **Program**, **Status**. Press **Filter**.
3. The list shows submitted applications only, newest submission first, 25 to a page. Drafts are the applicant's own unfinished work and staff never see them.
4. Each row shows Applicant, Email, Program, Submitted and Status. On a phone-width screen the rows become cards.

The Program filter lists the programs that are currently published. A program you have unpublished will not be in the filter list, although its applications still appear in the list when you do not filter by program.

### Read an application

Open a row. The page shows:

- The program, the applicant's name, email and submission date.
- Every question with the applicant's answer. A select answer shows the label the applicant saw.
- For file questions, a link with the file name. The file downloads through a staff-only route.
- On the right, the current **Status** and the form to change it.

You see the questions **as the applicant saw them when they submitted**, even if the program was edited afterwards.

### Move an application along

Applications move only along these paths. The form offers only the legal next steps.

| From | You can move it to |
|---|---|
| Submitted | Under review, Not this time |
| Under review | Shortlisted, Not this time |
| Shortlisted | Interview, Not this time |
| Interview | Accepted, Not this time, Waitlisted |
| Waitlisted | Accepted, Not this time |
| Accepted | Nothing. Final. |
| Not this time | Nothing. Final. |

The applicant sees "Not this time" for a rejection. The code calls it "rejected".

To move one:

1. Choose **Move to: ...** in the status form.
2. Optionally type a note. It can be up to 2,000 characters.
3. Press **Update status**.

What happens next, all in one step:

- The status changes and a row is added to the audit trail.
- The applicant gets a notice in the app and an email.
- Accepted and Not this time also record a decision time.
- For Accepted, an "application accepted" analytics event is recorded.

Know these points:

- **Final states cannot be undone** in the screens. Check before you press the button. If you make a mistake, ask engineering. [PLACEHOLDER: engineering contact]
- **The note is not shown to the applicant**, and it is not in the email. It is saved with the decision. The detail screen does not display it later. A super admin can read it in the audit trail ("after" value). Do not rely on it as a place to keep working notes that other reviewers must read.
- **Every status email has the same subject:** "Your application to [program] - an update". This is on purpose. A subject that revealed the outcome would show a rejection or acceptance on a lock screen before the person chose to open it.
- **If two reviewers act at once,** the second sees "Someone else changed this application first. Reload to see its current status." Nothing is written twice and no second email goes out.
- The text of each email is fixed in code (`src/server/notifications/templates.ts`).

### Who decides what

Who may accept, waitlist or reject, how many reviewers read each application, and any scoring rules are not set in the system. Any reviewer, program manager or super admin can make any legal move. Agree the rules in your team: [PLACEHOLDER: review process agreed by the program team]

## Enquiries

Roles: content admin, super admin.

Messages sent through the public contact form arrive here. A person sends a name, email, topic and message (10 to 2,000 characters). The form has a hidden field that catches bots, and the human check.

1. Open **Enquiries**. Use the links **All**, **New**, **Handled**. The list shows the newest first, 25 to a page.
2. Each entry shows the name, a clickable email address, the topic, the time, and the message. It says "signed-in member" if the sender was signed in.
3. Answer the person from your own mailbox. The console does not send replies.
4. Press **Mark handled**. The entry moves to Handled with the time. The action is recorded in the audit trail. Pressing it twice changes nothing.

Topics are: General question, A program or application, Partnering with KNEST, Becoming a mentor, Press or media, Help with my account.

If an engineer has set the `ENQUIRY_NOTIFY_EMAIL` setting, each new message is also emailed to that address. If it is not set, nobody is told. Check this console on a schedule. [PLACEHOLDER: who checks enquiries and how often] [PLACEHOLDER: the address that receives notifications, if any]

Treat enquiries as personal data. Do not forward them to people outside the team without a reason.

## Members

Role: super admin.

Use this screen to find an account, switch it off or on, and set a staff role.

1. Open **Members**. Search by **Name or email**. Tick **Staff only** or **Deactivated only** to narrow the list. Press **Search**.
2. Each row shows the name, email, platform role, staff role (if any), the join date and "email not verified" where it applies.
3. To change a staff role, use the **Staff role** menu on that row: Not staff, Reviewer, Content admin, Program manager, Startup manager, Mentor manager, Lab admin, Super admin. The change saves at once.
4. To switch an account off or on, press **Deactivate** or **Reactivate**.

Effects:

- **Both actions end that person's sessions at once** and write an audit entry.
- A deactivated account cannot sign in, and cannot keep a session, including Google sign-in.
- You cannot change your own role or your own active state. The controls are disabled on your row.
- You cannot remove, demote or deactivate the last active super admin. You see "That is the last active super admin. Add another before changing this role."
- Giving someone a role does not tell them. Tell them yourself.

Good practice: give people the smallest role that does their job. Review the staff list every term. [PLACEHOLDER: who reviews the staff list and how often]

There is no way in the screens to delete an account or to answer a request to erase a person's data. How KIIT handles such requests is undecided (HD-06). Do not improvise. [PLACEHOLDER: the privacy contact once HD-06 is approved]

## Audit trail

Role: super admin.

The audit trail lists every privileged action: who did it, when, which record, and the value before and after. It cannot be edited here.

1. Open **Audit trail**. 50 entries show per page, newest first.
2. Filter by **Action** and **Record type**. Only values that exist on record are offered.
3. Each entry shows the action, the record type with the first eight characters of its id, the time, the person, and Before and After summaries.

Actions you will see include application status changes, enquiry handled, account deactivated or reactivated, staff role changed, and lab actions (lab created or updated, hours set, closed dates, staff changes, booking decisions and attendance).

Limits you must know:

- Publishing or unpublishing in the content admin is **not** recorded yet (`docs/delivery/LOCAL-COMPLETENESS.md`, module 43).
- The audit trail records staff actions. It does not record a person reading an application.
- Entries are kept as they are. The retention period is undecided (HD-06).

## Analytics

Role: super admin.

The screen shows counts of events the site recorded, in five stages: Acquisition, Activation, Intent, Engagement, Outcomes. It also shows **Activated Builders**: members who finished onboarding, have a journey stage, and have started an application, registered for an event or viewed a startup.

- Numbers come from real recorded events. If nothing is recorded, the screen says "No activity tracked yet."
- The records come from the site itself. There is no third-party analytics tool.
- The delivery status lists analytics as partly done. The funnel counts exist, but they have not yet been reconciled against figures counted straight from the tables (`docs/delivery/LOCAL-COMPLETENESS.md`, module 35). Do not publish these numbers as official results until that is done. [PLACEHOLDER: who signs off the analytics figures]

## Labs

Roles: lab admin, super admin. Hidden while lab booking is off.

Lab booking is off until the lab policy is signed. See `LAB-OPERATIONS-GUIDE.md`. When on, **Labs** lets an administrator create labs and open each lab's console, and shows the utilisation report. Read the warning in that guide about the "Open for booking" box before you use it.

## Accessibility notes for staff

What the code and the automated checks cover:

- Every screen has a skip link that jumps to the main content.
- Filters and search boxes have labels for screen readers. Lists of results become cards on narrow screens.
- Errors appear in an alert so a screen reader announces them.
- The automated axe suite passes for the pages and states it scans, at desktop and phone width. A code review found further problems, listed below.

The automated checks do not scan the mobile menu when open, the booking times list, any form showing an error, or the application detail page (`/admin/applications/[id]`).

What has **not** been done:

- No person has tested `/admin/*` or `/dashboard/lab-staff/*` with a keyboard or a screen reader. The delivery record lists a manual walk-through as still to do. Screen readers, voice control, forced-colors mode, zoom at 200 and 400 percent, and real devices are all untested.
- The Payload admin (the full admin) is a separate product. It was not reviewed here, and its accessibility status is unverified.

### Known problems found by reading the code, with workarounds

These come from the accessibility reviewer's code review (`docs/handover/ACCESSIBILITY-REVIEW.md` has the file and line for each). None has been confirmed in a browser or with assistive technology.

| Screen | Problem | Workaround |
|---|---|---|
| Members | The **Staff role** menu saves the moment its value changes. With a keyboard, the arrow keys on a closed menu may save each role you pass, including Super admin. | Open the list first (Alt+Down or Space), move with the arrow keys, then press Enter. Or ask a mouse user to change roles. Check the audit trail afterwards. |
| Application detail | The status menu has no label for a screen reader, and the note box has only placeholder text. | The status menu is the first control under "Update status". The note box follows it. |
| Lab console | Buttons such as Approve, Decline, Remove, Mark attended and Cancel have the same name on every row. After you press one, keyboard focus returns to the top of the page and nothing is announced. | Check the list afterwards to confirm the change happened. |
| Lab console | Every opening-hours row is announced as "Day", "Opens", "Closes". | Count the rows from the top. |
| Forms generally | An error shows in one banner, not beside the field, and is not tied to the field for a screen reader. | Read the whole banner, then go back to the fields. |
| Sign-in, contact, booking and application forms | If a school or ad blocker blocks the human check (Cloudflare Turnstile), the buttons stay disabled with no message. | Allow `challenges.cloudflare.com`. |
| Mobile menu | It may not be usable (a possible layout fault) and does not trap keyboard focus. | Use a desktop-width window until this is confirmed fixed. |
| Lab booking page | Nothing is announced when a request is sent, and the message may vanish within a second. | Check "Your bookings" on `/dashboard/lab-booking`. |

Things that are in place, from the code: a skip link, visible keyboard focus on buttons and links, reduced-motion support, text labels for statuses (never colour alone), and labelled data tables in the utilisation report.

If something does not work with your keyboard or screen reader, tell: [PLACEHOLDER: accessibility contact]. Please include the screen and what you did.

## Daily and weekly rhythm (suggested)

These are suggestions for you to adapt. They are not system rules.

| When | Task |
|---|---|
| Each working day | Check Overview. Clear "Applications awaiting a first look" and "New enquiries". |
| While a program is open | Check the queue more often. Applicants see their status the moment you change it. |
| Each week | Look at Deactivated accounts and staff roles. |
| After any account or role change | Check the audit entry appeared. |

## Who to ask

| Question | Contact |
|---|---|
| A screen is broken or wrong | [PLACEHOLDER: engineering contact] |
| I need an account, a role or a reset | [PLACEHOLDER: super admin name] |
| A question about what to say or decide for an applicant | [PLACEHOLDER: program lead] |
| A privacy question or request | [PLACEHOLDER: privacy contact, not yet named (HD-06)] |
